import api from "./api";

const normalizeNotification = (item = {}, index = 0) => ({
  id: `${item.app_id || "app"}-${item.department || "dept"}-${item.updated_at || index}`,
  type: item.status === "Rejected" ? "danger" : item.status === "Approved" ? "success" : "info",
  title: `${item.department || "Department"} Update`,
  message:
    item.message ||
    `${item.department || "Department"} marked application ${item.app_id || "-"} as ${item.status || "Pending"}.`,
  createdAt: item.updated_at || "",
  applicationId: item.app_id || "",
  read: false,
});

export const notificationService = {
  async getNotifications() {
    const response = await api.get("/api/user/notifications");
    const raw = response.data?.notifications;
    if (!Array.isArray(raw)) return [];
    return raw.map((item, index) => normalizeNotification(item, index));
  },

  async markAsRead(id) {
    return { success: true, id };
  },
};
