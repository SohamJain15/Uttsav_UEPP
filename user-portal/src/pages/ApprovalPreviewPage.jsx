import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DepartmentBadge from "../components/DepartmentBadge";
import RiskBadge from "../components/RiskBadge";
import { applicationService } from "../services/applicationService";
import { determineDepartments } from "../utils/determineDepartments";
import { calculateRiskFromEvent } from "../utils/riskUtils";

const ApprovalPreviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const applicationData =
    location.state?.applicationData || JSON.parse(localStorage.getItem("uttsav_draft_application") || "null");

  const departments = useMemo(() => determineDepartments(applicationData || {}), [applicationData]);
  const riskLevel = useMemo(() => calculateRiskFromEvent(applicationData || {}), [applicationData]);

  if (!applicationData) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-sm text-textSecondary">No draft application found. Please complete the form first.</p>
      </div>
    );
  }

  const submitApplication = async () => {
    const payload = {
      ...applicationData,
      departments,
      riskLevel,
      status: "Pending",
    };

    const created = await applicationService.createApplication(payload);
    localStorage.removeItem("uttsav_draft_application");
    navigate("/apply/confirmation", {
      state: {
        application: created,
      },
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-[22px] font-semibold text-textPrimary">Approval Preview</h2>
        <p className="mt-2 text-[15px] text-textSecondary">
          Review your event details, required departments, and estimated processing time before final
          submission.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card lg:col-span-2">
          <h3 className="text-[18px] font-medium text-textPrimary">Event Summary</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <p className="text-sm text-textSecondary">Event Name: <span className="font-medium text-textPrimary">{applicationData.eventName}</span></p>
            <p className="text-sm text-textSecondary">Event Type: <span className="font-medium text-textPrimary">{applicationData.eventType}</span></p>
            <p className="text-sm text-textSecondary">Expected Crowd: <span className="font-medium text-textPrimary">{applicationData.crowdSize}</span></p>
            <p className="text-sm text-textSecondary">Venue Type: <span className="font-medium text-textPrimary">{applicationData.venueType}</span></p>
          </div>
          <div className="mt-4">
            <RiskBadge level={riskLevel} />
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-[18px] font-medium text-textPrimary">Estimated Processing Time</h3>
          <p className="mt-3 text-sm text-textSecondary">Estimated processing time: 3-5 working days</p>
          <button
            type="button"
            onClick={submitApplication}
            className="mt-5 w-full rounded-lg bg-govBlue px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Submit Application
          </button>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h3 className="text-[18px] font-medium text-textPrimary">Required Departments</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {departments.map((department) => (
            <div key={department.name} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-textPrimary">{department.name}</p>
                <DepartmentBadge status="Pending" />
              </div>
              <p className="mt-2 text-sm text-textSecondary">Reason: {department.reason}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ApprovalPreviewPage;
