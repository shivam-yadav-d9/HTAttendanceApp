import polyline from "@mapbox/polyline";

const GOOGLE_API_KEY = "AIzaSyCfCfGT5R8kqZmzNNFwb71mTUqwUXOk5ss";

export const getRoute = async (origin, destination) => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${GOOGLE_API_KEY}`
    );

    const data = await response.json();

    console.log("Google Directions Response:", data);

    if (!data.routes || data.routes.length === 0) {
      return {
        coordinates: [],
        distance: 0,
        duration: 0,
      };
    }

    const route = data.routes[0];

    const decoded = polyline.decode(route.overview_polyline.points);

    const coordinates = decoded.map(([latitude, longitude]) => ({
      latitude,
      longitude,
    }));

    return {
      coordinates,
      distance: route.legs[0].distance.value,
      duration: route.legs[0].duration.value,
    };
  } catch (error) {
    console.log("Route Error:", error);

    return {
      coordinates: [],
      distance: 0,
      duration: 0,
    };
  }
};