// services/geofence.task.js
//
// MUST be imported at app root (_layout.jsx) before anything else.
// Runs in a separate JS context when app is closed — no React, no eventEmitter.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import { MAX_DISTANCE, OFFICE_LOCATION, calculateDistance } from '../utils/location';
import attendanceService from './attendance.service';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

const BG_COOLDOWN_MS = 60_000; // 60s between check-in/out attempts

// ── Persist cooldown timestamps in AsyncStorage ──────────────────────────────
// Module-level vars reset every time Expo Go restarts the bg task JS context.
// AsyncStorage survives across firings, so we use it for cooldown state.

async function getLastActionTimes() {
    try {
        const raw = await AsyncStorage.getItem('bgTaskCooldowns');
        if (!raw) return { lastCheckIn: 0, lastCheckOut: 0 };
        return JSON.parse(raw);
    } catch { return { lastCheckIn: 0, lastCheckOut: 0 }; }
}

async function setLastActionTimes(times) {
    try {
        await AsyncStorage.setItem('bgTaskCooldowns', JSON.stringify(times));
    } catch { }
}

// ── Stale session detection (without relying on in-memory openSessionCheckIn) ─
// Looks at the history data directly: if today's record has a checkIn time
// that matches (or is very close to) a previous day's checkOut time, the
// backend never properly closed the old session.
function isSessionStaleFromHistory(historyData) {
    if (!historyData?.length) return false;

    const today = new Date().toISOString().split('T')[0];
    const todayRecord = historyData.find(r => r.date === today);
    if (!todayRecord || todayRecord.latestCheckOut) return false; // already closed, not stale

    // Check if the checkIn for today is from a PREVIOUS calendar day
    if (todayRecord.oldestCheckIn) {
        const checkInDate = new Date(todayRecord.oldestCheckIn).toISOString().split('T')[0];
        if (checkInDate !== today) {
            console.log(`[BgTask] Stale session: checkIn date ${checkInDate} ≠ today ${today}`);
            return true;
        }
    }

    return false;
}

// Pure status derivation — no service instance state (safe in bg context)
function deriveStatusFromHistory(historyData) {
    if (!historyData?.length) return 'CHECKED_OUT';
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = historyData.find(item => item.date === today);
    if (!todayRecord) return 'CHECKED_OUT';
    if (todayRecord.status === 'OPEN') return 'CHECKED_IN';
    if (todayRecord.oldestCheckIn && !todayRecord.latestCheckOut) return 'CHECKED_IN';
    return 'CHECKED_OUT';
}


TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
        console.error('[BgTask] Error:', error.message);
        return;
    }
    if (!data?.locations?.length) return;

    const location = data.locations[0];
    if (!location) return;

    const { latitude, longitude } = location.coords;

    // ── Guard: need a logged-in user ─────────────────────────────────────────
    let employeeNumber;
    try {
        const raw = await AsyncStorage.getItem('userData');
        if (!raw) { console.log('[BgTask] No user — skipping'); return; }
        employeeNumber = JSON.parse(raw).employeeNumber;
        if (!employeeNumber) return;
    } catch (e) {
        console.error('[BgTask] Could not read userData:', e);
        return;
    }

    // ── Geofence check ────────────────────────────────────────────────────────
    const distance = calculateDistance(
        latitude, longitude,
        OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude
    );
    const isInside = distance <= MAX_DISTANCE;
    const now = Date.now();

    console.log(`[BgTask] dist=${Math.round(distance)}m inside=${isInside}`);

    // ── Read cooldowns from AsyncStorage (survives JS context restarts) ───────
    const cooldowns = await getLastActionTimes();

    // ── Fetch history ONCE and derive everything from it ──────────────────────
    // This avoids double-fetching: status derivation + stale check both use same data.
    let historyData = [];
    let isCheckedIn = false;

    try {
        // Use cache if fresh (within 30s) — avoids API call on every bg firing
        const cachedStatus = attendanceService.statusCache;
        const cacheAge = now - attendanceService.statusCacheTime;

        if (cachedStatus !== null && cacheAge < attendanceService.STATUS_CACHE_TTL) {
            // Cache is fresh — use it, skip the API call
            isCheckedIn = cachedStatus === 'CHECKED_IN';
            console.log(`[BgTask] Status: ${cachedStatus} (cache, age=${Math.round(cacheAge / 1000)}s) — skipping API`);
        } else {
            // Cache stale — fetch from API
            const history = await attendanceService.getAttendanceHistory(employeeNumber);
            historyData = history.data || [];

            // ── Stale session recovery ────────────────────────────────────────
            // If today's open session checkIn is actually from yesterday,
            // close it and re-check-in if still inside.
            if (isSessionStaleFromHistory(historyData)) {
                console.log('[BgTask] Stale session detected — recovering');

                const checkout = await attendanceService.checkOut(employeeNumber, latitude, longitude);
                console.log('[BgTask] Stale checkout:', checkout.success);

                if (isInside) {
                    const checkin = await attendanceService.checkIn(employeeNumber, latitude, longitude);
                    console.log('[BgTask] Fresh check-in after recovery:', checkin.success);

                    await AsyncStorage.setItem('lastAutoAction', JSON.stringify({
                        action: 'CHECK_IN',
                        timestamp: new Date().toISOString(),
                        message: 'Auto checked in (session recovery)',
                    }));
                    await setLastActionTimes({ ...cooldowns, lastCheckIn: now });
                }
                return;
            }

            isCheckedIn = deriveStatusFromHistory(historyData) === 'CHECKED_IN';
        }
    } catch (e) {
        console.error('[BgTask] Could not get status:', e);
        return;
    }

    // ── AUTO CHECK-IN ─────────────────────────────────────────────────────────
    if (isInside && !isCheckedIn) {
        if ((now - cooldowns.lastCheckIn) < BG_COOLDOWN_MS) {
            console.log(`[BgTask] Check-in cooldown active — skipping (${Math.round((BG_COOLDOWN_MS - (now - cooldowns.lastCheckIn)) / 1000)}s left)`);
            return;
        }

        console.log('[BgTask] AUTO CHECK-IN triggered');
        try {
            const result = await attendanceService.checkIn(employeeNumber, latitude, longitude);
            console.log('[BgTask] Check-in:', result.success, result.message);

            await AsyncStorage.setItem('lastAutoAction', JSON.stringify({
                action: 'CHECK_IN',
                timestamp: new Date().toISOString(),
                message: result.message || 'Checked in automatically',
            }));
            await setLastActionTimes({ ...cooldowns, lastCheckIn: now });
        } catch (e) {
            console.error('[BgTask] Check-in error:', e);
        }
        return;
    }

    // ── AUTO CHECK-OUT ────────────────────────────────────────────────────────
    if (!isInside && isCheckedIn) {
        if ((now - cooldowns.lastCheckOut) < BG_COOLDOWN_MS) {
            console.log(`[BgTask] Check-out cooldown active — skipping`);
            return;
        }

        console.log('[BgTask] AUTO CHECK-OUT triggered');
        try {
            const result = await attendanceService.checkOut(employeeNumber, latitude, longitude);
            console.log('[BgTask] Check-out:', result.success, result.message);

            await AsyncStorage.setItem('lastAutoAction', JSON.stringify({
                action: 'CHECK_OUT',
                timestamp: new Date().toISOString(),
                message: result.message || 'Checked out automatically',
                duration: result.data?.attendance?.durationMinutes || 0,
            }));
            await setLastActionTimes({ ...cooldowns, lastCheckOut: now });
        } catch (e) {
            console.error('[BgTask] Check-out error:', e);
        }
        return;
    }

    // Already in correct state — no action needed
    console.log(`[BgTask] No action needed (inside=${isInside}, checkedIn=${isCheckedIn})`);
});