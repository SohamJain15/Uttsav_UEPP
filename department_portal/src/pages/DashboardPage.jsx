import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import JurisdictionMapPanel from '../components/JurisdictionMapPanel';
import RiskBadge from '../components/RiskBadge';
import SLAChip from '../components/SLAChip';
import SummaryCard from '../components/SummaryCard';
import { useAuth } from '../context/AuthContext';
import { usePortalUi } from '../context/PortalUiContext';
import { useDepartmentData } from '../hooks/useDepartmentData';
import { getDepartmentStatus, isDateToday, matchesApplicationSearch } from '../utils/application';
import { getSlaMeta } from '../utils/sla';

const DashboardPage = () => {
  const { user } = useAuth();
  const role = user?.role || '';
  const { searchQuery } = usePortalUi();
  const { applications, isLoading, error } = useDepartmentData(role);

  const stats = applications.reduce(
    (acc, application) => {
      const status = getDepartmentStatus(application, role);

      if (status === 'Pending') {
        acc.pending += 1;
      }

      if (status === 'Approved') {
        acc.approved += 1;
      }

      if (status === 'Rejected') {
        acc.rejected += 1;
      }

      if (isDateToday(application.reviewedAtByDepartment?.[role])) {
        acc.todayReviews += 1;
      }

      return acc;
    },
    { pending: 0, todayReviews: 0, approved: 0, rejected: 0 }
  );

  const pendingApplications = [...applications]
    .filter((application) => {
      const status = getDepartmentStatus(application, role);
      return !['Approved', 'Rejected'].includes(status);
    })
    .filter((application) => matchesApplicationSearch(application, searchQuery))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const highRiskCount = applications.filter((application) => application.riskLevel === 'High').length;
  const openQueryCount = applications.filter(
    (application) => getDepartmentStatus(application, role) === 'Query Raised'
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-textMain">Department Dashboard</h1>
        <p className="text-sm text-textSecondary">
          Operational clearance control panel for {user?.departmentLabel || 'Department Team'}
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-borderMain bg-cardBg p-3 text-sm text-textSecondary">
          Refreshing live applications...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-statusRed/35 bg-statusRed/10 p-3 text-sm text-statusRed">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Pending" value={stats.pending} tone="pending" />
        <SummaryCard label="Today's Reviews" value={stats.todayReviews} tone="review" />
        <SummaryCard label="Approved" value={stats.approved} tone="approved" />
        <SummaryCard label="Rejected" value={stats.rejected} tone="rejected" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-borderMain bg-cardBg p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-textMain">Pending Applications</h2>
            <p className="text-sm text-textSecondary">{pendingApplications.length} visible</p>
          </div>

          <div className="mt-3 space-y-3">
            {pendingApplications.length ? (
              pendingApplications.map((application) => {
                const slaMeta = getSlaMeta(application.dueAt);
                const urgencyBorder =
                  slaMeta.tone === 'breached'
                    ? 'border-statusRed/45'
                    : slaMeta.tone === 'orange'
                      ? 'border-statusYellow/45'
                      : 'border-borderMain';

                return (
                  <Link
                    key={application.id}
                    to={`/application/${application.id}`}
                    className={`flex flex-col gap-4 rounded-2xl border bg-cardBg p-4 shadow-card transition hover:border-primary/40 lg:flex-row lg:items-center lg:justify-between ${urgencyBorder}`}
                  >
                    <div>
                      <p className="text-xs text-textSecondary">{application.id}</p>
                      <h3 className="text-lg font-semibold text-textMain">{application.eventName}</h3>
                      <p className="text-sm text-textSecondary">
                        {application.venue} - {application.area}, {application.pincode}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <RiskBadge riskLevel={application.riskLevel} />
                      <RiskBadge riskLevel={getDepartmentStatus(application, role)} isStatus />
                      <SLAChip dueAt={application.dueAt} />
                    </div>
                  </Link>
                );
              })
            ) : (
              <EmptyState message="No applications found." />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <JurisdictionMapPanel applications={applications} />
          <section className="rounded-2xl border border-borderMain bg-cardBg p-4 shadow-card">
            <h3 className="text-base font-semibold text-textMain">Operational Information</h3>
            <div className="mt-3 space-y-2 text-sm text-textSecondary">
              <p>
                High-Risk Applications:{' '}
                <span className="font-semibold text-textMain">{highRiskCount}</span>
              </p>
              <p>
                Open Queries: <span className="font-semibold text-textMain">{openQueryCount}</span>
              </p>
              <p>
                Jurisdiction Clusters:{' '}
                <span className="font-semibold text-textMain">
                  {new Set(applications.map((item) => item.pincode)).size}
                </span>
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
