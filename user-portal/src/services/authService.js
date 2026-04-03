import api from "./api";
import { dummyProfile } from "../data/dummyProfile";

export const authService = {
  async login(payload) {
    try {
      const response = await api.post("/auth/login", payload);
      return response.data;
    } catch (error) {
      return {
        token: "mock-jwt-token",
        user: dummyProfile,
      };
    }
  },

  async register(payload) {
    try {
      const response = await api.post("/auth/register", payload);
      return response.data;
    } catch (error) {
      return {
        message: "Registration successful",
        user: { ...dummyProfile, ...payload },
      };
    }
  },

  async getProfile() {
    try {
      const response = await api.get("/auth/profile");
      return response.data;
    } catch (error) {
      return dummyProfile;
    }
  },
};
