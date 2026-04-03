import { BellRing, CircleCheck, CircleAlert } from "lucide-react";
import { Link } from "react-router-dom";

const variantIcon = {
  success: CircleCheck,
  warning: CircleAlert,
  info: BellRing,
};

const variantClass = {
  success: "text-success",
  warning: "text-warning",
  info: "text-govBlue",
};

const NotificationCard = ({ notification }) => {
  const Icon = variantIcon[notification.type] || BellRing;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <Icon size={18} className={`mt-0.5 ${variantClass[notification.type] || "text-govBlue"}`} />
          <div>
            <h3 className="text-[16px] font-medium text-textPrimary">{notification.title}</h3>
            <p className="mt-1 text-sm text-textSecondary">{notification.description}</p>
            <p className="mt-2 text-xs text-textSecondary">{notification.createdAt}</p>
          </div>
        </div>
        {!notification.read ? <span className="h-2 w-2 rounded-full bg-govBlue" /> : null}
      </div>
      {notification.applicationId ? (
        <Link
          to={`/applications/${notification.applicationId}`}
          className="mt-4 inline-flex text-sm font-medium text-govBlue hover:underline"
        >
          Open Application
        </Link>
      ) : null}
    </article>
  );
};

export default NotificationCard;
