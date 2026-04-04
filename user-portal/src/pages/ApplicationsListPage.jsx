import { useEffect, useRef, useState } from "react";
import ApplicationCard from "../components/ApplicationCard";
import { applicationService } from "../services/applicationService";

const ApplicationsListPage = () => {
  const POLL_INTERVAL_MS = 30000;
  const [applications, setApplications] = useState([]);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const loadApplications = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const response = await applicationService.getApplications();
        setApplications(Array.isArray(response) ? response : []);
      } finally {
        inFlightRef.current = false;
      }
    };

    loadApplications();
    const runVisibleRefresh = () => {
      if (document.visibilityState === "visible") {
        loadApplications();
      }
    };
    const intervalId = setInterval(runVisibleRefresh, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", runVisibleRefresh);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", runVisibleRefresh);
    };
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-[22px] font-semibold text-textPrimary">All Submitted Applications</h2>
        <p className="mt-2 text-sm text-textSecondary">Review status, risk level, and approval progress for each event.</p>
      </div>

      <div className="space-y-4">
        {(Array.isArray(applications) ? applications : []).map((application) => (
          <ApplicationCard key={application.id} application={application} />
        ))}
        {(Array.isArray(applications) ? applications : []).length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-textSecondary shadow-card">
            No applications available.
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default ApplicationsListPage;
