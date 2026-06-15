import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Alert, AppState, Platform } from 'react-native';
import { MAX_DISTANCE, OFFICE_LOCATION, calculateDistance } from '../utils/location';
import attendanceService from './attendance.service';
import eventEmitter from './eventEmitter';

class LocationService {
    constructor() {
        this.locationSubscription = null;
        this.isTracking = false;
        this.appState = AppState.currentState;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.isProcessing = false;
        this.lastCheckInTime = 0;
        this.lastCheckOutTime = 0;
        // Cooldowns prevent duplicate API calls for the same transition
        // Cooldowns prevent duplicate API calls for the same transition
        this.CHECK_IN_COOLDOWN = 30000;   // 30 seconds
        this.CHECK_OUT_COOLDOWN = 30000;  // 30 seconds
        this.STALE_RECOVERY_COOLDOWN = 30000; // 30 seconds
        this.lastStaleRecoveryTime = 0;
        // Track last known inside/outside state to detect transitions
        // null = unknown (first run), true = was inside, false = was outside
        this.wasInsideOffice = null;

        // Timer that fires at local midnight to roll the day over
        this.midnightTimeout = null;
    }

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

            const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
            if (fgStatus !== 'granted') {
                console.log('[LocationService] Foreground permission denied');
                Alert.alert(
                    'Permission Required',
                    'Please allow location access for attendance tracking. You can enable it in Settings.'
                );
                return false;
            }

            if (Platform.OS === 'android') {
                const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
                if (bgStatus !== 'granted') {
                    console.log('[LocationService] Background permission denied');
                    Alert.alert(
                        'Background Location Required',
                        'Please allow background location access for automatic attendance tracking.',
                        [{ text: 'OK' }]
                    );
                }
            }

