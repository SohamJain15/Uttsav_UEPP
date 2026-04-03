import { CheckCircle2, Clock3, XCircle } from "lucide-react";

const statusConfig = {
  Approved: { icon: CheckCircle2, className: "text-success" },
  Pending: { icon: Clock3, className: "text-warning" },
  Rejected: { icon: XCircle, className: "text-danger" },
  "In Review": { icon: Clock3, className: "text-warning" },
};

const DepartmentStatusIndicator = ({ label, status }) => {
  const config = statusConfig[status] || statusConfig.Pending;
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm font-medium text-textPrimary">{label}</p>
        <p className="text-xs text-textSecondary">Current status: {status}</p>
      </div>
      <Icon size={18} className={config.className} />
    </div>
  );
};

export default DepartmentStatusIndicator;
