const BASE_URL = "https://tracking-backend-s1bw.onrender.com/api";
const trackingApi = {
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
        },
        ...options,
      });

      const data = await response.json();

      console.log("Tracking API:", `${BASE_URL}${endpoint}`);
      console.log("Tracking Response:", data);

      return data;
    } catch (error) {
      console.error("Tracking API Error:", error);
      throw error;
    }
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  get(endpoint) {
    return this.request(endpoint, {
      method: "GET",
    });
  },
};

export default trackingApi;