            this.locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 1000,  // Every 10 seconds
                    distanceInterval: 1, // Or every 15 meters moved
                },
                this.handleLocationUpdate.bind(this)
            );

            this.isTracking = true;
            console.log('[LocationService] Tracking started');
            this.appStateSubscription = AppState.addEventListener(
                'change',
                this.handleAppStateChange.bind(this)
            );

            // Close out today's session and open tomorrow's, right at midnight.
            this.scheduleMidnightRollover();

            // Kick off an immediate location check
            await this.getCurrentLocation();
            return true;

        } catch (error) {
            console.error('[LocationService] Failed to start tracking:', error);
            this.isTracking = false;
            return false;
        }
    }

    async handleLocationUpdate(location) {
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
            if (!employeeNumber) {
                console.log('[LocationService] No employee number found');
                return;
            }

            const distance = calculateDistance(
                location.coords.latitude,
                location.coords.longitude,
                OFFICE_LOCATION.latitude,
                OFFICE_LOCATION.longitude
            );

            const isInsideOffice = distance <= MAX_DISTANCE;
            const now = Date.now();

            // Push live distance/inside-office info to the UI immediately —
            // don't wait on the attendance status fetch below, so the
            // "Distance" card updates on every GPS tick in real time.
            eventEmitter.emit('LOCATION_UPDATED', {
                distance: Math.round(distance),
                isInside: isInsideOffice,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: new Date().toISOString(),
            });

            // Get current attendance status (uses cache when available)
            const currentStatus = await attendanceService.getCurrentStatus(employeeNumber);
            const isCheckedIn = currentStatus === 'CHECKED_IN';

            console.log(
                `[LocationService] distance=${Math.round(distance)}m, inside=${isInsideOffice}, ` +
                `checkedIn=${isCheckedIn}, wasInside=${this.wasInsideOffice}`
            );

            // ── STALE SESSION RECOVERY ────────────────────────────────────────────
            // "Checked in" via an open session from a PREVIOUS day — backend never
            // closed it (background tracking probably got killed before auto-checkout
            // fired). Close it out, then immediately re-check-in so today's attendance
            // starts a fresh, correctly-dated session.
            if (
                isCheckedIn &&
                attendanceService.isOpenSessionStale() &&
                (now - this.lastStaleRecoveryTime) > this.STALE_RECOVERY_COOLDOWN
            ) {
                console.log('[LocationService] Stale open session detected — recovering...');
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

                await AsyncStorage.setItem('lastLocation', JSON.stringify({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    distance: Math.round(distance),
                    isInside: isInsideOffice,
                    timestamp: new Date().toISOString(),
                }));

                this.retryCount = 0;
                return;
            }

            // ── AUTO CHECK-IN ──────────────────────────────────────────────────────

            // ── AUTO CHECK-IN ──────────────────────────────────────────────────────
            // Trigger when:
            //   1. Currently inside office range
            //   2. Not already checked in
            //   3. Cooldown has elapsed since last check-in attempt
            //
            // This also handles the "user left and came back" scenario:
            //   After a checkout, isCheckedIn becomes false, so the next time
            //   they re-enter the geofence this block fires again automatically.
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
            // ── AUTO CHECK-OUT ─────────────────────────────────────────────────────
            // Trigger when:
            //   1. Currently outside office range
            //   2. Still checked in
            //   3. Cooldown has elapsed since last check-out attempt
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
                // No transition — just update the last known state
                this.wasInsideOffice = isInsideOffice;
            }

            // Persist last known location for the UI
            await AsyncStorage.setItem('lastLocation', JSON.stringify({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                distance: Math.round(distance),
                isInside: isInsideOffice,
                timestamp: new Date().toISOString(),
            }));

            this.retryCount = 0;

        } catch (error) {
            console.error('[LocationService] Error handling location update:', error);
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`[LocationService] Retrying (${this.retryCount}/${this.maxRetries})...`);
                setTimeout(() => {
                    this.handleLocationUpdate(location);
                }, 2000 * this.retryCount);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    async performCheckIn(employeeNumber, latitude, longitude) {
        try {
            console.log('[LocationService] Performing check-in...');
            const result = await attendanceService.checkIn(employeeNumber, latitude, longitude);

            if (result.success) {
                console.log('[LocationService] Check-in successful:', result.message);

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

                // Step 1 — let the UI refresh while cache still says CHECKED_IN
                // (openSessionCheckIn is now set inside attendanceService, so
                //  getCurrentStatus will return CHECKED_IN even after cache clears)
                setTimeout(() => {
                    console.log('[LocationService] Emitting ATTENDANCE_UPDATED after check-in');
                    eventEmitter.emit('ATTENDANCE_UPDATED');
                }, 1500);

                // Step 2 — clear the TTL-based cache AFTER the refresh has run,
                // so future location ticks re-derive status from the API cleanly
                setTimeout(() => {
                    attendanceService.clearStatusCache();
                }, 5000);

            } else {
                console.error('[LocationService] Check-in failed:', result.message);
                // Reset cooldown so we can retry sooner on failure
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
                console.log('[LocationService] Check-out successful:', result.message);

                let durationMsg = '';
                if (result.data?.attendance?.durationMinutes) {
                    const mins = result.data.attendance.durationMinutes;
                    const hours = Math.floor(mins / 60);
                    const minutes = mins % 60;
                    durationMsg = `\nTotal duration: ${hours}h ${minutes}m`;
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

                // Step 1 — refresh UI while cache still says CHECKED_OUT
                setTimeout(() => {
                    console.log('[LocationService] Emitting ATTENDANCE_UPDATED after check-out');
                    eventEmitter.emit('ATTENDANCE_UPDATED');
                }, 1500);

                // Step 2 — clear everything after refresh; next location tick
                // fetches fresh status; re-entry will auto check-in again
                setTimeout(() => {
                    attendanceService.clearAll();
                }, 5000);

            } else {
                console.error('[LocationService] Check-out failed:', result.message);
                // Reset cooldown so we can retry sooner on failure
                this.lastCheckOutTime = 0;
            }
        } catch (error) {
            console.error('[LocationService] Check-out error:', error);
            this.lastCheckOutTime = 0;
        }
    }

    handleAppStateChange(nextAppState) {
        console.log(`[LocationService] App state: ${this.appState} → ${nextAppState}`);

        if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
            console.log('[LocationService] App foregrounded — refreshing');
            // Clear cache so foregrounded app gets fresh data
            attendanceService.clearStatusCache();
            eventEmitter.emit('ATTENDANCE_UPDATED');

            this.getCurrentLocation().then(location => {
                if (location) {
                    console.log('[LocationService] Location on foreground:', location);
                }
            });
        }

        this.appState = nextAppState;
    }
    stopTracking() {
        if (this.locationSubscription) {
            this.locationSubscription.remove();
            this.locationSubscription = null;
            this.isTracking = false;
            console.log('[LocationService] Tracking stopped');
        }
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
        }
        if (this.midnightTimeout) {
            clearTimeout(this.midnightTimeout);
            this.midnightTimeout = null;
        }
    }

    // ── Midnight rollover ───────────────────────────────────────────────────
    // At local midnight, close out any still-open session (so a single shift
    // never bleeds into the next day) and, if the user is still inside the
    // office, immediately open a fresh session for the new day.
    scheduleMidnightRollover() {
        if (this.midnightTimeout) {
            clearTimeout(this.midnightTimeout);
        }

        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 5, 0); // 00:00:05 tomorrow — small buffer past midnight
        const msUntilMidnight = nextMidnight.getTime() - now.getTime();

        console.log(`[LocationService] Midnight rollover scheduled in ${Math.round(msUntilMidnight / 1000)}s`);

        this.midnightTimeout = setTimeout(() => {
            this.handleMidnightRollover();
        }, msUntilMidnight);
    }

    async handleMidnightRollover() {
        try {
            console.log('[LocationService] Midnight rollover triggered');

            const userData = await AsyncStorage.getItem('userData');
            if (!userData) return;

            const user = JSON.parse(userData);
            const employeeNumber = user.employeeNumber;
            if (!employeeNumber) return;

            const currentStatus = await attendanceService.getCurrentStatus(employeeNumber);

            if (currentStatus === 'CHECKED_IN') {
                const location = await this.getCurrentLocation();
                const lat = location?.latitude ?? OFFICE_LOCATION.latitude;
                const lng = location?.longitude ?? OFFICE_LOCATION.longitude;

                console.log("[LocationService] Closing yesterday's session at midnight");
                await attendanceService.checkOut(employeeNumber, lat, lng);

                if (location?.isInside) {
                    console.log("[LocationService] Still inside office — starting today's session");
                    this.lastCheckInTime = Date.now();
                    this.wasInsideOffice = true;
                    await this.performCheckIn(employeeNumber, lat, lng);
                } else {
                    attendanceService.clearAll();
                    this.wasInsideOffice = false;
                    eventEmitter.emit('ATTENDANCE_UPDATED');
                }
            }
        } catch (error) {
            console.error('[LocationService] Midnight rollover error:', error);
        } finally {
            // Always reschedule for the next midnight, win or lose
            this.scheduleMidnightRollover();
        }
    }

    async getCurrentLocation() {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('[LocationService] Permission not granted');
                return null;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
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
        const location = await this.getCurrentLocation();
        return location ? location.distance : null;
    }

    async isInsideOffice() {
        const location = await this.getCurrentLocation();
        return location ? location.isInside : false;
    }

    async getLastAutoAction() {
        try {
            const lastAction = await AsyncStorage.getItem('lastAutoAction');
            return lastAction ? JSON.parse(lastAction) : null;
        } catch (error) {
            console.error('[LocationService] Error getting last action:', error);
            return null;
        }
    }

    async clearLastAutoAction() {
        try {
            await AsyncStorage.removeItem('lastAutoAction');
        } catch (error) {
            console.error('[LocationService] Error clearing last action:', error);
        }
    }
}

export default new LocationService();