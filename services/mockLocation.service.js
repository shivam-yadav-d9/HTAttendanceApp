// services/mockLocation.service.js
import { isMockingLocation } from "react-native-turbo-mock-location-detector";

export async function detectMockLocation() {

    try {

        const result = await isMockingLocation();

        return result.isLocationMocked;

    } catch (e) {

        console.log(e);

        return false;
    }
}