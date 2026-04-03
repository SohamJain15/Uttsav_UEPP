import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  Clock3,
  Cone,
  Flame,
  MapPin,
  Shield,
  UploadCloud,
  Users,
} from "lucide-react";
import { formatDate } from "../utils/formatters";
import { classifyEventSize } from "../utils/riskUtils";

const riskTone = {
  High: "border-[#DC2626] text-[#DC2626]",
  Medium: "border-[#F59E0B] text-[#F59E0B]",
  Low: "border-[#16A34A] text-[#16A34A]",
};

const departmentDocuments = {
  "Traffic Department": ["Crowd Management Plan", "Parking Layout Plan"],
  "Police Department": ["Security Deployment Plan", "Emergency Evacuation Procedure"],
  "Fire Department": ["Fire Safety NOC", "Temporary Structure Safety Certificate"],
  Municipality: ["Waste Management Plan", "Sanitation Service Undertaking"],
};

const MOCK_APPLICATION_TEMPLATE = {
  eventName: "City Cultural Night",
  riskLevel: "High",
  eventDate: "2026-09-15",
  venueAddress: "Shivaji Park",
  venueType: "Public Ground",
  crowdSize: 2500,
  eventType: "Cultural",
  eventSize: "Large",
  submittedAt: "2026-09-08",
  updatedAt: "2026-09-12",
  departments: [
    {
      name: "Police Department",
      status: "Approved",
      reason: "Security and crowd checkpoints approved.",
    },
    {
      name: "Traffic Department",
      status: "Pending",
      reason: "Traffic diversion and parking document is required.",
    },
    {
      name: "Fire Department",
      status: "Pending",
      reason: "Fire safety checklist and evacuation map requested.",
    },
    {
      name: "Municipality",
      status: "Approved",
      reason: "Waste and sanitation provisions verified.",
    },
  ],
};

const getDepartmentIcon = (name = "") => {
  if (name.toLowerCase().includes("traffic")) return Cone;
  if (name.toLowerCase().includes("fire")) return Flame;
  if (name.toLowerCase().includes("municip")) return Building2;
  return Shield;
};

const getCityFromAddress = (address = "") => {
  if (!address) return "-";
  const parts = address
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || address;
};

const ApplicationTrackingPage = () => {
  const { id } = useParams();

  const application = useMemo(
    () => ({
      ...MOCK_APPLICATION_TEMPLATE,
      id: id || "UTTSAV-DEMO",
    }),
    [id]
  );

  const timelineItems = (application.departments || []).map((department) => {
    const status = department.status || "Pending";
    const needsAction = status === "Pending" || status === "In Review";
    const DepartmentIcon = getDepartmentIcon(department.name);
    const requestedDocuments = needsAction
      ? departmentDocuments[department.name] || ["Supporting Compliance Document"]
      : [];

    return {
      ...department,
      status,
      needsAction,
      DepartmentIcon,
      requestedDocuments,
      statusLabel: needsAction ? "Document Requested" : status,
      statusClassName: needsAction
        ? "text-[#F59E0B]"
        : status === "Approved"
          ? "text-[#16A34A]"
          : "text-gray-500",
    };
  });

  const departmentsWithRequests = timelineItems.filter((item) => item.needsAction);

  const infoItems = [
    {
      label: "Event Date",
      value: formatDate(application.eventDate || application.submittedAt),
      Icon: Calendar,
    },
    {
      label: "Venue",
      value: application.venueAddress || application.venueType || "-",
      Icon: MapPin,
    },
    {
      label: "Expected Crowd",
      value: application.crowdSize ? `${application.crowdSize} attendees` : "-",
      Icon: Users,
    },
  ];

  const detailItems = useMemo(
    () => [
      { label: "Event Type", value: application.eventType || "-" },
      { label: "Event Size", value: application.eventSize || classifyEventSize(application.crowdSize) },
      { label: "Venue Type", value: application.venueType || "-" },
      { label: "City", value: getCityFromAddress(application.venueAddress) },
      { label: "Submitted Date", value: formatDate(application.submittedAt) },
      { label: "Last Updated", value: formatDate(application.updatedAt || application.submittedAt) },
    ],
    [application]
  );

  return (
    <div className="space-y-6">
      <Link to="/applications" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} />
        Back to Applications
      </Link>

      <section className="rounded-[12px] border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-semibold text-[#0F172A]">{application.eventName}</h2>
            <p className="mt-1 text-[13px] text-gray-500">Application ID: {id || "UTTSAV-DEMO"}</p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${
              riskTone[application.riskLevel] || riskTone.Medium
            }`}
          >
            {(application.riskLevel || "Medium").toUpperCase()} RISK
          </span>
        </div>

        <div className="mt-5 grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-3 md:divide-x md:divide-gray-100">
          {infoItems.map((item, index) => (
            <div key={item.label} className={index > 0 ? "md:pl-4" : ""}>
              <p className="text-[11px] text-gray-400">{item.label}</p>
              <div className="mt-1 flex items-center gap-2">
                <item.Icon size={14} className="text-gray-400" />
                <p className="text-[14px] font-medium text-[#0F172A]">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {departmentsWithRequests.length > 0 ? (
        <section className="rounded-[12px] border border-[#FBBF24] bg-[#FFFBEB] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <UploadCloud size={18} className="text-[#F59E0B]" />
                <h3 className="font-medium text-[#0F172A]">Additional Documents Requested</h3>
              </div>
              <p className="mt-2 text-[14px] text-[#475569]">
                Some departments have requested additional documents. Please upload them to proceed with approval.
              </p>
            </div>
            <button type="button" className="rounded-md bg-[#F59E0B] px-4 py-2 text-white">
              Upload Documents
            </button>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-4 mt-8 text-[18px] font-semibold text-[#0F172A]">Approval Timeline</h3>
        <div className="relative">
          <div className="absolute bottom-0 left-[17px] top-0 border-l-2 border-gray-200" />
          <div className="space-y-4">
            {timelineItems.map((item, index) => (
              <div key={`${item.name}-${index}`} className="relative pl-12">
                <div className="absolute left-[6px] top-5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white">
                  {item.needsAction ? (
                    <AlertTriangle size={14} className="text-[#F59E0B]" />
                  ) : item.status === "Approved" ? (
                    <Check size={14} className="text-[#16A34A]" />
                  ) : (
                    <Clock3 size={14} className="text-gray-400" />
                  )}
                </div>

                <div className="rounded-[12px] border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <item.DepartmentIcon size={16} className="text-gray-500" />
                    <p className="text-[15px] font-medium text-[#0F172A]">{item.name}</p>
                  </div>

                  <p className={`mt-2 text-[14px] font-medium ${item.statusClassName}`}>{item.statusLabel}</p>

                  {item.needsAction ? (
                    <>
                      <p className="mt-2 text-[13px] text-gray-500">
                        {item.reason || "Please upload the requested supporting documents for this department."}
                      </p>
                      <ul className="mt-2 list-disc pl-5 marker:text-[#F59E0B]">
                        {item.requestedDocuments.map((document) => (
                          <li key={document} className="text-[13px] text-[#F59E0B]">
                            {document}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[12px] border border-gray-200 bg-white p-6">
        <h3 className="text-[18px] font-semibold text-[#0F172A]">Application Details</h3>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {detailItems.map((item) => (
            <div key={item.label}>
              <p className="text-[12px] text-gray-500">{item.label}</p>
              <p className="mt-1 text-[14px] font-medium text-[#0F172A]">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ApplicationTrackingPage;
