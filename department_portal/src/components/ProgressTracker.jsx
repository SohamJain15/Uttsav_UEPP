import RiskBadge from './RiskBadge';

const normalizeState = (status) => {
  if (status === 'Approved') return 'completed';
  if (status === 'In Review') return 'review';
  if (status === 'Rejected') return 'rejected';
  if (status === 'Query Raised') return 'query';
  return 'pending';
};

const circleClass = {
  completed: 'bg-statusGreen border-statusGreen',
  review: 'bg-primary border-primary',
  pending: 'bg-cardBg border-borderMain',
  query: 'bg-statusYellow border-statusYellow',
  rejected: 'bg-statusRed border-statusRed'
};

const ProgressTracker = ({ application, role }) => {
  const steps = [
    { key: 'submitted', label: 'Submitted', status: 'Approved' },
    ...application.requiredDepartments.map((departmentName) => ({
      key: departmentName,
      label: departmentName,
      status: application.statusByDepartment[departmentName] ?? 'Pending'
    }))
  ];

  return (
    <div className="rounded-2xl border border-borderMain bg-cardBg p-4 shadow-card">
      <h3 className="text-base font-semibold text-textMain">Approval Progress Flow</h3>
      <div className="mt-3 space-y-3">
        {steps.map((step, index) => {
          const state = normalizeState(step.status);
          const isCurrentDepartment = step.label === role;

          return (
            <div key={step.key} className="relative pl-8">
              {index !== steps.length - 1 ? (
                <span className="absolute left-[11px] top-5 h-[calc(100%-4px)] w-px bg-borderMain" />
              ) : null}

              <span
                className={`absolute left-0 top-1.5 h-6 w-6 rounded-full border-2 ${
                  circleClass[state] ?? circleClass.pending
                }`}
              />

              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-textMain">
                  {step.label}
                  {isCurrentDepartment ? ' (Current Department)' : ''}
                </p>
                <RiskBadge riskLevel={step.status} isStatus />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressTracker;
