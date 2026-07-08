import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCATION_KEY_PREFIX = "@live_location_";
const TRAIL_KEY_PREFIX = "@live_trail_";
const TRAIL_MAX_POINTS = 200;

// role = "fitter" | "delivery" — keeps their stored state separate
export const saveLocation = async (role, coords) => {
  const payload = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    updatedAt: Date.now(),
  };

  await AsyncStorage.setItem(LOCATION_KEY_PREFIX + role, JSON.stringify(payload));

  const trailRaw = await AsyncStorage.getItem(TRAIL_KEY_PREFIX + role);
  const trail = trailRaw ? JSON.parse(trailRaw) : [];
  const nextTrail = [...trail, payload].slice(-TRAIL_MAX_POINTS);
  await AsyncStorage.setItem(TRAIL_KEY_PREFIX + role, JSON.stringify(nextTrail));

  return { payload, trail: nextTrail };
};

export const getLastLocation = async (role) => {
  const raw = await AsyncStorage.getItem(LOCATION_KEY_PREFIX + role);
  return raw ? JSON.parse(raw) : null;
};

export const getTrail = async (role) => {
  const raw = await AsyncStorage.getItem(TRAIL_KEY_PREFIX + role);
  return raw ? JSON.parse(raw) : [];
};

export const clearTracking = async (role) => {
  await AsyncStorage.multiRemove([LOCATION_KEY_PREFIX + role, TRAIL_KEY_PREFIX + role]);
};

// meters, haversine
export const distanceMeters = (a, b) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const calculateEta = (distance, avgSpeedKmh = 22) => {
  const km = distance / 1000;
  const minutes = (km / avgSpeedKmh) * 60;
  return Math.max(1, Math.round(minutes));
};