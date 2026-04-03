import { CheckCircle2, Clock3, XCircle } from "lucide-react";

const statusIcon = {
  Approved: CheckCircle2,
  Pending: Clock3,
  Rejected: XCircle,
};

const statusClass = {
  Approved: "text-success",
  Pending: "text-warning",
  Rejected: "text-danger",
};

const ApprovalTimeline = ({ steps = [] }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <h3 className="text-[18px] font-medium text-textPrimary">Approval Timeline</h3>
      <div className="mt-5 space-y-4">
        {steps.map((step, index) => {
          const Icon = statusIcon[step.status] || Clock3;
          return (
            <div key={`${step.label}-${index}`} className="flex items-start gap-3">
              <div className="mt-0.5">
                <Icon size={18} className={statusClass[step.status] || "text-warning"} />
              </div>
              <div className="flex-1 border-b border-slate-100 pb-3 last:border-none last:pb-0">
                <p className="text-sm font-medium text-textPrimary">{step.label}</p>
                <p className="text-xs text-textSecondary">Status: {step.status}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApprovalTimeline;
