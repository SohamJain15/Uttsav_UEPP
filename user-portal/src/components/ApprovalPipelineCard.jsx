import DepartmentStatusIndicator from "./DepartmentStatusIndicator";

const ApprovalPipelineCard = ({ departments = [] }) => {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <h3 className="text-[18px] font-medium text-textPrimary">Approval Pipeline</h3>
      <p className="mt-1 text-sm text-textSecondary">
        Department-level progress for this application.
      </p>
      <div className="mt-4 space-y-3">
        {departments.map((department) => (
          <DepartmentStatusIndicator
            key={`${department.name}-${department.status}`}
            label={department.name}
            status={department.status}
          />
        ))}
      </div>
    </section>
  );
};

export default ApprovalPipelineCard;
