import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import attendanceService from "../../services/attendance.service";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem("userData");
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } else {
        router.replace("/");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              attendanceService.clearAll();

              try {
                const locationService =
                  require("../../services/location.service").default;
                locationService?.stopTracking?.();
              } catch (e) { }

              await AsyncStorage.multiRemove([
                "role",
                "userToken",
                "userData",
                "savedCredentials",
                "employeeNumber",
              ]);

            router.replace("/");
            } catch (error) {
              console.log(error);
            }
          }
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D96A17" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
        </View>
        <Text style={styles.name}>{user?.name || "N/A"}</Text>
        <Text style={styles.designation}>{user?.jobTitle || user?.role || "Employee"}</Text>

      </View>

      {/* Store & Manager Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Store & Manager</Text>
        <InfoRow icon="storefront-outline" label="STORE" value={user?.location || user?.employeeLocationSAP || "N/A"} />
        <InfoRow icon="location-outline" label="STORE CODE · REGION" value={`${user?.siteCode || "N/A"} · ${user?.city || "N/A"}`} />
        <InfoRow icon="business-outline" label="CITY · STATE" value={`${user?.city || "N/A"} · ${user?.state || "N/A"}`} />
        <InfoRow icon="people-outline" label="REPORTING MANAGER" value={user?.reportingTo || "N/A"} />
        <InfoRow icon="mail-outline" label="MANAGER EMAIL" value={user?.reportingManagerEmail || "N/A"} />
      </View>

      {/* Employee Details Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Employee Details</Text>
        <InfoRow icon="card-outline" label="EMPLOYEE CODE" value={user?.employeeNumber || user?._id || "N/A"} />
        <InfoRow icon="call-outline" label="MOBILE" value={user?.phone?.toString() || "N/A"} />
        <InfoRow icon="mail-outline" label="EMAIL" value={user?.email || "N/A"} />
        <InfoRow icon="business-outline" label="DEPARTMENT" value={user?.department || "N/A"} />
        <InfoRow icon="briefcase-outline" label="DESIGNATION" value={user?.jobTitle || user?.role || "N/A"} />
        <InfoRow icon="calendar-outline" label="JOINING DATE" value={formatDate(user?.dateJoined)} />
      </View>

      {/* Additional Details Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Additional Information</Text>
        <InfoRow icon="location-outline" label="LOCATION" value={user?.employeeLocationSAP || user?.location || "N/A"} />
        <InfoRow icon="trending-up-outline" label="BAND" value={user?.band || "N/A"} />
        <InfoRow icon="person-outline" label="WORKER TYPE" value={user?.workerType || "N/A"} />
        <InfoRow icon="checkmark-circle-outline" label="EMPLOYMENT STATUS" value={user?.employmentStatus || "N/A"} />
        <InfoRow icon="home-outline" label="FORMAT" value={user?.format || "N/A"} />
        <InfoRow icon="layers-outline" label="SUB FORMAT" value={user?.subFormat || "N/A"} />
        <InfoRow icon="apps-outline" label="FUNCTIONS" value={user?.functions || "N/A"} />
        <InfoRow icon="options-outline" label="SUB FUNCTION" value={user?.subFunction || "N/A"} />
        <InfoRow icon="map-outline" label="EMPLOYEE ZONE" value={user?.employeeZone || "N/A"} />
        <InfoRow icon="cash-outline" label="COST CENTER NO" value={user?.costCenterNo || "N/A"} />
        <InfoRow icon="document-text-outline" label="COST CENTER DESCRIPTION" value={user?.costCenterDescription || "N/A"} />
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <MaterialIcons name="logout" size={20} color="#fff" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={18} color="#0F2D52" />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "N/A"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3EEE8"
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3EEE8",
  },
  header: {
    backgroundColor: "#0F2D52",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 45,
    backgroundColor: "#E67821",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "bold"
  },
  name: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 12
  },
  designation: {
    color: "#D7DFEA",
    fontSize: 15,
    marginTop: 4
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 11,
    borderRadius: 18,
    padding: 16,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F2D52",
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EEF3F8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: "#666",
    width: 110,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#222",
    flex: 1,
    textAlign: "right",
  },
  quickAccessRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
  },
  quickAccessBtn: {
    alignItems: "center",
    padding: 12,
    minWidth: 70,
  },
  quickAccessText: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#C0392B",
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 3,
  },
  logoutText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700"
  },
});