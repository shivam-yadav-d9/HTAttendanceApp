import { Stack } from "expo-router";
import { useEffect } from "react";
import locationService from "../services/location.service";
import notificationService from "../services/notification.service";

export default function StaffLayout() {
  useEffect(() => {
    const init = async () => {
      try {
        console.log("[StaffLayout] Requesting notification permissions...");
        await notificationService.init();

        console.log("[StaffLayout] Starting location tracking...");
        const started = await locationService.startTracking();
        console.log("[StaffLayout] Tracking started:", started);
      } catch (error) {
        console.error("[StaffLayout] Failed to start tracking:", error);
      }
    };

    init();

    return () => {
      locationService.stopTracking(); // foreground only
    };
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}