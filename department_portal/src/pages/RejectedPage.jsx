import { useMemo, useState } from 'react';
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

const RejectedPage = () => {
  const { user } = useAuth();
  const { searchQuery } = usePortalUi();
  const { applications } = useDepartmentData(user?.role);
  const [filters, setFilters] = useState(createDefaultFilters('Rejected'));

  const list = useMemo(
    () =>
      filterApplications({
        applications,
        role: user.role,
        filters,
        searchQuery,
        defaultStatuses: ['Rejected']
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
      <h1 className="text-2xl font-bold text-textMain">Rejected Applications</h1>
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
                <RiskBadge riskLevel="Rejected" isStatus />
              </div>
              <p className="mt-3 text-sm text-textSecondary">
                Reason:{' '}
                {application.rejectionReasonByDepartment?.[user.role] ??
                  'Rejected by another required department due to compliance concerns.'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No applications found." />
      )}
    </div>
  );
};

export default RejectedPage;
