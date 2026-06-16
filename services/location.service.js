// services/location.service.js
//
// Handles BOTH foreground (app open) and background (app closed) tracking.
//
//  Foreground  → Location.watchPositionAsync  → handleLocationUpdate()
//  Background  → Location.startLocationUpdatesAsync (background task)
//               The task is defined in geofence.task.js and registered at
//               app root (_layout.tsx).  This service just starts/stops it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Alert, AppState } from 'react-native';
import { MAX_DISTANCE, OFFICE_LOCATION, calculateDistance } from '../utils/location';
import attendanceService from './attendance.service';
import eventEmitter from './eventEmitter';
import { BACKGROUND_LOCATION_TASK } from './geofence.task'; // registers the task

class LocationService {
    constructor() {
        this.locationSubscription = null;
        this.appStateSubscription = null;
        this.isTracking = false;
        this.appState = AppState.currentState;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.isProcessing = false;
        this.lastCheckInTime = 0;
        this.lastCheckOutTime = 0;
        this.CHECK_IN_COOLDOWN = 30_000;  // 30 s
        this.CHECK_OUT_COOLDOWN = 30_000;  // 30 s
        this.STALE_RECOVERY_COOLDOWN = 30_000;
        this.lastStaleRecoveryTime = 0;
        this.wasInsideOffice = null;  // null = unknown (first run)
        this.midnightTimeout = null;
    }

    // ── Permission helpers ───────────────────────────────────────────────────

    async _requestPermissions() {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
            Alert.alert(
                'Permission Required',
                'Please allow location access for attendance tracking. You can enable it in Settings.'
            );
            return false;
        }

