import { useEffect, useRef, useState } from "react";
import NotificationCard from "../components/NotificationCard";
import { notificationService } from "../services/notificationService";

const NotificationsPage = () => {
  const POLL_INTERVAL_MS = 30000;
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const inFlightRef = useRef(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const loadNotifications = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        if (!hasLoadedRef.current) {
          setIsLoading(true);
        }
        const response = await notificationService.getNotifications();
        setNotifications(response || []);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        hasLoadedRef.current = true;
        setIsLoading(false);
        inFlightRef.current = false;
      }
    };

    loadNotifications();
    const runVisibleRefresh = () => {
      if (document.visibilityState === "visible") {
        loadNotifications();
      }
    };
    const intervalId = setInterval(runVisibleRefresh, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", runVisibleRefresh);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", runVisibleRefresh);
    };
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
