import { dummyNotifications } from "../data/dummyNotifications";

export const notificationService = {
  // Simulates an API call to fetch notifications
  getNotifications: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(dummyNotifications);
      }, 500);
    });
  },

  // Simulates an API call to mark a notification as read
  markAsRead: async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, id });
      }, 300);
    });
  }
};