        // Background permission is required for the background task to fire
        // when the app is closed.  On iOS this shows "Allow Always" prompt.
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
            Alert.alert(
                'Background Location Required',
                'To auto check-in/out when the app is closed, please select "Always" for location access in Settings.',
                [{ text: 'OK' }]
            );
            // We continue — foreground tracking still works, background won't.
        }

        return true;
    }

    // ── Background task ──────────────────────────────────────────────────────

    async _startBackgroundTask() {
        try {
            const isRegistered = await Location.hasStartedLocationUpdatesAsync(
                BACKGROUND_LOCATION_TASK
            );
            if (isRegistered) {
                console.log('[LocationService] Background task already running');
                return;
            }

            await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                accuracy: Location.Accuracy.Balanced, // saves battery vs High
                timeInterval: 60_000,   // fire at most every 60 s
                distanceInterval: 10,   // OR every 50 m moved
                // Android foreground-service notification keeps the task alive
                foregroundService: {
                    notificationTitle: 'Attendance Tracking',
                    notificationBody: 'Tracking your location for auto check-in/out',
                    notificationColor: '#D96A17',
                },
                // iOS — keep waking the app even when killed
                pausesUpdatesAutomatically: false,
                showsBackgroundLocationIndicator: true,
                activityType: Location.ActivityType.Other,
            });

            console.log('[LocationService] Background task started');
        } catch (err) {
            console.error('[LocationService] Failed to start background task:', err);
        }
    }

    async _stopBackgroundTask() {
        try {
            const isRegistered = await Location.hasStartedLocationUpdatesAsync(
                BACKGROUND_LOCATION_TASK
            );
            if (isRegistered) {
                await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                console.log('[LocationService] Background task stopped');
            }
        } catch (err) {
            console.error('[LocationService] Failed to stop background task:', err);
        }
    }

    // ── Main start ───────────────────────────────────────────────────────────

    async startTracking() {
        if (this.isTracking) {
            console.log('[LocationService] Tracking already active');
            return true;
        }

        try {
            const userData = await AsyncStorage.getItem('userData');
            if (!userData) {
                console.log('[LocationService] No user logged in, skipping tracking');
                return false;
            }

            const permOk = await this._requestPermissions();
            if (!permOk) return false;

            // ── Foreground watcher ───────────────────────────────────────────
            // AFTER
            this.locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 500,    // 0.5s — near-instant
                    distanceInterval: 1,  // 1 meter moved = update
                },
                this.handleLocationUpdate.bind(this)
            );

            this.isTracking = true;
            console.log('[LocationService] Foreground tracking started');

            this.appStateSubscription = AppState.addEventListener(
                'change',
                this.handleAppStateChange.bind(this)
            );

            // ── Background task ──────────────────────────────────────────────
            await this._startBackgroundTask();

            // Midnight rollover & immediate location check
            this.scheduleMidnightRollover();
            await this.getCurrentLocation();

            return true;

        } catch (error) {
            console.error('[LocationService] Failed to start tracking:', error);
            this.isTracking = false;
            return false;
        }
    }

    // ── Foreground location handler ──────────────────────────────────────────

    async handleLocationUpdate(location) {
        // ✅ Always runs — never blocked by isProcessing
        const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            OFFICE_LOCATION.latitude,
            OFFICE_LOCATION.longitude
        );
        const isInsideOffice = distance <= MAX_DISTANCE;

        eventEmitter.emit('LOCATION_UPDATED', {
            distance: Math.round(distance),
            isInside: isInsideOffice,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date().toISOString(),
        });

        await this._saveLastLocation(location.coords, distance, isInsideOffice);

        // ✅ Guard only blocks check-in/out logic, NOT the UI update above
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;

            const userData = await AsyncStorage.getItem('userData');
            if (!userData) {
                console.log('[LocationService] No user data, stopping tracking');
                this.stopTracking();
                return;
            }

            const user = JSON.parse(userData);
            const employeeNumber = user.employeeNumber;
            if (!employeeNumber) return;

            const now = Date.now();

            // Get current attendance status (uses cache when available)
            const currentStatus = await attendanceService.getCurrentStatus(employeeNumber);
            const isCheckedIn = currentStatus === 'CHECKED_IN';

            console.log(
                `[LocationService] dist=${Math.round(distance)}m inside=${isInsideOffice} ` +
                `checkedIn=${isCheckedIn} wasInside=${this.wasInsideOffice}`
            );

            // ── STALE SESSION RECOVERY ────────────────────────────────────────
            if (
                isCheckedIn &&
                attendanceService.isOpenSessionStale() &&
                (now - this.lastStaleRecoveryTime) > this.STALE_RECOVERY_COOLDOWN
            ) {
                console.log('[LocationService] Stale open session — recovering...');
                this.lastStaleRecoveryTime = now;

                await attendanceService.checkOut(
                    employeeNumber,
                    location.coords.latitude,
                    location.coords.longitude
                );

                if (isInsideOffice) {
                    this.lastCheckInTime = now;
                    this.wasInsideOffice = true;
                    await this.performCheckIn(
                        employeeNumber,
                        location.coords.latitude,
                        location.coords.longitude
                    );
                } else {
                    this.wasInsideOffice = false;
                }

                this.retryCount = 0;
                return;
            }

            // ── AUTO CHECK-IN ─────────────────────────────────────────────────
            if (
                isInsideOffice &&
                !isCheckedIn &&
                (now - this.lastCheckInTime) > this.CHECK_IN_COOLDOWN
            ) {
                console.log('[LocationService] AUTO CHECK-IN triggered');
                this.lastCheckInTime = now;
                this.wasInsideOffice = true;
                await this.performCheckIn(
                    employeeNumber,
                    location.coords.latitude,
                    location.coords.longitude
                );
            }
            // ── AUTO CHECK-OUT ────────────────────────────────────────────────
            else if (
                !isInsideOffice &&
                isCheckedIn &&
                (now - this.lastCheckOutTime) > this.CHECK_OUT_COOLDOWN
            ) {
                console.log('[LocationService] AUTO CHECK-OUT triggered');
                this.lastCheckOutTime = now;
                this.wasInsideOffice = false;
                await this.performCheckOut(
                    employeeNumber,
                    location.coords.latitude,
                    location.coords.longitude
                );
            } else {
                this.wasInsideOffice = isInsideOffice;
            }

            // ✅ REMOVED: duplicate emit + saveLastLocation (already done above)
            this.retryCount = 0;

        } catch (error) {
            console.error('[LocationService] Error handling location update:', error);
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                setTimeout(() => this.handleLocationUpdate(location), 2000 * this.retryCount);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    // ── Check-in / Check-out helpers ─────────────────────────────────────────

    async performCheckIn(employeeNumber, latitude, longitude) {
        try {
            console.log('[LocationService] Performing check-in...');
            const result = await attendanceService.checkIn(employeeNumber, latitude, longitude);

            if (result.success) {
                console.log('[LocationService] Check-in OK:', result.message);

                await AsyncStorage.setItem('lastAutoAction', JSON.stringify({
                    action: 'CHECK_IN',
                    timestamp: new Date().toISOString(),
                    message: result.message,
                }));

                if (AppState.currentState === 'active') {
                    Alert.alert(
                        'Auto Check-In ✓',
                        `Welcome! Checked in at ${new Date().toLocaleTimeString()}`,
                        [{ text: 'OK' }]
                    );
                }

                setTimeout(() => {
                    eventEmitter.emit('ATTENDANCE_UPDATED');
                }, 1500);

                setTimeout(() => {
                    attendanceService.clearStatusCache();
                }, 5000);

            } else {
                console.error('[LocationService] Check-in failed:', result.message);
                this.lastCheckInTime = 0;
            }
        } catch (error) {
            console.error('[LocationService] Check-in error:', error);
            this.lastCheckInTime = 0;
        }
    }

    async performCheckOut(employeeNumber, latitude, longitude) {
        try {
            console.log('[LocationService] Performing check-out...');
            const result = await attendanceService.checkOut(employeeNumber, latitude, longitude);

            if (result.success) {
                console.log('[LocationService] Check-out OK:', result.message);

                let durationMsg = '';
                if (result.data?.attendance?.durationMinutes) {
                    const mins = result.data.attendance.durationMinutes;
                    durationMsg = `\nTotal: ${Math.floor(mins / 60)}h ${mins % 60}m`;
                }

                await AsyncStorage.setItem('lastAutoAction', JSON.stringify({
                    action: 'CHECK_OUT',
                    timestamp: new Date().toISOString(),
                    duration: result.data?.attendance?.durationMinutes || 0,
                    message: result.message,
                }));

                if (AppState.currentState === 'active') {
                    Alert.alert(
                        'Auto Check-Out ✓',
                        `Checked out at ${new Date().toLocaleTimeString()}.${durationMsg}`,
                        [{ text: 'OK' }]
                    );
                }

                setTimeout(() => {
                    eventEmitter.emit('ATTENDANCE_UPDATED');
                }, 1500);

                setTimeout(() => {
                    attendanceService.clearAll();
                }, 5000);

            } else {
                console.error('[LocationService] Check-out failed:', result.message);
                this.lastCheckOutTime = 0;
            }
        } catch (error) {
            console.error('[LocationService] Check-out error:', error);
            this.lastCheckOutTime = 0;
        }
    }

    // ── App state changes ────────────────────────────────────────────────────

    handleAppStateChange(nextAppState) {
        console.log(`[LocationService] AppState: ${this.appState} → ${nextAppState}`);

        if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
            console.log('[LocationService] App foregrounded — refreshing');
            attendanceService.clearStatusCache();
            eventEmitter.emit('ATTENDANCE_UPDATED');
            this.getCurrentLocation();
        }

        this.appState = nextAppState;
    }

    // ── Stop ─────────────────────────────────────────────────────────────────
    // NOTE: call this only on LOGOUT.  Do NOT call it when the app backgrounds —
    // the background task keeps running independently even after stopTracking().

    stopTracking() {
        if (this.locationSubscription) {
            this.locationSubscription.remove();
            this.locationSubscription = null;
            this.isTracking = false;
            console.log('[LocationService] Foreground tracking stopped');
        }
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }
        if (this.midnightTimeout) {
            clearTimeout(this.midnightTimeout);
            this.midnightTimeout = null;
        }
    }

    // Call this on logout to stop EVERYTHING (foreground + background task).
    async stopAllTracking() {
        this.stopTracking();
        await this._stopBackgroundTask();
        console.log('[LocationService] All tracking stopped');
    }

    // ── Midnight rollover ────────────────────────────────────────────────────

    scheduleMidnightRollover() {
        if (this.midnightTimeout) clearTimeout(this.midnightTimeout);

        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 5, 0); // 00:00:05 tomorrow
        const ms = nextMidnight.getTime() - now.getTime();

        console.log(`[LocationService] Midnight rollover in ${Math.round(ms / 1000)}s`);
        this.midnightTimeout = setTimeout(() => this.handleMidnightRollover(), ms);
    }

    async handleMidnightRollover() {
        try {
            console.log('[LocationService] Midnight rollover');
            const userData = await AsyncStorage.getItem('userData');
            if (!userData) return;
            const { employeeNumber } = JSON.parse(userData);
            if (!employeeNumber) return;

            const status = await attendanceService.getCurrentStatus(employeeNumber);
            if (status !== 'CHECKED_IN') return;

            const location = await this.getCurrentLocation();
            const lat = location?.latitude ?? OFFICE_LOCATION.latitude;
            const lng = location?.longitude ?? OFFICE_LOCATION.longitude;

            console.log("[LocationService] Closing yesterday's session");
            await attendanceService.checkOut(employeeNumber, lat, lng);

            if (location?.isInside) {
                console.log("[LocationService] Still inside — opening today's session");
                this.lastCheckInTime = Date.now();
                this.wasInsideOffice = true;
                await this.performCheckIn(employeeNumber, lat, lng);
            } else {
                attendanceService.clearAll();
                this.wasInsideOffice = false;
                eventEmitter.emit('ATTENDANCE_UPDATED');
            }
        } catch (error) {
            console.error('[LocationService] Midnight rollover error:', error);
        } finally {
            this.scheduleMidnightRollover();
        }
    }

    // ── Utilities ────────────────────────────────────────────────────────────

    async _saveLastLocation(coords, distance, isInside) {
        await AsyncStorage.setItem('lastLocation', JSON.stringify({
            latitude: coords.latitude,
            longitude: coords.longitude,
            distance: Math.round(distance),
            isInside,
            timestamp: new Date().toISOString(),
        }));
    }

    async getCurrentLocation() {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') return null;

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const distance = calculateDistance(
                location.coords.latitude,
                location.coords.longitude,
                OFFICE_LOCATION.latitude,
                OFFICE_LOCATION.longitude
            );

            const result = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                distance: Math.round(distance),
                isInside: distance <= MAX_DISTANCE,
                timestamp: new Date().toISOString(),
            };

            await AsyncStorage.setItem('lastLocation', JSON.stringify(result));
            return result;
        } catch (error) {
            console.error('[LocationService] Error getting location:', error);
            return null;
        }
    }

    async getDistanceFromOffice() {
        const loc = await this.getCurrentLocation();
        return loc ? loc.distance : null;
    }

    async isInsideOffice() {
        const loc = await this.getCurrentLocation();
        return loc ? loc.isInside : false;
    }

    async getLastAutoAction() {
        try {
            const raw = await AsyncStorage.getItem('lastAutoAction');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    async clearLastAutoAction() {
        try { await AsyncStorage.removeItem('lastAutoAction'); } catch { }
    }
}

export default new LocationService();