import { useEffect, useMemo, useState } from "react";
import StatsCard from "../components/StatsCard";
import ApplicationCard from "../components/ApplicationCard";
import { applicationService } from "../services/applicationService";

const DashboardPage = () => {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const response = await applicationService.getApplications();
      setApplications(Array.isArray(response) ? response : []);
    };

    loadData();
    const intervalId = setInterval(loadData, 12000);
    return () => clearInterval(intervalId);
  }, []);

  const stats = useMemo(() => {
    const safeApplications = Array.isArray(applications) ? applications : [];
    const submitted = safeApplications.length;
    const pending = safeApplications.filter(
      (item) => item.status === "Pending" || item.status === "In Review"
    ).length;
    const approved = safeApplications.filter((item) => item.status === "Approved").length;

    return {
      submitted,
      pending,
      approved,
    };
  }, [applications]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-[22px] font-semibold text-textPrimary">Welcome to UTTSAV</h2>
        <p className="mt-2 max-w-3xl text-[15px] text-textSecondary">
          Submit one smart event application, upload required documents, and track approvals from all
          required government departments in one place.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Applications Submitted" value={stats.submitted} />
        <StatsCard title="Pending Approvals" value={stats.pending} className="border-[#F59E0B]" />
        <StatsCard title="Approved Applications" value={stats.approved} className="border-[#16A34A]" />
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
