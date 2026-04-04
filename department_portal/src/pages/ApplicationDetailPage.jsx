import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ActionPanel from '../components/ActionPanel';
import DocumentRow from '../components/DocumentRow';
import EmptyState from '../components/EmptyState';
import ProgressTracker from '../components/ProgressTracker';
import RiskBadge from '../components/RiskBadge';
import SLAChip from '../components/SLAChip';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useDepartmentData } from '../hooks/useDepartmentData';
import { departmentService } from '../services/departmentService';
import {
  buildDecisionChecklist,
  getDepartmentStatus,
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
  const requiredDepartments = Array.isArray(application.requiredDepartments)
    ? application.requiredDepartments
    : [];
  const completeCount = requiredDepartments.filter(
    (department) => application.statusByDepartment[department] === 'Approved'
  ).length;

  if (!requiredDepartments.length) {
    return 'No departments assigned';
  }
  if (completeCount === requiredDepartments.length) {
    return 'All departments cleared';
  }
  return `${completeCount}/${requiredDepartments.length} departments approved`;
};

const ApplicationDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { applications, refresh, isLoading, error } = useDepartmentData(user?.role);

  const [toast, setToast] = useState(null);
  const [detailApplication, setDetailApplication] = useState(null);
  const application = useMemo(() => {
    const detail = detailApplication?.id === id ? detailApplication : null;
    return detail || applications.find((item) => item.id === id) || null;
  }, [applications, detailApplication, id]);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      const detail = await departmentService.getApplicationDetail(id);
      if (detail?.id) {
        setDetailApplication(detail);
      }
    } catch (detailError) {
      // Keep list-level data as fallback if detail API fails.
    }
  }, [id]);

  useEffect(() => {
    if (id && user?.role && user.role !== 'Admin') {
      const markAsInReview = async () => {
        try {
          await departmentService.markInReview(id);
        } catch (markError) {
          // Do not block detail screen if status update fails.
        } finally {
          await refresh();
          await loadDetail();
        }
      };

      markAsInReview();
      return;
    }

    loadDetail();
  }, [id, loadDetail, refresh, user?.role]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (application?.id === id) return;
    loadDetail();
  }, [application?.id, id, loadDetail]);

  if (isLoading && !application) {
    return <EmptyState message="Loading application..." />;
  }

  if (error && !application) {
    return <EmptyState message={error} />;
  }

  if (!application) {
    return <EmptyState message="Application not available." />;
  }

  const currentStatus = getDepartmentStatus(application, user?.role);
  const checklistItems = buildDecisionChecklist(application);
  const riskScoreWidth = Math.min(100, Number(application.aiRiskBreakdown?.riskScore || 0));
  const progressText = getProgressText(application);
  const requiredDepartments = Array.isArray(application.requiredDepartments)
    ? application.requiredDepartments
    : [];
  const approvedCount = requiredDepartments.filter(
    (department) => application.statusByDepartment[department] === 'Approved'
  ).length;
  const allDepartmentsApproved =
    requiredDepartments.length > 0 && approvedCount === requiredDepartments.length;
  const aiRiskBreakdown = application.aiRiskBreakdown || {};
  const currentRole = user?.role || '';
  const finalNOC = application.finalNOC || null;
  const departmentNOCs = Array.isArray(application.departmentNOCs) ? application.departmentNOCs : [];

  const handleAction = async (action, comment) => {
    try {
      const result = await departmentService.submitAction({
        appId: application.id,
        action,
        rejectionReason: comment,
      });

      if (action === 'approve') {
        const finalNocUrl = result?.noc?.finalNOC?.noc_url;
        setToast({
          message: finalNocUrl
            ? 'Department approval saved. Final permit generated.'
            : 'Department clearance issued successfully.',
          tone: 'success',
        });
      }

      if (action === 'reject') {
        setToast({ message: 'Application rejected and reason recorded.', tone: 'error' });
      }

      if (action === 'query') {
        setToast({ message: 'Query sent to organizer for clarification.', tone: 'success' });
      }

      await refresh();
      await loadDetail();
    } catch (actionError) {
      setToast({ message: actionError?.message || 'Failed to update application status.', tone: 'error' });
    }
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
              {requiredDepartments.join(', ') || '-'}
            </p>
            <div className="pt-2">
              <RiskBadge riskLevel={currentStatus} isStatus />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {currentRole === 'Admin'
              ? requiredDepartments.map((departmentName) => renderFocusBlock(departmentName))
              : currentRole
                ? renderFocusBlock(currentRole)
                : null}
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
                    {aiRiskBreakdown.capacityUtilization}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${aiRiskBreakdown.capacityUtilization}%` }}
                  />
                </div>
              </div>

              <div>
                <p className="text-sm text-textSecondary">Exit Safety Rating</p>
                <p className="mt-1 text-sm font-semibold text-textMain">
                  {aiRiskBreakdown.exitSafetyRating}
                </p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-textSecondary">Risk Score</span>
                  <span className="font-semibold text-textMain">
                    {aiRiskBreakdown.riskScore}/100
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
                {aiRiskBreakdown.recommendation}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-borderMain bg-cardBg p-5 shadow-card">
            <h3 className="text-base font-semibold text-textMain">Documents (View Only)</h3>
            <div className="mt-3 space-y-2">
              {application.documents.map((document) => (
                <DocumentRow key={document.id || `${document.fileName}-${document.url}`} document={document} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-borderMain bg-cardBg p-5 shadow-card">
            <h3 className="text-base font-semibold text-textMain">Department Clearances</h3>
            <div className="mt-3 space-y-3">
              {departmentNOCs.length ? (
                departmentNOCs.map((noc) => (
                  <div key={`${noc.department}-${noc.timestamp}`} className="rounded-xl border border-borderMain bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-textMain">{noc.department} Clearance</p>
                    <p className="mt-1 text-xs text-textSecondary">
                      Issued At: {noc.timestamp ? new Date(noc.timestamp).toLocaleString() : 'N/A'}
                    </p>
                    <p className="mt-1 text-xs text-textSecondary">
                      Remarks: {noc.remarks || 'No additional remarks'}
                    </p>
                    {Array.isArray(noc.conditions) && noc.conditions.length ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-textSecondary">Conditions</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {noc.conditions.map((condition) => (
                            <li key={`${noc.department}-${condition}`} className="text-xs text-textMain">
                              {condition}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {noc.url ? (
                      <div className="mt-2">
                        <DocumentRow document={{ fileName: noc.fileName || `${noc.department}-NOC.pdf`, url: noc.url }} />
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-textSecondary">No department clearance issued yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-card">
            <h3 className="text-base font-semibold text-textMain">System Insight</h3>
            <p className="mt-2 text-sm text-textSecondary">
              This event requires approval from {requiredDepartments.join(', ') || '-'}.
            </p>
            <p className="mt-2 text-sm text-textSecondary">Current progress: {progressText}.</p>
            <p className="mt-2 text-sm font-semibold text-textMain">
              {aiRiskBreakdown.recommendation}
            </p>
          </div>

          {finalNOC ? (
            <div className="rounded-2xl border border-statusGreen/35 bg-statusGreen/10 p-4 shadow-card">
              <p className="text-sm font-semibold text-statusGreen">Event Approved</p>
              <h3 className="mt-1 text-base font-bold text-textMain">
                Final Permit: {finalNOC.permitId || `UTTSAV-NOC-${application.id}`}
              </h3>
              <p className="mt-1 text-sm text-textSecondary">
                All Departments Cleared ({approvedCount}/{requiredDepartments.length})
              </p>
              {Array.isArray(finalNOC.combinedConditions) && finalNOC.combinedConditions.length ? (
                <div className="mt-3 rounded-xl border border-borderMain bg-white p-3">
                  <p className="text-xs font-semibold text-textSecondary">Final Conditions Summary</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {finalNOC.combinedConditions.map((condition) => (
                      <li key={condition} className="text-xs text-textMain">
                        {condition}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {finalNOC.url ? (
                  <DocumentRow
                    document={{
                      fileName: finalNOC.fileName || `NOC-FINAL-${application.id}.pdf`,
                      url: finalNOC.url,
                    }}
                  />
                ) : null}
              </div>
              <div className="mt-3 rounded-xl border border-borderMain bg-white p-3">
                <p className="text-xs font-semibold text-textSecondary">Verification QR</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(
                    finalNOC.qrCode || finalNOC.url || ''
                  )}`}
                  alt="Final NOC QR"
                  className="mt-2 h-[120px] w-[120px] rounded-lg border border-borderMain"
                />
              </div>
            </div>
          ) : allDepartmentsApproved ? (
            <div className="rounded-2xl border border-statusYellow/35 bg-statusYellow/10 p-4 shadow-card">
              <p className="text-sm font-semibold text-statusYellow">
                All departments approved. Final NOC generation in progress.
              </p>
            </div>
          ) : null}

          <ProgressTracker application={application} role={currentRole} />

          <ActionPanel
            role={currentRole}
            currentStatus={currentStatus}
            riskLevel={application.riskLevel}
            dueAt={application.dueAt}
            checklistItems={checklistItems}
            onSubmitAction={handleAction}
          />

          <div className="rounded-2xl border border-borderMain bg-cardBg p-4 shadow-card">
            <h3 className="text-base font-semibold text-textMain">Feedback</h3>
            <p className="mt-2 text-sm text-textSecondary">
              {application.queryByDepartment?.[currentRole]?.message ??
                application.rejectionReasonByDepartment?.[currentRole] ??
                'No feedback issued yet.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ApplicationDetailPage;
