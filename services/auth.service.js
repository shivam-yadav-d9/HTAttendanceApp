import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import attendanceService from "./attendance.service";
import locationService from "./location.service";

class AuthService {
  // Main login using OnTrack API with username (employee number)
  async login(username, password) {
    try {
      const response = await api.post('/users/login-ontrack', {
        username,
        password
      });

      if (response.success && response.data) {
        // Store user data and token
        await AsyncStorage.setItem('userToken', 'logged_in');
        await AsyncStorage.setItem('userData', JSON.stringify(response.data));
        await AsyncStorage.setItem('employeeNumber', response.data.employeeNumber);

        // Start location tracking after login
        await locationService.startTracking();

        return {
          success: true,
          user: response.data,
          message: response.message,
        };
      }

      return {
        success: false,
        message: response.message || 'Login failed',
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.message || 'Login failed. Please check your credentials.',
      };
    }
  }

  // Registration for new users
  async register(userData) {
    try {
      const response = await api.post('/users', userData);

      if (response.success && response.data) {
        return {
          success: true,
          user: response.data,
          message: response.message,
        };
      }

      return {
        success: false,
        message: response.message || 'Registration failed',
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: error.message || 'Registration failed. Please try again.',
      };
    }
  }

  // Alternative login if you need email-based login
  async loginWithEmail(email, password) {
    try {
      const response = await api.post('/users/login', { email, password });

      if (response.success && response.data) {
        await AsyncStorage.setItem('userToken', 'logged_in');
        await AsyncStorage.setItem('userData', JSON.stringify(response.data));

        // Start location tracking after login
        await locationService.startTracking();

        return {
          success: true,
          user: response.data,
          message: response.message,
        };
      }

      return {
        success: false,
        message: response.message || 'Login failed',
      };
    } catch (error) {
      console.error('Email login error:', error);
      return {
        success: false,
        message: error.message || 'Login failed',
      };
    }
  }

  // ✅ CHANGED: stopAllTracking() (not stopTracking()) so this matches the
  // three profile.jsx logout handlers — unregisters the background geofence
  // task and clears its persisted keys too, not just the foreground watcher.
  async logout() {
    attendanceService.clearAll();

    await locationService.stopAllTracking();

    await AsyncStorage.multiRemove([
      "userToken",
      "userData",
      "savedCredentials",
      "employeeNumber",
    ]);
  }

  async getCurrentUser() {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  }

  async getEmployeeNumber() {
    return await AsyncStorage.getItem('employeeNumber');
  }
}

export default new AuthService();