const FilterField = ({ label, value, onChange, options }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs font-semibold text-textSecondary">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-borderMain bg-cardBg px-3 py-2 text-sm text-textMain outline-none ring-primary/30 focus:ring"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const FilterPanel = ({
  filters,
  onChange,
  areaOptions,
  eventTypeOptions,
  departmentOptions = [],
  jurisdictionOptions = []
}) => (
  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-borderMain bg-cardBg p-4 shadow-card md:grid-cols-2 xl:grid-cols-8">
    <FilterField
      label="Risk"
      value={filters.risk}
      onChange={(value) => onChange('risk', value)}
      options={[
        { label: 'All Risk Levels', value: 'all' },
        { label: 'Low', value: 'Low' },
        { label: 'Medium', value: 'Medium' },
        { label: 'High', value: 'High' }
      ]}
    />
    <FilterField
      label="Event Type"
      value={filters.eventType}
      onChange={(value) => onChange('eventType', value)}
      options={[{ label: 'All Types', value: 'all' }, ...eventTypeOptions.map((item) => ({ label: item, value: item }))]}
    />
    <FilterField
      label="Area"
      value={filters.area}
      onChange={(value) => onChange('area', value)}
      options={[{ label: 'All Areas', value: 'all' }, ...areaOptions.map((item) => ({ label: item, value: item }))]}
    />
    <FilterField
      label="Jurisdiction"
      value={filters.jurisdiction}
      onChange={(value) => onChange('jurisdiction', value)}
      options={[
        { label: 'All Pincodes', value: 'all' },
        ...jurisdictionOptions.map((item) => ({ label: item, value: item }))
      ]}
    />
    <FilterField
      label="Department"
      value={filters.department}
      onChange={(value) => onChange('department', value)}
      options={[
        { label: 'All Departments', value: 'all' },
        ...departmentOptions.map((item) => ({ label: item, value: item }))
      ]}
    />
    <FilterField
      label="Crowd Size"
      value={filters.crowdSize}
      onChange={(value) => onChange('crowdSize', value)}
      options={[
        { label: 'All Sizes', value: 'all' },
        { label: 'Up to 1,000', value: 'small' },
        { label: '1,001 to 2,500', value: 'medium' },
        { label: '2,500+', value: 'large' }
      ]}
    />
    <FilterField
      label="Required Approvals"
      value={filters.approvalScope}
      onChange={(value) => onChange('approvalScope', value)}
      options={[
        { label: 'All', value: 'all' },
        { label: 'Single Department', value: 'single' },
        { label: 'Multi Department', value: 'multi' }
      ]}
    />
    <FilterField
      label="Status"
      value={filters.status}
      onChange={(value) => onChange('status', value)}
      options={[
        { label: 'All Statuses', value: 'all' },
        { label: 'Pending', value: 'Pending' },
        { label: 'In Review', value: 'In Review' },
        { label: 'Query Raised', value: 'Query Raised' },
        { label: 'Approved', value: 'Approved' },
        { label: 'Rejected', value: 'Rejected' }
      ]}
    />
  </div>
);

export default FilterPanel;
