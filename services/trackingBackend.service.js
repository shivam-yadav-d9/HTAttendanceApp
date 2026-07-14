import trackingApi from "./trackingApi";

class TrackingBackendService {
  async updateLocation(data) {
    return trackingApi.post("/tracking/update-location", data);
  }

  async getLocation(orderId) {
    return trackingApi.get(`/tracking/location/${orderId}`);
  }
}

export default new TrackingBackendService();