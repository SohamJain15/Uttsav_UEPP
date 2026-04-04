import { Link } from "react-router-dom";
import { Calendar, ChevronRight, MapPin } from "lucide-react";
import { formatDate } from "../utils/formatters";

const ApplicationCard = ({ application }) => {
  const riskTone = {
    High: "border-[#DC2626] text-[#DC2626]",
    Medium: "border-[#F59E0B] text-[#F59E0B]",
    Low: "border-[#16A34A] text-[#16A34A]",
  };

  const statusTone = {
    Pending: { label: "Under Review", className: "text-[#92400E] bg-[#FFFBEB] border border-[#FCD34D]" },
    "In Review": { label: "Under Review", className: "text-[#92400E] bg-[#FFFBEB] border border-[#FCD34D]" },
    Approved: { label: "Approved", className: "text-[#166534] bg-[#F0FDF4] border border-[#86EFAC]" },
    Rejected: { label: "Rejected", className: "text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5]" },
  };

  const pendingDepartment = (application.departments || []).find(
    (department) => department.status === "Pending" || department.status === "In Review"
  );
  const footerText = pendingDepartment
    ? `${pendingDepartment.name} Pending`
    : "All Departments Approved";
  const status = statusTone[application.status] || {
    label: application.status || "Under Review",
    className: "text-[#64748B]",
  };

  return (
    <Link
      to={`/applications/${application.id}`}
      className="block rounded-xl border border-slate-200 bg-cardBg p-5 shadow-card transition hover:border-[#BFDBFE]"
    >
      <article>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[18px] font-medium text-[#0F172A]">{application.eventName}</h3>
          <ChevronRight size={18} className="text-gray-400" />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${
              riskTone[application.riskLevel] || riskTone.Medium
            }`}
          >
            {(application.riskLevel || "Medium").toUpperCase()} RISK
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${status.className}`}>{status.label}</span>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-[13px] text-gray-500">{formatDate(application.eventDate || application.submittedAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-gray-400" />
            <span className="text-[13px] text-gray-500">
              {application.venueAddress || application.venueType || "Venue not specified"}
            </span>
          </div>
        </div>

        <hr className="my-3 border-gray-100" />
        <p className="text-[13px] text-[#64748B]">{footerText}</p>
      </article>
    </Link>
  );
};

export default ApplicationCard;
