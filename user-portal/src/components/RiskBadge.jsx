import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

const riskStyles = {
  Low: "bg-success/10 text-success border-success/20",
  Medium: "bg-warning/10 text-warning border-warning/20",
  High: "bg-danger/10 text-danger border-danger/20",
};

const riskIcons = {
  Low: CheckCircle2,
  Medium: AlertTriangle,
  High: ShieldAlert,
};

const RiskBadge = ({ level = "Low" }) => {
  const Icon = riskIcons[level] || AlertTriangle;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${riskStyles[level] || riskStyles.Low}`}
    >
      <Icon size={14} />
      {level} Risk
    </span>
  );
};

export default RiskBadge;
