import { Stack } from "expo-router";
import { useEffect } from "react";
import locationService from "../services/location.service";
import notificationService from "../services/notification.service";

export default function RootLayout() {
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        console.log("[RootLayout] Initializing...");

        // Notification permission
        await notificationService.init();

        // Start foreground location tracking
        if (mounted) {
          const started = await locationService.startTracking();
          console.log("[RootLayout] Tracking started:", started);
        }
      } catch (error) {
        console.error("[RootLayout] Initialization failed:", error);
      }
    };

    init();

    return () => {
      mounted = false;
      console.log("[RootLayout] Stopping tracking...");
      locationService.stopTracking();
    };
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}