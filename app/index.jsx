import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import authService from "../services/auth.service";
import {
  MAX_DISTANCE,
  OFFICE_LOCATION,
  calculateDistance,
} from "../utils/location";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkExistingLogin();
  }, []);

  const checkExistingLogin = async () => {
    try {
      const role = await AsyncStorage.getItem("role");
      const token = await AsyncStorage.getItem("userToken");
      const userData = await AsyncStorage.getItem("userData");

      if (role === "fitter") {
        router.replace("/(fitter)/attendance");
        return;
      }

      if (role === "delivery") {
        router.replace("/(delivery)/attendance");
        return;
      }

      if (token && userData) {
        router.replace("/(tabs)/home");
      }
    } catch (error) {
      console.log(error);
    }
  };

  // Auto-login when user re-enters office range
  useEffect(() => {
    let subscription;

    const startWatching = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;

      const saved = await AsyncStorage.getItem("savedCredentials");
      if (!saved) return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 5,
        },
        async (location) => {
          const dist = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            OFFICE_LOCATION.latitude,
            OFFICE_LOCATION.longitude
          );

          if (dist <= MAX_DISTANCE) {
            try {
              const { username: savedUsername, password: savedPassword } =
                JSON.parse(saved);

              // Use OnTrack API for auto-login
              const result = await authService.login(savedUsername, savedPassword);

              if (result.success) {
                if (subscription) subscription.remove();
                router.replace("/(tabs)/home");
              }
            } catch (e) {
              console.log("Auto login error:", e);
            }
          }
        }
      );
    };

    startWatching();

    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  // Manual Login with OnTrack API - Updated to allow login from anywhere
  const login = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please enter both Employee Number and Password");
      return;
    }

    const { status: fgStatus } =
      await Location.requestForegroundPermissionsAsync();

    if (fgStatus !== "granted") {
      Alert.alert("Permission Required", "Please allow location access.");
      return;
    }

    const { status: bgStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (bgStatus !== "granted") {
      Alert.alert(
        "Background Location Required",
        "Please select 'Always Allow' for location."
      );
      return;
    }

    try {
      setChecking(true);

      // ==========================
      // LOGIN USING API
      // ==========================
      const result = await authService.login(username, password);

      if (!result.success) {
        Alert.alert("Login Failed", result.message);
        return;
      }

      const user = result.user;

      // Save credentials
      await AsyncStorage.setItem(
        "savedCredentials",
        JSON.stringify({ username, password })
      );

      const jobTitle = (user.jobTitle || "").toUpperCase();

      // FITTER
      if (jobTitle === "FITTER") {
        await AsyncStorage.setItem("role", "fitter");

        Alert.alert("Success", `Welcome ${user.name}`);

        router.replace("/(fitter)/attendance");
        return;
      }

      // DELIVERY
      if (
        jobTitle === "LOGISTICS EXECUTIVE" ||
        jobTitle === "DELIVERY EXECUTIVE"
      ) {
        await AsyncStorage.setItem("role", "delivery");

        Alert.alert("Success", `Welcome ${user.name}`);

        router.replace("/(delivery)/attendance");
        return;
      }

      // STAFF
      await AsyncStorage.setItem("role", "staff");

      Alert.alert("Success", `Welcome ${user.name}`);

      router.replace("/(tabs)/home");

    } catch (error) {
      console.log(error);
      Alert.alert("Error", "An error occurred during login.");
    } finally {
      setChecking(false);
    }
  };

  // Optional: Show registration option
  const goToRegister = () => {
    router.push("/register");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="light-content" />

      {/* Logo + Brand */}
      <View style={styles.logoContainer}>

        <Text style={styles.brand}>
          <Text style={styles.brandHome}>Home</Text>
          <Text style={styles.brandTown}>Town</Text>
          <Text style={styles.brandOnTrack}> OnTrack</Text>
        </Text>

        <View style={styles.tagPill}>
          <MaterialIcons name="auto-awesome" size={13} color="#fff" />
          <Text style={styles.tag}> Smart Retail Workforce Platform</Text>
        </View>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <View style={styles.personIconWrapper}>
          <MaterialIcons name="badge" size={24} color="#D96A17" />
        </View>

        <Text style={styles.portal}>TEAM PORTAL</Text>
        <Text style={styles.heading}>Staff Login</Text>
        <Text style={styles.subHeading}>
          {checking
            ? "Verifying your credentials…"
            : "Enter your employee number and password"}
        </Text>

        {/* Employee Number / Username */}
        <Text style={styles.label}>Employee Number</Text>
        <View style={styles.inputContainer}>
          <MaterialIcons name="badge" size={20} color="#D96A17" />
          <TextInput
            placeholder="Enter Username"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!checking}
          />
        </View>

        {/* Password */}
        <Text style={styles.label}>Password</Text>
        <View style={styles.inputContainer}>
          <MaterialIcons name="lock-outline" size={20} color="#D96A17" />
          <TextInput
            placeholder="Enter Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            style={styles.input}
            editable={!checking}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <MaterialIcons
              name={showPassword ? "visibility" : "visibility-off"}
              size={20}
              color="#888"
            />
          </TouchableOpacity>
        </View>

        {/* Location notice - Updated to reflect that location is still tracked but not required for login */}
        <View style={styles.locationNote}>
          <MaterialIcons name="location-on" size={14} color="#D96A17" />
          <Text style={styles.locationText}>
            Location permissions required for attendance tracking
          </Text>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={[styles.loginBtn, checking && styles.loginBtnDisabled]}
          onPress={login}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginText}>Open Staff Dashboard →</Text>
          )}
        </TouchableOpacity>

        {/* Register Link */}
        {/* <TouchableOpacity onPress={goToRegister} style={styles.registerLink}>
          <Text style={styles.registerText}>
            New user? Register here
          </Text>
        </TouchableOpacity> */}

        <Text style={styles.footerText}>
          Use your assigned HomeTown employee credentials.
        </Text>
      </View>

      {/* Bottom */}
      <View style={styles.bottom}>
        <Text style={styles.bottomTitle}>
          <Text style={styles.brandHome}>Home</Text>
          <Text style={styles.brandTown}>Town</Text>
          <Text style={{ color: "#fff" }}> OnTrack Workforce App</Text>
        </Text>

        <Text style={styles.website}>Visit hometown.in</Text>

        <View style={styles.policyRow}>
          <MaterialIcons name="security" size={12} color="#D96A17" />
          <Text style={styles.policy}>
            {" "}
            Secure Login • Terms of Service • Privacy Policy
          </Text>
        </View>

        <Text style={styles.quote}>
          "Empowering every store team to learn, perform and grow."
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#5C2D0C",
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: "center",
  },

  logoContainer: {
    alignItems: "center",
    marginBottom: 14,
  },

  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },

  brand: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 8,
  },
  brandHome: { color: "#fff" },
  brandTown: { color: "#D96A17" },
  brandOnTrack: { color: "#F5C87A" },

  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6D3B16",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 7,
  },

  tag: {
    color: "#fff",
    fontSize: 11,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 18,
  },

  personIconWrapper: {
    position: "absolute",
    top: 18,
    right: 18,
    backgroundColor: "#FFF0E6",
    borderRadius: 12,
    padding: 9,
  },

  portal: {
    color: "#D96A17",
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 1.5,
  },

  heading: {
    fontSize: 28,
    fontWeight: "900",
    color: "#3A2415",
    marginTop: 3,
  },

  subHeading: {
    color: "#777",
    marginTop: 2,
    marginBottom: 10,
    fontSize: 12,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 10,
    color: "#3A2415",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: "#FAFAFA",
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
  },

  demoNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF4EC",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 12,
    gap: 6,
  },

  demoText: {
    fontSize: 11,
    color: "#D96A17",
    fontWeight: "500",
    flex: 1,
  },

  locationNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF4EC",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
    gap: 6,
  },

  locationText: {
    fontSize: 11,
    color: "#D96A17",
    fontWeight: "500",
    flex: 1,
  },

  loginBtn: {
    backgroundColor: "#D96A17",
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },

  loginBtnDisabled: {
    backgroundColor: "#E8A97A",
  },

  loginText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  registerLink: {
    marginTop: 12,
    alignItems: "center",
  },

  registerText: {
    color: "#D96A17",
    fontSize: 13,
    fontWeight: "600",
  },

  footerText: {
    textAlign: "center",
    color: "#888",
    marginTop: 10,
    fontSize: 11,
  },

  bottom: {
    marginTop: 14,
    alignItems: "center",
    gap: 4,
  },

  bottomTitle: {
    fontSize: 13,
    fontWeight: "700",
  },

  website: {
    color: "#fff",
    textDecorationLine: "underline",
    fontSize: 12,
  },

  policyRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  policy: {
    color: "#ddd",
    fontSize: 10,
  },

  quote: {
    color: "#bbb",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
  },
});