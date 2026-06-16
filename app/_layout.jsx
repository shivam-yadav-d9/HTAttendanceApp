// app/_layout.jsx
//
// ⚠️ geofence.task import MUST be first — registers the bg task before anything runs
import "../services/geofence.task";

import { Stack } from "expo-router";
import { useEffect } from "react";
import locationService from "../services/location.service";

export default function Layout() {
  useEffect(() => {
    const init = async () => {
      try {
        console.log("[Layout] Starting location tracking...");
        await locationService.startTracking();
        console.log("[Layout] Location tracking started");
      } catch (error) {
        console.error("[Layout] Failed to start tracking:", error);
      }
    };

    init();

    // This layout only unmounts on full app close / logout.
    // stopTracking() stops the foreground watcher only —
    // the background task keeps running independently.
    // On LOGOUT call: await locationService.stopAllTracking()
    return () => {
      locationService.stopTracking();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}