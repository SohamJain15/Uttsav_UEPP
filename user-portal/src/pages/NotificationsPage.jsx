import { useEffect, useState } from "react";
import NotificationCard from "../components/NotificationCard";
import { notificationService } from "../services/notificationService";

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const loadNotifications = async () => {
      const response = await notificationService.getNotifications();
      setNotifications(response || []);
    };

    loadNotifications();
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-[22px] font-semibold text-textPrimary">Notifications</h2>
        <p className="mt-2 text-sm text-textSecondary">Track department updates, approvals, and document requests.</p>
      </div>

      <div className="space-y-4">
        {notifications.map((notification) => (
          <NotificationCard key={notification.id} notification={notification} />
        ))}
      </div>
    </section>
  );
};

export default NotificationsPage;
