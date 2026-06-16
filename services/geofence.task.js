// services/geofence.task.js
//
// This file MUST be imported at the root of your app (e.g. _layout.tsx)
// so the task is registered before Expo tries to run it in the background.
//
// TaskManager.defineTask() runs in a separate JS context when the app is
// closed — no React state, no event emitter, no UI.  Keep it lean:
// AsyncStorage + attendanceService only.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import { MAX_DISTANCE, OFFICE_LOCATION, calculateDistance } from '../utils/location';
import attendanceService from './attendance.service';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

// In-memory cooldowns (survive within a single background-task session).
// Using module-level vars because the task closure is the same JS context
// across repeated background firings while the app stays killed.
let lastBgCheckInTime  = 0;
let lastBgCheckOutTime = 0;
const BG_COOLDOWN_MS   = 60_000; // 60 s — more generous than foreground (30 s)

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
        console.error('[BgTask] Error:', error.message);
        return;
    }

    if (!data?.locations?.length) return;

    const location = data.locations[0];
    if (!location) return;

    const { latitude, longitude } = location.coords;

    // ── Guard: need a logged-in user ─────────────────────────────────────
    let employeeNumber;
    try {
        const raw = await AsyncStorage.getItem('userData');
        if (!raw) {
            console.log('[BgTask] No user — skipping');
            return;
        }
        const user = JSON.parse(raw);
        employeeNumber = user.employeeNumber;
        if (!employeeNumber) return;
    } catch (e) {
        console.error('[BgTask] Could not read userData:', e);
        return;
    }

    // ── Geofence check ───────────────────────────────────────────────────
    const distance = calculateDistance(
        latitude, longitude,
        OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude
    );
    const isInside = distance <= MAX_DISTANCE;
    const now = Date.now();

    console.log(
        `[BgTask] lat=${latitude.toFixed(5)} lng=${longitude.toFixed(5)} ` +
        `dist=${Math.round(distance)}m inside=${isInside}`
    );

    // ── Derive current status (cache-aware) ──────────────────────────────
    let isCheckedIn = false;
    try {
        const status = await attendanceService.getCurrentStatus(employeeNumber);
        isCheckedIn = status === 'CHECKED_IN';
    } catch (e) {
        console.error('[BgTask] Could not get status:', e);
        return;
    }

    // ── AUTO CHECK-IN ────────────────────────────────────────────────────
    if (isInside && !isCheckedIn && (now - lastBgCheckInTime) > BG_COOLDOWN_MS) {
        console.log('[BgTask] Triggering AUTO CHECK-IN');
        lastBgCheckInTime = now;
        try {
            const result = await attendanceService.checkIn(employeeNumber, latitude, longitude);
            console.log('[BgTask] Check-in result:', result.success, result.message);

            // Persist a notification payload so the foreground can show a banner
            // on next app open, even if it missed the check-in live.
            await AsyncStorage.setItem('lastAutoAction', JSON.stringify({
                action: 'CHECK_IN',
                timestamp: new Date().toISOString(),
                message: result.message || 'Checked in automatically',
            }));
        } catch (e) {
            console.error('[BgTask] Check-in error:', e);
            lastBgCheckInTime = 0; // allow retry
        }
        return;
    }

    // ── AUTO CHECK-OUT ───────────────────────────────────────────────────
    if (!isInside && isCheckedIn && (now - lastBgCheckOutTime) > BG_COOLDOWN_MS) {
        console.log('[BgTask] Triggering AUTO CHECK-OUT');
        lastBgCheckOutTime = now;
        try {
            const result = await attendanceService.checkOut(employeeNumber, latitude, longitude);
            console.log('[BgTask] Check-out result:', result.success, result.message);

            await AsyncStorage.setItem('lastAutoAction', JSON.stringify({
                action: 'CHECK_OUT',
                timestamp: new Date().toISOString(),
                message: result.message || 'Checked out automatically',
                duration: result.data?.attendance?.durationMinutes || 0,
            }));
        } catch (e) {
            console.error('[BgTask] Check-out error:', e);
            lastBgCheckOutTime = 0;
        }
    }
});