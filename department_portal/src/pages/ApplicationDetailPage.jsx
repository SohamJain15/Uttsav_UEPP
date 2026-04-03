import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ActionPanel from '../components/ActionPanel';
import DocumentRow from '../components/DocumentRow';
import EmptyState from '../components/EmptyState';
import ProgressTracker from '../components/ProgressTracker';
import RiskBadge from '../components/RiskBadge';
import SLAChip from '../components/SLAChip';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { applyDepartmentAction, ensureApplicationInReview } from '../data/storage';
import { useDepartmentData } from '../hooks/useDepartmentData';
import {
  buildDecisionChecklist,
  getDepartmentStatus
} from '../utils/application';

const focusLabelMap = {
  Police: [
    { key: 'crowdSize', label: 'Crowd Size' },
    { key: 'securityPlanning', label: 'Security Planning' },
    { key: 'publicSafety', label: 'Public Safety' },
    { key: 'vipMovement', label: 'VIP Movement' }
  ],
  Fire: [
    { key: 'fireworks', label: 'Fireworks' },
    { key: 'temporaryStructures', label: 'Temporary Structures' },
    { key: 'exitSafety', label: 'Exit Safety' },
    { key: 'electricalSafety', label: 'Electrical Safety' }
  ],
  Traffic: [
    { key: 'roadClosure', label: 'Road Closures' },
    { key: 'parking', label: 'Parking' },
    { key: 'trafficFlow', label: 'Traffic Flow' }
  ],
  Municipality: [
    { key: 'wasteManagement', label: 'Waste Management' },
    { key: 'publicSpaceUsage', label: 'Public Land Usage' },
    { key: 'foodStalls', label: 'Food Stalls' }
  ]
};

const getProgressText = (application) => {
  const completeCount = application.requiredDepartments.filter(
    (department) => application.statusByDepartment[department] === 'Approved'
  ).length;

  return `${completeCount}/${application.requiredDepartments.length} completed`;
};

const ApplicationDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { applications, refresh } = useDepartmentData(user?.role);

  const [toast, setToast] = useState(null);
  const application = useMemo(() => applications.find((item) => item.id === id), [applications, id]);

  useEffect(() => {
    if (id && user?.role && user.role !== 'Admin') {
      ensureApplicationInReview(id, user.role);
      refresh();
    }
  }, [id, refresh, user?.role]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!application) {
    return <EmptyState message="Application not available." />;
  }

  const currentStatus = getDepartmentStatus(application, user.role);
  const checklistItems = buildDecisionChecklist(application);
  const riskScoreWidth = Math.min(100, application.aiRiskBreakdown.riskScore);
  const progressText = getProgressText(application);

  const handleAction = (action, comment) => {
    const result = applyDepartmentAction({
      applicationId: application.id,
      role: user.role,
      action,
      comment
    });

    if (result.error) {
      setToast({ message: result.error, tone: 'error' });
      return;
    }

    if (action === 'approve') {
      setToast({ message: 'Department NOC issued. Master Permit generated.', tone: 'success' });
    }

    if (action === 'reject') {
      setToast({ message: 'Application rejected and reason recorded.', tone: 'error' });
    }

    if (action === 'query') {
      setToast({ message: 'Query sent to organizer for clarification.', tone: 'success' });
    }

    refresh();
  };

  const renderFocusBlock = (departmentName) => {
    const focusData = application.focusData?.[departmentName] ?? {};
    const fields = focusLabelMap[departmentName] ?? [];

    return (
      <div key={departmentName} className="rounded-xl border border-borderMain bg-slate-50 p-3">
        <p className="text-sm font-semibold text-textMain">{departmentName} Focus</p>
        <div className="mt-2 space-y-2">
          {fields.map((field) => (
            <div key={field.key}>
              <p className="text-xs font-semibold text-textSecondary">{field.label}</p>
              <p className="text-sm text-textMain">{focusData[field.key] ?? 'Not available'}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-textSecondary">{application.id}</p>
          <h1 className="text-2xl font-bold text-textMain">{application.eventName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge riskLevel={application.riskLevel} />
          <SLAChip dueAt={application.dueAt} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.2fr_1fr]">
        <section className="rounded-2xl border border-borderMain bg-cardBg p-5 shadow-card">
          <h2 className="text-base font-semibold text-textMain">Application Summary</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p>
              <span className="font-semibold text-textSecondary">Organizer:</span>{' '}
              {application.organizerName}
            </p>
            <p>
              <span className="font-semibold text-textSecondary">Event Type:</span>{' '}
              {application.eventType}
            </p>
            <p>
              <span className="font-semibold text-textSecondary">Date:</span> {application.date}
            </p>
            <p>
              <span className="font-semibold text-textSecondary">Venue:</span> {application.venue}
            </p>
            <p>
              <span className="font-semibold text-textSecondary">Crowd Size:</span>{' '}
              {application.crowdSize.toLocaleString()}
            </p>
            <p>
              <span className="font-semibold text-textSecondary">Location:</span>{' '}
              {application.area}, {application.pincode}
            </p>
            <p>
              <span className="font-semibold text-textSecondary">Assigned Departments:</span>{' '}
              {application.requiredDepartments.join(', ')}
            </p>
            <div className="pt-2">
              <RiskBadge riskLevel={currentStatus} isStatus />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {user.role === 'Admin'
              ? application.requiredDepartments.map((departmentName) =>
                  renderFocusBlock(departmentName)
                )
              : renderFocusBlock(user.role)}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-borderMain bg-cardBg p-5 shadow-card">
            <h2 className="text-base font-semibold text-textMain">AI Risk Breakdown</h2>

            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-textSecondary">Capacity Utilization</span>
                  <span className="font-semibold text-textMain">
                    {application.aiRiskBreakdown.capacityUtilization}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${application.aiRiskBreakdown.capacityUtilization}%` }}
                  />
                </div>
              </div>

              <div>
                <p className="text-sm text-textSecondary">Exit Safety Rating</p>
                <p className="mt-1 text-sm font-semibold text-textMain">
                  {application.aiRiskBreakdown.exitSafetyRating}
                </p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-textSecondary">Risk Score</span>
                  <span className="font-semibold text-textMain">
                    {application.aiRiskBreakdown.riskScore}/100
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-statusYellow"
                    style={{ width: `${riskScoreWidth}%` }}
                  />
                </div>
              </div>

              <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-textMain">
                {application.aiRiskBreakdown.recommendation}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-borderMain bg-cardBg p-5 shadow-card">
            <h3 className="text-base font-semibold text-textMain">Documents (View Only)</h3>
            <div className="mt-3 space-y-2">
              {application.documents.map((documentName) => (
                <DocumentRow key={documentName} documentName={documentName} />
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-card">
            <h3 className="text-base font-semibold text-textMain">System Insight</h3>
            <p className="mt-2 text-sm text-textSecondary">
              This event requires approval from {application.requiredDepartments.join(', ')}.
            </p>
            <p className="mt-2 text-sm text-textSecondary">Current progress: {progressText}.</p>
            <p className="mt-2 text-sm font-semibold text-textMain">
              {application.aiRiskBreakdown.recommendation}
            </p>
          </div>

          <ProgressTracker application={application} role={user.role} />

          <ActionPanel
            role={user.role}
            currentStatus={currentStatus}
            riskLevel={application.riskLevel}
            checklistItems={checklistItems}
            onSubmitAction={handleAction}
          />

          <div className="rounded-2xl border border-borderMain bg-cardBg p-4 shadow-card">
            <h3 className="text-base font-semibold text-textMain">Feedback</h3>
            <p className="mt-2 text-sm text-textSecondary">
              {application.queryByDepartment?.[user.role]?.message ??
                application.rejectionReasonByDepartment?.[user.role] ??
                'No feedback issued yet.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ApplicationDetailPage;
