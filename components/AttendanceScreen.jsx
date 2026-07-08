// app/(tabs)/attend.jsx
//
// ⚠️  This screen does NOT own tracking — _layout.jsx does.
//     attend.jsx only LISTENS to events and reads data.
//     Never call locationService.startTracking() or stopTracking() here.

import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import attendanceService from "../services/attendance.service";
import eventEmitter from "../services/eventEmitter";
import locationService from "../services/location.service";

// ─── helpers ────────────────────────────────────────────────────────────────

const formatTime = (dateString) => {
  if (!dateString) return "--:--";
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDate = (dateString) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const computeLiveDuration = (todayAttendance, isCheckedIn, activeCheckIn) => {
  if (!isCheckedIn) {
    if (!todayAttendance) return "0h 0m";
    const mins = todayAttendance.totalDurationMinutes || 0;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }
  const checkInISO = activeCheckIn || todayAttendance?.oldestCheckIn;
  if (!checkInISO) return "0h 0m 0s";

  const elapsedSec = Math.floor(
    (Date.now() - new Date(checkInISO).getTime()) / 1000
  );
  const closedMins = todayAttendance?.totalDurationMinutes || 0;
  const totalSec = closedMins * 60 + elapsedSec;

  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
};

// ─── component ──────────────────────────────────────────────────────────────

export default function Attend() {
  const [user, setUser] = useState(null);
  const [distance, setDistance] = useState(0);
  const [isInsideOffice, setIsInsideOffice] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("CHECKED_OUT");
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);
  // ✅ FIX: Start with loading=false so cached data shows immediately
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [activeCheckIn, setActiveCheckIn] = useState(null);

  const [liveDuration, setLiveDuration] = useState("0h 0m 0s");
  const timerRef = useRef(null);
  const todayRef = useRef(null);
  const activeCheckInRef = useRef(null);
  const refreshAttendanceDataRef = useRef(null);

  // ── timer ────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setLiveDuration(
        computeLiveDuration(todayRef.current, true, activeCheckInRef.current)
      );
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    todayRef.current = todayAttendance;
    activeCheckInRef.current = activeCheckIn;

    if (
      currentStatus === "CHECKED_IN" &&
      (activeCheckIn || todayAttendance?.oldestCheckIn)
    ) {
      setLiveDuration(
        computeLiveDuration(todayAttendance, true, activeCheckIn)
      );
      startTimer();
    } else {
      stopTimer();
      setLiveDuration(computeLiveDuration(todayAttendance, false, null));
    }
  }, [currentStatus, todayAttendance, activeCheckIn, startTimer, stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── STEP 1: Load from in-memory cache instantly (no API call) ────────────
  const loadFromCache = useCallback(async () => {
    try {
      // Use whatever attendanceService already has in memory
      const cachedStatus = attendanceService.statusCache;
      const cachedOpenSession = attendanceService.openSessionCheckIn;

      if (cachedStatus) {
        setCurrentStatus(cachedStatus);
      }

      if (cachedOpenSession) {
        setActiveCheckIn(cachedOpenSession);
        const today = new Date().toISOString().split("T")[0];
        const isToday =
          new Date(cachedOpenSession).toISOString().split("T")[0] === today;
        if (isToday && cachedStatus === "CHECKED_IN") {
          setTodayAttendance({
            date: today,
            oldestCheckIn: cachedOpenSession,
            latestCheckOut: null,
            totalDurationMinutes: 0,
            totalSessions: 1,
            totalDurationFormatted: "0h 0m",
            status: "OPEN",
          });
        }
      }

      // Also load last known location from AsyncStorage (instant, no GPS call)
      const lastLocRaw = await AsyncStorage.getItem("lastLocation");
      if (lastLocRaw) {
        const lastLoc = JSON.parse(lastLocRaw);
        setDistance(lastLoc.distance || 0);
        setIsInsideOffice(lastLoc.isInside || false);
      }
    } catch (e) {
      console.log("[Attend] Cache load error (non-fatal):", e);
    }
  }, []);

  // ── STEP 2: Fetch fresh data from API in background ──────────────────────
  const refreshAttendanceData = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem("userData");
      if (!userData) return;
      const parsedUser = JSON.parse(userData);
      const employeeNumber = parsedUser.employeeNumber;
      if (!employeeNumber) return;

      // ✅ FIX: Run history fetch and location in parallel, don't await GPS
      const [history] = await Promise.all([
        attendanceService.getAttendanceHistory(employeeNumber),
      ]);

      const today = new Date().toISOString().split("T")[0];
      const todayRecord = history.success
        ? history.data.find((a) => a.date === today) || null
        : null;

      let status;
      if (
        attendanceService.statusCache !== null &&
        Date.now() - attendanceService.statusCacheTime <
        attendanceService.STATUS_CACHE_TTL
      ) {
        status = attendanceService.statusCache;
      } else {
        status = attendanceService._deriveStatus(history);
      }

      const openSession = attendanceService.openSessionCheckIn;
      const openSessionIsToday =
        !!openSession &&
        new Date(openSession).toISOString().split("T")[0] === today;

      const effectiveTodayRecord =
        todayRecord ||
        (status === "CHECKED_IN" && openSession && openSessionIsToday
          ? {
            date: today,
            oldestCheckIn: openSession,
            latestCheckOut: null,
            totalDurationMinutes: 0,
            totalSessions: 1,
            totalDurationFormatted: "0h 0m",
            status: "OPEN",
          }
          : null);

      setCurrentStatus(status);
      setTodayAttendance(effectiveTodayRecord);
      setActiveCheckIn(openSessionIsToday ? openSession : null);
      if (history.success) setAttendanceHistory(history.data);

      // ✅ FIX: Fetch GPS location separately AFTER UI is updated
      //    so it doesn't block the history from rendering
      locationService.getCurrentLocation().then((location) => {
        if (location) {
          setDistance(location.distance);
          setIsInsideOffice(location.isInside);
        }
      });
    } catch (error) {
      console.error("[Attend] Error refreshing:", error);
    }
  }, []);

  useEffect(() => {
    refreshAttendanceDataRef.current = refreshAttendanceData;
  }, [refreshAttendanceData]);

  // ── init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleAttendanceUpdate = () => {
      console.log("[Attend] ATTENDANCE_UPDATED received");
      refreshAttendanceDataRef.current?.();
    };

    const handleLocationUpdate = (data) => {
      setDistance(data.distance);
      setIsInsideOffice(data.isInside);
    };

    const init = async () => {
      try {
        const userData = await AsyncStorage.getItem("userData");
        if (!userData) {
          router.replace("/");
          return;
        }
        setUser(JSON.parse(userData));

        // ✅ FIX: Show cached data FIRST (instant), then fetch fresh in background
        await loadFromCache();           // ~0ms — reads memory + AsyncStorage
        refreshAttendanceData();         // non-blocking — updates UI when ready
      } catch (error) {
        console.error("[Attend] Init error:", error);
      }
      // ✅ FIX: No setLoading(false) needed — loading starts as false
    };

    eventEmitter.on("ATTENDANCE_UPDATED", handleAttendanceUpdate);
    eventEmitter.on("LOCATION_UPDATED", handleLocationUpdate);
    init();

    return () => {
      eventEmitter.off("ATTENDANCE_UPDATED", handleAttendanceUpdate);
      eventEmitter.off("LOCATION_UPDATED", handleLocationUpdate);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    attendanceService.clearStatusCache();
    await refreshAttendanceData();
    setRefreshing(false);
  }, [refreshAttendanceData]);

  // ── derived ──────────────────────────────────────────────────────────────
  const isCheckedIn = currentStatus === "CHECKED_IN";
  const statusColor = isCheckedIn ? "#10B981" : "#EF4444";
  const statusLabel = isCheckedIn ? "Checked In" : "Not In";

  const todayDisplayStatus = isCheckedIn
    ? "Present"
    : todayAttendance?.latestCheckOut
      ? "Present"
      : todayAttendance?.oldestCheckIn
        ? "Present"
        : todayAttendance?.status || "Absent";

  const sortedHistory = [...attendanceHistory].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  // ── render ───────────────────────────────────────────────────────────────
  // ✅ FIX: Removed loading spinner entirely — skeleton/cache shows instantly.
  //    Pull-to-refresh handles manual reloads.

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTag}>ATTENDANCE HUB</Text>
        <Text style={styles.headerTitle}>My Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          Track attendance and office status
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <MaterialIcons name="access-time" size={24} color="#D96A17" />
          <Text style={styles.statLabel}>Status</Text>
          <Text style={[styles.statValue, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="calendar-today" size={24} color="#D96A17" />
          <Text style={styles.statLabel}>Today</Text>
          <Text style={styles.statValue}>
            {new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })}
          </Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons
            name={isInsideOffice ? "location-on" : "location-off"}
            size={24}
            color={isInsideOffice ? "#10B981" : "#D96A17"}
          />
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{Math.round(distance)}m</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Today's Session</Text>

      {todayAttendance ? (
        <View style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionDate}>
              {todayAttendance.date || new Date().toISOString().split("T")[0]}
            </Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: isCheckedIn ? "#D1FAE5" : "#FEE2E2" },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: statusColor }]}
              />
              <Text style={[styles.statusPillText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          <View style={styles.durationBlock}>
            <MaterialIcons name="timer" size={20} color="#D96A17" />
            <Text style={styles.durationLabel}>
              {isCheckedIn ? "Time in office" : "Total duration"}
            </Text>
            <Text style={styles.durationValue}>{liveDuration}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.sessionDetail}>
            <MaterialIcons name="login" size={16} color="#6B7280" />
            <Text style={styles.sessionLabel}>Check In</Text>
            <Text style={styles.sessionValue}>
              {isCheckedIn && activeCheckIn
                ? formatTime(activeCheckIn)
                : formatTime(todayAttendance.oldestCheckIn)}
            </Text>
          </View>

          <View style={styles.sessionDetail}>
            <MaterialIcons
              name="logout"
              size={16}
              color={isCheckedIn ? "#D1D5DB" : "#6B7280"}
            />
            <Text style={styles.sessionLabel}>Check Out</Text>
            <Text
              style={[
                styles.sessionValue,
                isCheckedIn && { color: "#9CA3AF" },
              ]}
            >
              {isCheckedIn
                ? "Active session"
                : todayAttendance.latestCheckOut
                  ? formatTime(todayAttendance.latestCheckOut)
                  : "—"}
            </Text>
          </View>

          <View style={styles.sessionDetail}>
            <MaterialIcons name="repeat" size={16} color="#6B7280" />
            <Text style={styles.sessionLabel}>Sessions</Text>
            <Text style={styles.sessionValue}>
              {todayAttendance.totalSessions || 1}
            </Text>
          </View>

          <View style={styles.sessionDetail}>
            <MaterialIcons name="event-available" size={16} color="#6B7280" />
            <Text style={styles.sessionLabel}>Day Status</Text>
            <Text
              style={[
                styles.sessionValue,
                {
                  color:
                    todayDisplayStatus === "Present" ? "#10B981" : "#EF4444",
                  fontWeight: "600",
                },
              ]}
            >
              {todayDisplayStatus}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <MaterialIcons name="event-busy" size={32} color="#D1D5DB" />
          <Text style={styles.emptyText}>No attendance recorded today</Text>
          <Text style={styles.emptySubText}>
            Auto check-in activates when you enter the office
          </Text>
        </View>
      )}

      <View style={styles.autoCard}>
        <MaterialIcons name="gps-fixed" size={20} color="#D96A17" />
        <Text style={styles.autoText}>
          Auto tracking active — checked in/out automatically as you enter or
          leave the office. Re-entry triggers a new session.
        </Text>
      </View>

      {attendanceHistory.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent History</Text>
          {sortedHistory
            .slice(0, visibleCount)
            .map((record, index) => {
              const displayStatus =
                record.oldestCheckIn ? "Present" : record.status;
              const isPresent = displayStatus === "Present";
              return (
                <View key={index} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyDate}>
                      {formatDate(record.date)}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {record.totalSessions || 1} session
                      {(record.totalSessions || 1) !== 1 ? "s" : ""}
                      {" · "}
                      {formatTime(record.oldestCheckIn)}
                      {record.latestCheckOut
                        ? ` – ${formatTime(record.latestCheckOut)}`
                        : " – ongoing"}
                    </Text>
                  </View>
                  <View style={styles.historyRight}>
                    <View
                      style={[
                        styles.historyBadge,
                        { backgroundColor: isPresent ? "#D1FAE5" : "#FEE2E2" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.historyBadgeText,
                          { color: isPresent ? "#065F46" : "#991B1B" },
                        ]}
                      >
                        {displayStatus}
                      </Text>
                    </View>
                    <Text style={styles.historyDuration}>
                      {record.totalDurationFormatted || "0h 0m"}
                    </Text>
                  </View>
                </View>
              );
            })}

          {sortedHistory.length > visibleCount && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() =>
                setVisibleCount(prev => prev + 10)
              }
            >
              <MaterialIcons
                name="expand-more"
                size={40}
                color="#D96A17"
              />
              <Text style={styles.loadMoreText}>
                Show More
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  header: {
    backgroundColor: "#0B2D52",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTag: {
    color: "#D96A17",
    fontWeight: "700",
    letterSpacing: 1,
    fontSize: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 8,
  },
  headerSubtitle: { color: "#D1D5DB", fontSize: 14, marginTop: 4 },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: -10,
  },
  statCard: {
    backgroundColor: "#fff",
    flex: 1,
    marginHorizontal: 5,
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statLabel: { fontSize: 12, color: "#6B7280", marginTop: 8 },
  statValue: {
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 4,
    textAlign: "center",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },

  sessionCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    padding: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sessionDate: { fontSize: 16, fontWeight: "bold", color: "#111827" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 13, fontWeight: "600" },

  durationBlock: {
    backgroundColor: "#FFF4EC",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  durationLabel: { flex: 1, fontSize: 13, color: "#92400E", fontWeight: "500" },
  durationValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#D96A17",
    fontVariant: ["tabular-nums"],
  },

  divider: { height: 1, backgroundColor: "#F3F4F6", marginBottom: 12 },
  sessionDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sessionLabel: { flex: 1, fontSize: 13, color: "#6B7280" },
  sessionValue: { fontSize: 13, fontWeight: "600", color: "#111827" },

  emptyCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
    elevation: 2,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 6,
    textAlign: "center",
  },

  autoCard: {
    backgroundColor: "#FFF4EC",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  autoText: { flex: 1, fontSize: 12, color: "#D96A17", lineHeight: 18 },

  historyCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  historyLeft: { flex: 1, gap: 4 },
  historyDate: { fontSize: 14, fontWeight: "600", color: "#111827" },
  historyMeta: { fontSize: 12, color: "#9CA3AF" },
  historyRight: { alignItems: "flex-end", gap: 6 },
  historyBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  historyBadgeText: { fontSize: 12, fontWeight: "600" },
  historyDuration: { fontSize: 12, color: "#6B7280", fontWeight: "500" },

  loadMoreBtn: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },

  loadMoreText: {
    color: "#D96A17",
    fontWeight: "600",
  },
});