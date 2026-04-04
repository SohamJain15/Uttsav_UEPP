import { useEffect, useState } from "react";
import NotificationCard from "../components/NotificationCard";
import { notificationService } from "../services/notificationService";

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setIsLoading(true);
        const response = await notificationService.getNotifications();
        setNotifications(response || []);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNotifications();
    const intervalId = setInterval(loadNotifications, 15000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <section className="space-y-6">
      <h2 className="text-[22px] font-semibold text-[#0F172A]">Notifications</h2>

      <div className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-500 animate-pulse">Loading your notifications...</p>
        ) : notifications.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
            You have no new notifications at this time.
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))
        )}
      </div>
    </section>
  );
};

export default NotificationsPage;
