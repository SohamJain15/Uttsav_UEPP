import { useEffect, useMemo, useState } from "react";
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
import { applicationService } from "../services/applicationService";
import { formatDate } from "../utils/formatters";
import { classifyEventSize } from "../utils/riskUtils";

const riskTone = {
  High: "border-[#DC2626] text-[#DC2626]",
  Medium: "border-[#F59E0B] text-[#F59E0B]",
  Low: "border-[#16A34A] text-[#16A34A]",
};

const departmentDocuments = {
  Traffic: ["Traffic Diversion Plan", "Parking Layout Plan"],
  Police: ["Security Deployment Plan", "Emergency Evacuation Procedure"],
  Fire: ["Fire Safety NOC", "Temporary Structure Safety Certificate"],
  Municipality: ["Waste Management Plan", "Sanitation Service Undertaking"],
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

const downloadFile = async (url, fileName) => {
  if (!url) return;
  if (url.startsWith("data:")) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName || "document.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName || "document.pdf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

const ApplicationTrackingPage = () => {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [queryResponses, setQueryResponses] = useState({});
  const [queryMessage, setQueryMessage] = useState("");
  const [isSubmittingQuery, setIsSubmittingQuery] = useState(false);

  useEffect(() => {
    if (!id) {
      setApplication(null);
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;
    const loadApplication = async () => {
      try {
        if (isMounted) setIsLoading(true);
        const payload = await applicationService.getApplicationById(id);
        if (isMounted) {
          setApplication(payload);
          setError(payload ? "" : "Application not found.");
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            applicationService.getErrorMessage(
              loadError,
              "Unable to load application status right now."
            )
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadApplication();
    const intervalId = setInterval(loadApplication, 12000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [id]);

  const timelineItems = useMemo(() => {
    const departments = Array.isArray(application?.departments) ? application.departments : [];
    return departments.map((department) => {
      const status = department.status || "Pending";
      const needsAction =
        status === "Pending" || status === "In Review" || status === "Query Raised";
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
        statusLabel: status === "Pending" ? "Pending Review" : status,
        statusClassName:
          status === "Approved"
            ? "text-[#16A34A]"
            : status === "Rejected"
              ? "text-[#DC2626]"
              : status === "Query Raised"
                ? "text-[#F59E0B]"
                : "text-[#64748B]",
      };
    });
  }, [application]);

  const departmentsWithRequests = timelineItems.filter((item) => item.needsAction);
  const finalNOC = application?.finalNOC || null;
  const departmentNOCs = Array.isArray(application?.departmentNOCs) ? application.departmentNOCs : [];

  const handleQueryResponse = async (departmentName) => {
    const responseText = String(queryResponses[departmentName] || "").trim();
    const queryId = application?.queryByDepartment?.[departmentName]?.queryId;

    if (!responseText) {
      setQueryMessage("Please enter a response before submitting.");
      return;
    }
    if (!queryId) {
      setQueryMessage("This query does not have a query ID yet. Please refresh and try again.");
      return;
    }

    setIsSubmittingQuery(true);
    setQueryMessage("");

    try {
      await applicationService.respondToQuery({
        queryId,
        responseText,
        appId: application?.id,
      });
      setQueryResponses((previous) => ({ ...previous, [departmentName]: "" }));
      const refreshed = await applicationService.getApplicationById(id);
      setApplication(refreshed);
      setQueryMessage("Query response submitted successfully.");
    } catch (submitError) {
      setQueryMessage(
        applicationService.getErrorMessage(submitError, "Unable to submit query response.")
      );
    } finally {
      setIsSubmittingQuery(false);
    }
  };

  const infoItems = [
    {
      label: "Event Date",
      value: formatDate(application?.eventDate || application?.submittedAt),
      Icon: Calendar,
    },
    {
      label: "Venue",
      value: application?.venueAddress || application?.venueType || "-",
      Icon: MapPin,
    },
    {
      label: "Expected Crowd",
      value: application?.crowdSize ? `${application.crowdSize} attendees` : "-",
      Icon: Users,
    },
  ];

  const detailItems = useMemo(
    () => [
      { label: "Event Type", value: application?.eventType || "-" },
      {
        label: "Event Size",
        value: application?.eventSize || classifyEventSize(application?.crowdSize),
      },
      { label: "Venue Type", value: application?.venueType || "-" },
      { label: "City", value: getCityFromAddress(application?.venueAddress) },
      { label: "Submitted Date", value: formatDate(application?.submittedAt) },
      { label: "Last Updated", value: formatDate(application?.updatedAt || application?.submittedAt) },
    ],
    [application]
  );

  if (isLoading && !application) {
    return (
      <div className="space-y-6">
        <Link to="/applications" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} />
          Back to Applications
        </Link>
        <section className="rounded-[12px] border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Loading application timeline...
        </section>
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="space-y-6">
        <Link to="/applications" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} />
          Back to Applications
        </Link>
        <section className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-6 text-sm text-[#B91C1C]">
          {error}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/applications" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} />
        Back to Applications
      </Link>

      <section className="rounded-[12px] border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-semibold text-[#0F172A]">{application?.eventName || "-"}</h2>
            <p className="mt-1 text-[13px] text-gray-500">Application ID: {application?.id || id}</p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${
              riskTone[application?.riskLevel] || riskTone.Medium
            }`}
          >
            {(application?.riskLevel || "Medium").toUpperCase()} RISK
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
                Some departments still need additional information. Upload pending documents to avoid delays.
              </p>
            </div>
            <Link
              to={`/documents/${application?.id || id}`}
              className="rounded-md bg-[#F59E0B] px-4 py-2 text-white"
            >
              Upload Documents
            </Link>
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
                  {item.status === "Query Raised" ? (
                    <AlertTriangle size={14} className="text-[#F59E0B]" />
                  ) : item.status === "Approved" ? (
                    <Check size={14} className="text-[#16A34A]" />
                  ) : item.status === "Rejected" ? (
                    <AlertTriangle size={14} className="text-[#DC2626]" />
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

                  {item.reason ? (
                    <p className="mt-2 text-[13px] text-gray-500">{item.reason}</p>
                  ) : null}

                  {item.status === "Query Raised" ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={queryResponses[item.name] || ""}
                        onChange={(event) =>
                          setQueryResponses((previous) => ({
                            ...previous,
                            [item.name]: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 p-3 text-sm text-[#0F172A]"
                        rows={3}
                        placeholder={`Respond to ${item.name}'s query`}
                      />
                      <button
                        type="button"
                        disabled={isSubmittingQuery}
                        onClick={() => handleQueryResponse(item.name)}
                        className="rounded-md bg-[#1E40AF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {isSubmittingQuery ? "Submitting..." : "Submit Query Response"}
                      </button>
                      {queryMessage ? (
                        <p className="text-xs text-[#475569]">{queryMessage}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {item.needsAction && item.requestedDocuments.length > 0 ? (
                    <ul className="mt-2 list-disc pl-5 marker:text-[#F59E0B]">
                      {item.requestedDocuments.map((document) => (
                        <li key={document} className="text-[13px] text-[#F59E0B]">
                          {document}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {finalNOC ? (
        <section className="rounded-[12px] border border-[#86EFAC] bg-[#F0FDF4] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-[18px] font-semibold text-[#166534]">Final Permit Issued</h3>
              <p className="mt-1 text-sm text-[#166534]">Permit ID: {finalNOC.permitId}</p>
              <p className="mt-1 text-sm text-[#166534]">
                Issue Date: {formatDate(finalNOC.issueDate || application?.updatedAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadFile(finalNOC.url, finalNOC.fileName)}
                  className="rounded-md bg-[#166534] px-4 py-2 text-sm font-semibold text-white"
                >
                  Download Final NOC
                </button>
                <button
                  type="button"
                  onClick={() => window.open(finalNOC.url, "_blank", "noopener,noreferrer")}
                  className="rounded-md border border-[#166534] px-4 py-2 text-sm font-semibold text-[#166534]"
                >
                  View Final NOC
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-[#BBF7D0] bg-white p-3">
              <p className="text-xs font-semibold text-[#166534]">Verification QR</p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(
                  finalNOC.qrCode || finalNOC.url || ""
                )}`}
                alt="Final NOC Verification QR"
                className="mt-2 h-[130px] w-[130px] rounded-md border border-[#DCFCE7]"
              />
            </div>
          </div>
        </section>
      ) : null}

      {departmentNOCs.length ? (
        <section className="rounded-[12px] border border-gray-200 bg-white p-6">
          <h3 className="text-[18px] font-semibold text-[#0F172A]">Department Clearances</h3>
          <div className="mt-4 space-y-3">
            {departmentNOCs.map((noc) => (
              <div
                key={`${noc.department}-${noc.timestamp}`}
                className="rounded-[10px] border border-gray-200 p-4"
              >
                <p className="text-[15px] font-semibold text-[#0F172A]">{noc.department} Clearance</p>
                <p className="mt-1 text-sm text-gray-500">
                  Issued: {formatDate(noc.timestamp || application?.updatedAt)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(noc.url, "_blank", "noopener,noreferrer")}
                    className="rounded-md border border-[#1E40AF] px-3 py-1.5 text-sm font-semibold text-[#1E40AF]"
                  >
                    View NOC
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFile(noc.url, noc.fileName)}
                    className="rounded-md bg-[#1E40AF] px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Download NOC
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
