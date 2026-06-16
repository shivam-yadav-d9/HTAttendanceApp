// services/target.service.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

class TargetService {
  async getEmployeeNumber() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        // Try to get employee number from user data
        if (user.employeeNumber) {
          return user.employeeNumber;
        }
      }
      
      // Try to get from storage directly
      const employeeNumber = await AsyncStorage.getItem('employeeNumber');
      if (employeeNumber) {
        return employeeNumber;
      }
      
      // If no employee number found, throw error
      throw new Error('Employee number not found. Please login again.');
    } catch (error) {
      console.error('Error getting employee number:', error);
      throw error;
    }
  }

  async getDailyTargets() {
    try {
      const employeeNumber = await this.getEmployeeNumber();
      console.log(`Fetching daily targets for employee ${employeeNumber}`);
      const response = await api.get(`/ontrack/target/staff/daily/${employeeNumber}`);

      return {
        success: response.success,
        data: response.data || [],
        message: response.message,
      };
    } catch (error) {
      console.error('Get daily targets error:', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Failed to fetch daily targets',
      };
    }
  }
}

export default new TargetService();