import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePortalUi } from '../context/PortalUiContext';
import { useDepartmentData } from '../hooks/useDepartmentData';
import { getDepartmentStatus } from '../utils/application';
import { getSlaMeta } from '../utils/sla';

const buildNotifications = (applications, role) => {
  const events = [];

  applications.forEach((application) => {
    const status = getDepartmentStatus(application, role);
    const slaMeta = getSlaMeta(application.dueAt);

    if (slaMeta.tone === 'breached') {
      events.push({
        id: `${application.id}-sla-breach`,
        type: 'SLA Alert',
        tone: 'danger',
        message: `${application.id} breached SLA. Immediate action required.`
      });
    } else if (slaMeta.tone === 'orange') {
      events.push({
        id: `${application.id}-sla-urgent`,
        type: 'SLA Warning',
        tone: 'warning',
        message: `${application.id} is nearing SLA deadline.`
      });
    }

    if (status === 'Query Raised') {
      events.push({
        id: `${application.id}-query`,
        type: 'Query Raised',
        tone: 'warning',
        message: `${application.id}: Query is awaiting organizer response.`
      });
    }

    if (status === 'In Review') {
      events.push({
        id: `${application.id}-review`,
        type: 'Review Event',
        tone: 'warning',
        message: `${application.id} is currently in review by ${role}.`
      });
    }

    const latestDecision = [...(application.decisionHistory ?? [])].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    )[0];

    if (latestDecision) {
      events.push({
        id: `${application.id}-decision-${latestDecision.at}`,
        type: 'Approval Update',
        tone: latestDecision.action === 'Rejected' ? 'danger' : 'success',
        message: `${application.id}: ${latestDecision.department} marked ${latestDecision.action}.`
      });
    }
  });

  return events.slice(0, 8);
};

const toneClass = {
  success: 'border-statusGreen/30 bg-statusGreen/10 text-statusGreen',
  warning: 'border-statusYellow/35 bg-statusYellow/10 text-statusYellow',
  danger: 'border-statusRed/35 bg-statusRed/10 text-statusRed'
};

const NotificationsDrawer = () => {
  const { user } = useAuth();
  const { applications } = useDepartmentData(user?.role);
  const { isNotificationsOpen, closeNotifications } = usePortalUi();

  const notifications = useMemo(
    () => buildNotifications(applications, user?.role),
    [applications, user?.role]
  );

  if (!isNotificationsOpen) {
    return null;
  }

  return (
    <>
      <button
        aria-label="Close notifications"
        onClick={closeNotifications}
        className="fixed inset-0 z-30 bg-slate-900/30"
      />
      <aside className="fixed right-0 top-0 z-40 h-full w-full max-w-md border-l border-borderMain bg-cardBg p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-textMain">Notifications</h2>
          <button
            onClick={closeNotifications}
            className="rounded-xl border border-borderMain px-3 py-1.5 text-sm font-semibold text-textSecondary hover:text-primary"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3 overflow-y-auto pr-1">
          {notifications.length ? (
            notifications.map((item) => (
              <div key={item.id} className={`rounded-xl border p-3 ${toneClass[item.tone] ?? toneClass.warning}`}>
                <p className="text-xs font-semibold uppercase tracking-wide">{item.type}</p>
                <p className="mt-1 text-sm font-medium">{item.message}</p>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-borderMain bg-slate-50 p-4 text-sm text-textSecondary">
              No recent updates.
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default NotificationsDrawer;
