import api from "./api";
import { dummyNotifications } from "../data/dummyNotifications";

export const notificationService = {
  async getNotifications() {
    try {
      const response = await api.get("/notifications");
      return response.data;
    } catch (error) {
      return dummyNotifications;
    }
  },
};
