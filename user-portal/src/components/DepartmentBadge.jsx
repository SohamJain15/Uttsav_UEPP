const statusStyles = {
  Approved: "bg-success/10 text-success border-success/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  "In Review": "bg-warning/10 text-warning border-warning/20",
  Rejected: "bg-danger/10 text-danger border-danger/20",
};

const departmentStyles = {
  Police: "bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]",
  Fire: "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]",
  Traffic: "bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]",
  Municipality: "bg-[#ECFDF3] border-[#BBF7D0] text-[#15803D]",
};

const DepartmentBadge = ({ status = "Pending", label, variant = "auto" }) => {
  if (variant === "department" || (variant === "auto" && label)) {
    const style = departmentStyles[label] || "bg-slate-100 border-slate-200 text-slate-700";
    return (
      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${style}`}>
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusStyles[status] || statusStyles.Pending}`}
    >
      {status}
    </span>
  );
};

export default DepartmentBadge;
