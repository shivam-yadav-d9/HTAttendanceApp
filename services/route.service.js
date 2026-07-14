import { decode } from "@googlemaps/polyline-codec";

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
export const getRoute = async (origin, destination) => {
  try {
    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_API_KEY,
          "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: origin.latitude,
                longitude: origin.longitude,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: destination.latitude,
                longitude: destination.longitude,
              },
            },
          },
          travelMode: "DRIVE",
        }),
      }
    );

    const data = await response.json();

    console.log("Routes API Response:", JSON.stringify(data, null, 2));

    if (!data.routes || data.routes.length === 0) {
      return {
        coordinates: [],
        distance: 0,
        duration: 0,
      };
    }

    const route = data.routes[0];

    const decoded = decode(route.polyline.encodedPolyline);

    const coordinates = decoded.map(([latitude, longitude]) => ({
      latitude,
      longitude,
    }));

    return {
      coordinates,
      distance: route.distanceMeters,
      duration: parseInt(route.duration.replace("s", "")),
    };
  } catch (error) {
    console.log("Routes API Error:", error);

    return {
      coordinates: [],
      distance: 0,
      duration: 0,
    };
  }
};