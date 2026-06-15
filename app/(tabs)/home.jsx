import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Dummy JSON data for dashboard metrics
const dashboardData = {
  todayTarget: 25000,
  totalTarget: 125000,
  achievedTarget: 85000,
  attendanceStatus: "P",
  totalCoursesEnrolled: 8,
  passPercentage: 78,
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(value);
}

export default function Home() {
  const [data, setData] = useState(dashboardData);

  // You can replace this with an actual API call later
  useEffect(() => {
    // Simulating API fetch
    // fetch('your-api-endpoint').then(res => res.json()).then(setData);
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.blobRight} />
        <View style={styles.blobLeft} />

        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={28} color="#fff" />
            <View style={styles.avatarBadge}>
              <Ionicons name="sparkles" size={8} color="#fff" />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Good Afternoon,</Text>
            <Text style={styles.name}>shivam yadav</Text>
            <View style={styles.badgeRow}>
              <View style={styles.staffBadge}>
                <Text style={styles.staffText}>STORE STAFF</Text>
              </View>
              <View style={styles.locationBadge}>
                <Ionicons name="location-outline" size={12} color="#fff" />
                <Text style={styles.locationText}>HomeTown Mumba...</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.notification}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>58%</Text>
            <Text style={styles.statLabel}>Learning</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>1</Text>
            <Text style={styles.statLabel}>Tasks</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>68%</Text>
            <Text style={styles.statLabel}>Targets</Text>
          </View>
        </View>
      </View>

      {/* METRICS SECTION - Three Rows with Two Cards Each */}
      <View style={styles.metricsSection}>
        {/* Row 1 */}
        <View style={styles.metricsRow}>
          {/* Today's Target Card */}
          <View style={styles.metricCard}>
            <View style={styles.metricIconContainer}>
              <Ionicons name="flag-outline" size={20} color="#D86A16" />
            </View>
            <Text style={styles.metricLabel}>Today's Target</Text>
            <Text style={styles.metricValue}>{formatCurrency(data.todayTarget)}</Text>
            <View style={styles.metricProgress}>
              <View style={[styles.metricProgressFill, { width: `${(data.achievedTarget / data.totalTarget) * 100}%` }]} />
            </View>
            <Text style={styles.metricSubtext}>Progress: {Math.round((data.achievedTarget / data.totalTarget) * 100)}%</Text>
          </View>

          {/* Total Target Card */}
          <View style={styles.metricCard}>
            <View style={styles.metricIconContainer}>
              <Ionicons name="stats-chart-outline" size={20} color="#1A5C3A" />
            </View>
            <Text style={styles.metricLabel}>Total Target</Text>
            <Text style={styles.metricValue}>{formatCurrency(data.totalTarget)}</Text>
            <Text style={styles.metricSubtext}>Overall Goal</Text>
          </View>
        </View>

        {/* Row 2 */}
        <View style={styles.metricsRow}>
          {/* Achieved Target Card */}
          <View style={styles.metricCard}>
            <View style={styles.metricIconContainer}>
              <Ionicons name="trophy-outline" size={20} color="#4A6FA5" />
            </View>
            <Text style={styles.metricLabel}>Achieved Target</Text>
            <Text style={styles.metricValue}>{formatCurrency(data.achievedTarget)}</Text>
            <Text style={styles.metricSubtext}>Out of {formatCurrency(data.totalTarget)}</Text>
          </View>

          {/* Attendance Status Card */}
          <View style={styles.metricCard}>
            <View style={styles.metricIconContainer}>
              <Ionicons name="calendar-check-outline" size={20} color="#D86A16" />
            </View>
            <Text style={styles.metricLabel}>Attendance Status</Text>
            <Text style={[styles.metricValue, { fontSize: 24 }]}>{data.attendanceStatus === "P" ? "✅" : "❌"}</Text>
            <Text style={[styles.metricSubtext, { color: data.attendanceStatus === "P" ? "#1A5C3A" : "#D86A16" }]}>
              {data.attendanceStatus === "P" ? "Present" : "Absent"}
            </Text>
          </View>
        </View>

        {/* Row 3 */}
        <View style={styles.metricsRow}>
          {/* Total Courses Enrolled Card */}
          <View style={styles.metricCard}>
            <View style={styles.metricIconContainer}>
              <Ionicons name="book-outline" size={20} color="#3355CC" />
            </View>
            <Text style={styles.metricLabel}>Total Courses Enrolled</Text>
            <Text style={styles.metricValue}>{data.totalCoursesEnrolled}</Text>
            <Text style={styles.metricSubtext}>Active Courses</Text>
          </View>

          {/* Pass Percentage Card */}
          <View style={styles.metricCard}>
            <View style={styles.metricIconContainer}>
              <Ionicons name="school-outline" size={20} color="#1A5C3A" />
            </View>
            <Text style={styles.metricLabel}>Pass Percentage</Text>
            <Text style={styles.metricValue}>{data.passPercentage}%</Text>
            <View style={styles.metricProgress}>
              <View style={[styles.metricProgressFill, { width: `${data.passPercentage}%`, backgroundColor: "#1A5C3A" }]} />
            </View>
            <Text style={styles.metricSubtext}>Overall Performance</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5EFE6",
  },

  // HEADER
  header: {
    backgroundColor: "#0F2D52",
    paddingTop: 55,
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
  },
  blobRight: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(100,60,20,0.45)",
    top: -20,
    right: -25,
  },
  blobLeft: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(80,40,10,0.3)",
    top: 55,
    right: 35,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    backgroundColor: "#D86A16",
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0F2D52",
  },
  greeting: {
    color: "#D5DCE5",
    fontSize: 12,
  },
  name: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 4,
    flexWrap: "wrap",
    gap: 5,
  },
  staffBadge: {
    backgroundColor: "#D86A16",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
  },
  staffText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 10,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 14,
  },
  locationText: {
    color: "#fff",
    fontSize: 10,
    marginLeft: 3,
  },
  notification: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D86A16",
    borderWidth: 1.5,
    borderColor: "#0F2D52",
  },
  statsCard: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    flexDirection: "row",
    paddingVertical: 10,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  divider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  statValue: {
    color: "#FFF4E2",
    fontSize: 18,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#D5DCE5",
    marginTop: 2,
    fontSize: 11,
  },

  // METRICS SECTION
  metricsSection: {
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 6,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  metricIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F7F9FC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: "600",
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  metricProgress: {
    height: 3,
    backgroundColor: "#F0F0F0",
    borderRadius: 2,
    marginTop: 4,
    marginBottom: 3,
  },
  metricProgressFill: {
    height: 3,
    backgroundColor: "#D86A16",
    borderRadius: 2,
  },
  metricSubtext: {
    fontSize: 9,
    color: "#999",
    marginTop: 2,
  },
});