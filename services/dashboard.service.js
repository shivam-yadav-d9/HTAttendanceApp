// services/dashboard.service.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";

class DashboardService {
    async getEmployeeDashboard() {
        try {
            // Get employee number from AsyncStorage
            const employeeNumber = await AsyncStorage.getItem("employeeNumber");
            
            // Debug: Log the employee number
            console.log("Employee Number from storage:", employeeNumber);
            
            if (!employeeNumber) {
                throw new Error("Employee number not found. Please login again.");
            }
            
            // Make the API call with the employee number
            const response = await api.get(`/ontrack/emp-dashboard/${employeeNumber}`);
            
            // Debug: Log the response
            console.log("Dashboard API response:", response);
            
            return response;
        } catch (error) {
            console.error("Dashboard service error:", error);
            throw error;
        }
    }
}

export default new DashboardService();