export const getDepartmentStatus = (application, role) => {
  if (role === 'Admin') {
    return application.overallStatus;
  }

  return application.statusByDepartment[role] ?? 'Pending';
};

export const createDefaultFilters = (status = 'all') => ({
  risk: 'all',
  eventType: 'all',
  area: 'all',
  jurisdiction: 'all',
  department: 'all',
  crowdSize: 'all',
  approvalScope: 'all',
  status
});

export const matchesApplicationSearch = (application, searchQuery) => {
  if (!searchQuery.trim()) {
    return true;
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const candidateValues = [
    application.id,
    application.eventName,
    application.venue,
    application.organizerName
  ];

  return candidateValues.some((value) => value?.toLowerCase().includes(normalizedQuery));
};

export const isDateToday = (isoDateString) => {
  if (!isoDateString) {
    return false;
  }

  const target = new Date(isoDateString);
  const now = new Date();

  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  );
};

export const matchesCrowdSizeFilter = (crowdSize, filterValue) => {
  if (filterValue === 'small') {
    return crowdSize <= 1000;
  }

  if (filterValue === 'medium') {
    return crowdSize > 1000 && crowdSize <= 2500;
  }

  if (filterValue === 'large') {
    return crowdSize > 2500;
  }

  return true;
};

export const getFilterOptionsFromApplications = (applications) => ({
  areaOptions: [...new Set(applications.map((application) => application.area))].sort(),
  eventTypeOptions: [...new Set(applications.map((application) => application.eventType))].sort(),
  jurisdictionOptions: [...new Set(applications.map((application) => application.pincode))].sort(),
  departmentOptions: [
    ...new Set(applications.flatMap((application) => application.requiredDepartments))
  ].sort()
});

export const filterApplications = ({
  applications,
  role,
  filters,
  searchQuery,
  defaultStatuses = ['Pending', 'In Review', 'Query Raised']
}) =>
  applications.filter((application) => {
    const status = getDepartmentStatus(application, role);

    if (filters.status === 'all' && !defaultStatuses.includes(status)) {
      return false;
    }

    if (filters.status !== 'all' && status !== filters.status) {
      return false;
    }

    if (!matchesApplicationSearch(application, searchQuery)) {
      return false;
    }

    if (filters.risk !== 'all' && application.riskLevel !== filters.risk) {
      return false;
    }

    if (filters.eventType !== 'all' && application.eventType !== filters.eventType) {
      return false;
    }

    if (filters.area !== 'all' && application.area !== filters.area) {
      return false;
    }

    if (filters.jurisdiction !== 'all' && application.pincode !== filters.jurisdiction) {
      return false;
    }

    if (
      filters.department !== 'all' &&
      !application.requiredDepartments.includes(filters.department)
    ) {
      return false;
    }

    if (!matchesCrowdSizeFilter(application.crowdSize, filters.crowdSize)) {
      return false;
    }

    if (filters.approvalScope === 'single' && application.requiredDepartments.length !== 1) {
      return false;
    }

    if (filters.approvalScope === 'multi' && application.requiredDepartments.length <= 1) {
      return false;
    }

    return true;
  });

export const buildDecisionChecklist = (application) => {
  const focusTraffic = application.focusData?.Traffic?.trafficFlow ?? '';
  const hasIncompleteTrafficFlow = /incomplete|under review/i.test(focusTraffic);

  return [
    {
      key: 'crowd-review',
      label: 'Crowd size reviewed',
      complete: application.crowdSize <= 2500
    },
    {
      key: 'docs-verified',
      label: 'Documents verified',
      complete: application.documents?.length >= 4
    },
    {
      key: 'safety-checked',
      label: 'Safety plan checked',
      complete: application.aiRiskBreakdown?.exitSafetyRating !== 'Weak'
    },
    {
      key: 'traffic-assessed',
      label: 'Traffic impact assessed',
      complete: Boolean(focusTraffic) && !hasIncompleteTrafficFlow
    }
  ];
};
