import { useEffect, useMemo, useRef, useState } from "react";
import StatsCard from "../components/StatsCard";
import ApplicationCard from "../components/ApplicationCard";
import { applicationService } from "../services/applicationService";

const DashboardPage = () => {
  const POLL_INTERVAL_MS = 30000;
  const [applications, setApplications] = useState([]);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const response = await applicationService.getApplications();
        setApplications(Array.isArray(response) ? response : []);
      } finally {
        inFlightRef.current = false;
      }
    };

    loadData();
    const runVisibleRefresh = () => {
      if (document.visibilityState === "visible") {
        loadData();
      }
    };
    const intervalId = setInterval(runVisibleRefresh, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", runVisibleRefresh);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", runVisibleRefresh);
    };
  }, []);

  const stats = useMemo(() => {
    const safeApplications = Array.isArray(applications) ? applications : [];
    const submitted = safeApplications.length;
    const pending = safeApplications.filter(
      (item) => item.status === "Pending" || item.status === "In Review"
    ).length;
    const approved = safeApplications.filter((item) => item.status === "Approved").length;
    const rejected = safeApplications.filter((item) => item.status === "Rejected").length;

    return {
      submitted,
      pending,
      approved,
      rejected,
    };
  }, [applications]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-success" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning" />
          <span className="h-2.5 w-2.5 rounded-full bg-danger" />
        </div>
        <h2 className="text-[22px] font-semibold text-textPrimary">Welcome to UTTSAV</h2>
        <p className="mt-2 max-w-3xl text-[15px] text-textSecondary">
          Submit one smart event application, upload required documents, and track approvals from all
          required government departments in one place.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Applications Submitted" value={stats.submitted} accent="neutral" />
        <StatsCard title="Pending Approvals" value={stats.pending} accent="warning" />
        <StatsCard title="Approved Applications" value={stats.approved} accent="success" />
        <StatsCard title="Rejected Applications" value={stats.rejected} accent="danger" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[22px] font-semibold text-textPrimary">Recent Applications</h3>
        </div>

        <div className="space-y-4">
          {(Array.isArray(applications) ? applications : []).slice(0, 3).map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
          {(Array.isArray(applications) ? applications : []).length === 0 ? (
            <p className="text-sm text-textSecondary">No applications found.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
