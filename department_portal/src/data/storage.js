import { createSeedData } from './seedData';

const PORTAL_DATA_KEY = 'uttsav_department_portal_v1';

const emitDataUpdate = () => window.dispatchEvent(new Event('uttsav-data-change'));

export const initializePortalData = () => {
  const existing = localStorage.getItem(PORTAL_DATA_KEY);
  if (!existing) {
    localStorage.setItem(PORTAL_DATA_KEY, JSON.stringify(createSeedData()));
  }
};

export const getPortalData = () => {
  initializePortalData();
  return JSON.parse(localStorage.getItem(PORTAL_DATA_KEY) || '{}');
};

const savePortalData = (data) => {
  localStorage.setItem(PORTAL_DATA_KEY, JSON.stringify(data));
  emitDataUpdate();
};

const getDepartmentByRole = (role, data) => data.departments.find((department) => department.name === role);

export const getDepartmentScopedApplications = (role) => {
  const data = getPortalData();

  if (role === 'Admin') {
    return data.applications;
  }

  const department = getDepartmentByRole(role, data);
  if (!department) {
    return [];
  }

  return data.applications.filter((application) => {
    const isAssigned = application.requiredDepartments.includes(role);
    const inJurisdiction = department.jurisdictionPincodes.includes(application.pincode);
    return isAssigned && inJurisdiction;
  });
};

export const getApplicationForRole = (applicationId, role) => {
  const applications = getDepartmentScopedApplications(role);
  return applications.find((application) => application.id === applicationId);
};

export const getDepartmentJurisdiction = (role) => {
  if (role === 'Admin') {
    return ['All Jurisdictions'];
  }

  const data = getPortalData();
  const department = getDepartmentByRole(role, data);
  return department?.jurisdictionPincodes ?? [];
};

export const ensureApplicationInReview = (applicationId, role) => {
  if (role === 'Admin') {
    return null;
  }

  const data = getPortalData();
  const application = data.applications.find((item) => item.id === applicationId);

  if (!application || !application.requiredDepartments.includes(role)) {
    return null;
  }

  if ((application.statusByDepartment[role] ?? 'Pending') !== 'Pending') {
    return application;
  }

  application.statusByDepartment[role] = 'In Review';
  application.overallStatus = deriveOverallStatus(application);
  savePortalData(data);

  return application;
};

const deriveOverallStatus = (application) => {
  const statuses = application.requiredDepartments.map(
    (departmentName) => application.statusByDepartment[departmentName] ?? 'Pending'
  );

  if (statuses.includes('Rejected')) {
    return 'Rejected';
  }

  if (statuses.includes('Query Raised')) {
    return 'Query';
  }

  if (statuses.every((status) => status === 'Approved')) {
    return 'Approved';
  }

  if (statuses.includes('In Review')) {
    return 'In Review';
  }

  return 'Pending';
};

export const applyDepartmentAction = ({ applicationId, role, action, comment }) => {
  if (role === 'Admin') {
    return { error: 'Admin role cannot issue departmental decisions directly.' };
  }

  const data = getPortalData();
  const application = data.applications.find((item) => item.id === applicationId);

  if (!application || !application.requiredDepartments.includes(role)) {
    return { error: 'Application not available for this department.' };
  }

  const now = new Date().toISOString();
  let nextStatus = 'Pending';

  if (action === 'approve') {
    nextStatus = 'Approved';
    delete application.queryByDepartment[role];
    delete application.rejectionReasonByDepartment[role];
  }

  if (action === 'reject') {
    nextStatus = 'Rejected';
    application.rejectionReasonByDepartment[role] =
      comment || 'Rejected due to unresolved compliance and safety requirements.';
    delete application.queryByDepartment[role];
  }

  if (action === 'query') {
    nextStatus = 'Query Raised';
    application.queryByDepartment[role] = {
      message: comment || 'Please provide additional clarification.',
      raisedAt: now
    };
  }

  application.statusByDepartment[role] = nextStatus;
  application.reviewedAtByDepartment[role] = now;
  application.decisionHistory.push({
    department: role,
    action: nextStatus,
    comment: comment || '-',
    at: now
  });
  application.overallStatus = deriveOverallStatus(application);

  savePortalData(data);
  return { application };
};
