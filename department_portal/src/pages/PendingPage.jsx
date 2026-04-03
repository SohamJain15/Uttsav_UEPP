import { useMemo, useState } from 'react';
import ApplicationCard from '../components/ApplicationCard';
import EmptyState from '../components/EmptyState';
import FilterPanel from '../components/FilterPanel';
import { useAuth } from '../context/AuthContext';
import { usePortalUi } from '../context/PortalUiContext';
import { useDepartmentData } from '../hooks/useDepartmentData';
import {
  createDefaultFilters,
  filterApplications,
  getDepartmentStatus,
  getFilterOptionsFromApplications
} from '../utils/application';

const PendingPage = () => {
  const { user } = useAuth();
  const { searchQuery } = usePortalUi();
  const { applications } = useDepartmentData(user?.role);

  const [filters, setFilters] = useState(createDefaultFilters('all'));

  const pendingApplications = useMemo(
    () =>
      filterApplications({
        applications,
        role: user.role,
        filters,
        searchQuery,
        defaultStatuses: ['Pending', 'In Review', 'Query Raised']
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
      <div>
        <h1 className="text-2xl font-bold text-textMain">Pending Applications</h1>
        <p className="text-sm text-textSecondary">Filter and review assigned applications for your jurisdiction.</p>
      </div>

      <FilterPanel
        filters={filters}
        onChange={handleFilterChange}
        areaOptions={areaOptions}
        eventTypeOptions={eventTypeOptions}
        jurisdictionOptions={jurisdictionOptions}
        departmentOptions={departmentOptions}
      />

      <div className="space-y-3">
        {pendingApplications.length ? (
          pendingApplications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              status={getDepartmentStatus(application, user.role)}
            />
          ))
        ) : (
          <EmptyState message="No applications found." />
        )}
      </div>
    </div>
  );
};

export default PendingPage;
