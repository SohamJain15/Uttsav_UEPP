import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import FilterPanel from '../components/FilterPanel';
import RiskBadge from '../components/RiskBadge';
import { useAuth } from '../context/AuthContext';
import { usePortalUi } from '../context/PortalUiContext';
import { useDepartmentData } from '../hooks/useDepartmentData';
import {
  createDefaultFilters,
  filterApplications,
  getFilterOptionsFromApplications
} from '../utils/application';

const QueriesPage = () => {
  const { user } = useAuth();
  const { searchQuery } = usePortalUi();
  const { applications } = useDepartmentData(user?.role);
  const [filters, setFilters] = useState(createDefaultFilters('Query Raised'));

  const list = useMemo(
    () =>
      filterApplications({
        applications,
        role: user.role,
        filters,
        searchQuery,
        defaultStatuses: ['Query Raised']
      }),
    [applications, filters, searchQuery, user.role]
  );

  const { areaOptions, eventTypeOptions, jurisdictionOptions, departmentOptions } =
    getFilterOptionsFromApplications(applications);

  const handleFilterChange = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-textMain">Queries Awaiting User Response</h1>
      <FilterPanel
        filters={filters}
        onChange={handleFilterChange}
        areaOptions={areaOptions}
        eventTypeOptions={eventTypeOptions}
        jurisdictionOptions={jurisdictionOptions}
        departmentOptions={departmentOptions}
      />
      {list.length ? (
        <div className="space-y-3">
          {list.map((application) => (
            <div key={application.id} className="rounded-2xl border border-borderMain bg-cardBg p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-textSecondary">{application.id}</p>
                  <h3 className="text-lg font-semibold text-textMain">{application.eventName}</h3>
                  <p className="text-sm text-textSecondary">{application.venue}</p>
                </div>
                <RiskBadge riskLevel="Query Raised" isStatus />
              </div>
              <p className="mt-3 text-sm text-textSecondary">
                Query: {application.queryByDepartment?.[user.role]?.message ?? 'Awaiting clarification from user.'}
              </p>
              <Link to={`/application/${application.id}`} className="mt-4 inline-flex rounded-xl border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white">
                Open Application
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No pending queries." />
      )}
    </div>
  );
};

export default QueriesPage;
