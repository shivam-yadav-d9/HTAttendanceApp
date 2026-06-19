// services/geofence.task.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import { MAX_DISTANCE, OFFICE_LOCATION, calculateDistance } from '../utils/location';
import attendanceService from './attendance.service';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

const BG_COOLDOWN_MS = 60_000; // 60s between attempts

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Persist wasInside across bg firings (module-level vars reset each time) ──
async function getWasInside() {
    try {
        const raw = await AsyncStorage.getItem('bgTaskWasInside');
        if (raw === null) return null; // null = unknown (first run)
        return raw === 'true';
    } catch { return null; }
}

async function setWasInside(value) {
    try {
        await AsyncStorage.setItem('bgTaskWasInside', String(value));
    } catch { }
}

// ── Retry reading userData (fixes "No user" race condition) ──────────────────
async function getUserWithRetry(maxAttempts = 3, delayMs = 500) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const raw = await AsyncStorage.getItem('userData');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.employeeNumber) return parsed;
            }
        } catch (e) {
            console.error(`[BgTask] userData read attempt ${attempt} failed:`, e);
        }
        if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return null;
}

// ── Stale session detection ───────────────────────────────────────────────────
function isSessionStaleFromHistory(historyData) {
    if (!historyData?.length) return false;
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = historyData.find(r => r.date === today);
    if (!todayRecord || todayRecord.latestCheckOut) return false;
    if (todayRecord.oldestCheckIn) {
        const checkInDate = new Date(todayRecord.oldestCheckIn).toISOString().split('T')[0];
        if (checkInDate !== today) {
            console.log(`[BgTask] Stale session: checkIn ${checkInDate} ≠ today ${today}`);
            return true;
        }
    }
    return false;
}

// ── Task definition ───────────────────────────────────────────────────────────

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) { console.error('[BgTask] Error:', error.message); return; }
    if (!data?.locations?.length) return;

    const location = data.locations[0];
    if (!location) return;

    const { latitude, longitude } = location.coords;

    // ── Guard: need a logged-in user (with retry) ─────────────────────────────
    const user = await getUserWithRetry();
    if (!user) {
        console.log('[BgTask] No user → skipping');
        return;
    }
    const { employeeNumber } = user;

    // ── Geofence check ────────────────────────────────────────────────────────
    const distance = calculateDistance(
        latitude, longitude,
        OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude
    );
    const isInside = distance <= MAX_DISTANCE;
    const now = Date.now();

    console.log(`[BgTask] dist=${Math.round(distance)}m inside=${isInside}`);

    // ── Read persisted state ──────────────────────────────────────────────────
    const cooldowns = await getLastActionTimes();
    const wasInside = await getWasInside(); // null | true | false

    // ── Fetch status ──────────────────────────────────────────────────────────
    let isCheckedIn = false;
    let historyData = [];

    try {
        const cachedStatus = attendanceService.statusCache;
        const cacheAge = now - attendanceService.statusCacheTime;

        if (cachedStatus !== null && cacheAge < attendanceService.STATUS_CACHE_TTL) {
            isCheckedIn = cachedStatus === 'CHECKED_IN';
            console.log(`[BgTask] Status from cache: ${cachedStatus}`);
        } else {
            const history = await attendanceService.getAttendanceHistory(employeeNumber);
            historyData = history.data || [];

            // Stale session recovery
            if (isSessionStaleFromHistory(historyData)) {
                console.log('[BgTask] Stale session — recovering');
                await attendanceService.checkOut(employeeNumber, latitude, longitude);
                if (isInside) {
                    const checkin = await attendanceService.checkIn(employeeNumber, latitude, longitude);
                    console.log('[BgTask] Fresh check-in after recovery:', checkin.success);
                    await AsyncStorage.setItem('lastAutoAction', JSON.stringify({
                        action: 'CHECK_IN',
                        timestamp: new Date().toISOString(),
                        message: 'Auto checked in (session recovery)',
                    }));
                    await setLastActionTimes({ ...cooldowns, lastCheckIn: now });
                    await setWasInside(true);
                } else {
                    await setWasInside(false);
                }
                return;
            }

            isCheckedIn = attendanceService._deriveStatus(history) === 'CHECKED_IN';
        }
    } catch (e) {
        console.error('[BgTask] Could not get status:', e);
        return;
    }

    // ── Edge-based transitions (wasInside → isInside) ─────────────────────────
    // This is what enables re-entry auto check-in when app is closed.
    // wasInside=null means first run — treat as edge just happened if state matches.

    // ── Edge-based transitions (wasInside → isInside) ─────────────────────────
    // Improved for reliable re-entry when app is closed/killed
    const enteredOffice = isInside && (wasInside === false || wasInside === null);
    const exitedOffice = !isInside && (wasInside === true || wasInside === null);
    const firstRun = wasInside === null;

    console.log(`[BgTask] wasInside=${wasInside} | entered=${enteredOffice} | exited=${exitedOffice} | firstRun=${firstRun}`);

    // ── AUTO CHECK-IN ─────────────────────────────────────────────────────────
    if (isInside && !isCheckedIn && (enteredOffice || firstRun)) {
        if ((now - cooldowns.lastCheckIn) < BG_COOLDOWN_MS) {
            console.log(`[BgTask] Check-in cooldown active — skipping`);
            await setWasInside(isInside);
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
        await setWasInside(true);
        return;
    };

    // ── AUTO CHECK-OUT ────────────────────────────────────────────────────────
    if (!isInside && isCheckedIn && (exitedOffice || firstRun)) {
        if ((now - cooldowns.lastCheckOut) < BG_COOLDOWN_MS) {
            console.log(`[BgTask] Check-out cooldown active — skipping`);
            await setWasInside(isInside);
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
        await setWasInside(false);
        return;
    }

    // ── Update wasInside even when no action taken ────────────────────────────
    await setWasInside(isInside);
    console.log(`[BgTask] No action needed (inside=${isInside}, checkedIn=${isCheckedIn})`);
});