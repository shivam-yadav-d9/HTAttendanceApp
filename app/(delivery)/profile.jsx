import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BLUE = "#0B2540";
const BLUE_LIGHT = "#E8F0FE";

const SETTINGS = [
    { icon: "lock", label: "Change Password" },
    { icon: "settings", label: "App Settings" },
];

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
                setUser(JSON.parse(userData));
            } else {
                router.replace("/");
            }
        } catch (error) {
            console.log("Error loading user data:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        if (isNaN(date)) return "N/A";
        return date.toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const getInitials = (name) => {
        if (!name) return "D";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const handleLogout = () => {
        Alert.alert("Logout", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                    try {
                        try {
                            const locationService =
                                require("../../services/location.service").default;
                            locationService?.stopTracking?.();
                        } catch (e) {}

                        await AsyncStorage.clear();

                        router.dismissAll();
                        router.replace("/");
                    } catch (error) {
                        console.log(error);
                    }
                },
            },
        ]);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={BLUE} />
            </View>
        );
    }

    const EMPLOYEE_INFO = [
        { label: "Employee ID", value: user?.employeeNumber || user?._id },
        { label: "Phone", value: user?.phone?.toString() },
        { label: "Email", value: user?.email },
        { label: "Joined On", value: formatDate(user?.dateJoined) },
        { label: "Department", value: user?.department },
        { label: "Store / Location", value: user?.location || user?.employeeLocationSAP },
        { label: "Reporting Manager", value: user?.reportingTo },
    ];

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="light-content" backgroundColor={BLUE} />

            <View style={styles.header}>
                <MaterialIcons name="menu" size={24} color="#fff" />
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.body} contentContainerStyle={{ padding: 16 }}>
                <View style={styles.card}>
                    <View style={styles.avatarCircle}>
                        <Text style={{ fontSize: 24, fontWeight: "800", color: BLUE }}>
                            {getInitials(user?.name)}
                        </Text>
                    </View>
                    <Text style={styles.name}>{user?.name || "Delivery User"}</Text>
                    <Text style={styles.role}>{user?.jobTitle || "Delivery Executive"}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>DELIVERY</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Employee Information</Text>
                <View style={styles.card}>
                    {EMPLOYEE_INFO.map((item, idx) => (
                        <View
                            key={item.label}
                            style={[
                                styles.infoRow,
                                idx !== EMPLOYEE_INFO.length - 1 && styles.rowBorder,
                            ]}
                        >
                            <Text style={styles.infoLabel}>{item.label}</Text>
                            <Text style={styles.infoValue}>{item.value || "N/A"}</Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.sectionTitle}>Settings</Text>
                <View style={styles.card}>
                    {SETTINGS.map((item, idx) => (
                        <TouchableOpacity
                            key={item.label}
                            style={[
                                styles.settingsRow,
                                idx !== SETTINGS.length - 1 && styles.rowBorder,
                            ]}
                        >
                            <MaterialIcons name={item.icon} size={20} color={BLUE} />
                            <Text style={styles.settingsLabel}>{item.label}</Text>
                            <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <MaterialIcons name="logout" size={18} color="#DC2626" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: BLUE },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F3F4F6" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: BLUE,
    },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
    body: { flex: 1, backgroundColor: "#F3F4F6" },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    avatarCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: BLUE_LIGHT,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        marginBottom: 10,
    },
    name: { fontSize: 17, fontWeight: "700", color: "#111827", textAlign: "center" },
    role: { fontSize: 13, color: "#9CA3AF", textAlign: "center", marginTop: 2 },
    badge: {
        alignSelf: "center",
        backgroundColor: BLUE_LIGHT,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 4,
        marginTop: 10,
    },
    badgeText: { color: BLUE, fontSize: 11, fontWeight: "700" },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 10 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
    infoLabel: { fontSize: 13, color: "#9CA3AF" },
    infoValue: { fontSize: 13, color: "#111827", fontWeight: "600", flexShrink: 1, textAlign: "right", marginLeft: 10 },
    settingsRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
    settingsLabel: { flex: 1, fontSize: 13, color: "#374151" },
    logoutButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderWidth: 1.5,
        borderColor: "#DC2626",
        borderRadius: 12,
        paddingVertical: 14,
        marginBottom: 24,
    },
    logoutText: { color: "#DC2626", fontWeight: "700", fontSize: 14 },
});