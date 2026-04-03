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
  getFilterOptionsFromApplications
} from '../utils/application';

const ApprovedPage = () => {
  const { user } = useAuth();
  const { searchQuery } = usePortalUi();
  const { applications } = useDepartmentData(user?.role);
  const [filters, setFilters] = useState(createDefaultFilters('Approved'));

  const list = useMemo(
    () =>
      filterApplications({
        applications,
        role: user.role,
        filters,
        searchQuery,
        defaultStatuses: ['Approved']
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
      <h1 className="text-2xl font-bold text-textMain">Approved Applications</h1>
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
            <ApplicationCard key={application.id} application={application} status="Approved" />
          ))}
        </div>
      ) : (
        <EmptyState message="No applications found." />
      )}
    </div>
  );
};

export default ApprovedPage;
