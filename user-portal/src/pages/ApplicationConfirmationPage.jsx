import { useLocation, useNavigate } from "react-router-dom";
import RiskBadge from "../components/RiskBadge";

const ApplicationConfirmationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const application = location.state?.application;

  if (!application) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-sm text-textSecondary">No submitted application found.</p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
      <h2 className="text-[22px] font-semibold text-textPrimary">Application Confirmation</h2>
      <p className="mt-2 text-sm text-textSecondary">Your event permission request has been submitted successfully.</p>

      <div className="mt-5 space-y-3 rounded-lg border border-slate-200 p-4">
        <p className="text-sm text-textSecondary">
          Application ID: <span className="font-medium text-textPrimary">{application.id}</span>
        </p>
        <div className="text-sm text-textSecondary">
          Risk Level: <RiskBadge level={application.riskLevel} />
        </div>
        <p className="text-sm text-textSecondary">Departments Required:</p>
        <ul className="list-disc pl-5 text-sm text-textPrimary">
          {(application.departments || []).map((department) => (
            <li key={department.name}>{department.name}</li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/applications/${application.id}`)}
        className="mt-6 rounded-lg bg-govBlue px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
      >
        Go to Application Tracking
      </button>
    </section>
  );
};

export default ApplicationConfirmationPage;
