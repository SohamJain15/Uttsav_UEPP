import { createSeedData } from './seedData';

const PORTAL_DATA_KEY = 'uttsav_department_portal_v1';
const DEPARTMENT_CONDITIONS = {
  Police: [
    'Maintain approved crowd-control barricading and entry screening.',
    'Keep emergency lanes clear throughout the event duration.',
  ],
  Fire: [
    'Keep certified extinguishers and fire tender access ready on-site.',
    'Ensure all emergency exits and evacuation paths remain unobstructed.',
  ],
  Traffic: [
    'Implement the approved diversion and parking management plan.',
    'Deploy traffic marshals at designated ingress and egress points.',
  ],
  Municipality: [
    'Follow approved sanitation and waste-management schedule.',
    'Operate food stalls only as per municipal hygiene compliance.',
  ],
};

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

const toDataUrl = (fileBody) =>
  `data:text/plain;charset=utf-8,${encodeURIComponent(String(fileBody || '').trim())}`;

const getDepartmentConditions = (departmentName) =>
  Array.isArray(DEPARTMENT_CONDITIONS[departmentName])
    ? DEPARTMENT_CONDITIONS[departmentName]
    : [`Comply with all ${departmentName || 'department'} directives for this event clearance.`];

const buildDepartmentNoc = ({ application, department, remarks, timestamp }) => {
  const conditions = getDepartmentConditions(department);
  const fileName = `NOC-${department}-${application.id}.pdf`;
  const body = [
    `UTTSAV Department Clearance`,
    `Application ID: ${application.id}`,
    `Event: ${application.eventName}`,
    `Department: ${department}`,
    `Issued At: ${timestamp}`,
    '',
    'Conditions:',
    ...conditions.map((condition) => `- ${condition}`),
    '',
    `Remarks: ${remarks || 'No additional remarks'}`,
  ].join('\n');

  return {
    applicationId: application.id,
    department,
    approvedBy: department,
    timestamp,
    conditions,
    remarks: remarks || 'Department clearance issued after compliance verification.',
    fileName,
    url: toDataUrl(body),
    qrCode: `uttsav://noc/${application.id}/${department}`,
  };
};

const mergeUniqueConditions = (departmentNames = []) => {
  const seen = new Set();
  const merged = [];
  departmentNames.forEach((department) => {
    getDepartmentConditions(department).forEach((condition) => {
      const key = String(condition || '').trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(condition);
    });
  });
  return merged;
};

const buildFinalNoc = (application, timestamp) => {
  const approvedDepartments = (application.requiredDepartments || []).filter(
    (department) => application.statusByDepartment?.[department] === 'Approved'
  );
  const combinedConditions = mergeUniqueConditions(approvedDepartments);
  const fileName = `NOC-FINAL-${application.id}.pdf`;
  const body = [
    'UTTSAV Final Combined No Objection Certificate',
    `Permit ID: UTTSAV-NOC-${application.id}`,
    `Application ID: ${application.id}`,
    `Event: ${application.eventName}`,
    `Issue Date: ${timestamp}`,
    '',
    'Approved Departments:',
    ...approvedDepartments.map((department) => `- ${department}`),
    '',
    'Combined Conditions:',
    ...combinedConditions.map((condition) => `- ${condition}`),
  ].join('\n');

  return {
    permitId: `UTTSAV-NOC-${application.id}`,
    applicationId: application.id,
    eventName: application.eventName,
    approvedDepartments,
    issueDate: timestamp,
    validity: 'Valid only for the approved event window and listed departmental conditions.',
    combinedConditions,
    qrCode: `uttsav://noc/${application.id}/final`,
    url: toDataUrl(body),
    fileName,
  };
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

  const trimmedComment = String(comment || '').trim();
  if (action === 'reject' && !trimmedComment) {
    return { error: 'Rejection reason is mandatory for rejected applications.' };
  }

  const now = new Date().toISOString();
  let nextStatus = 'Pending';

  if (action === 'approve') {
    nextStatus = 'Approved';
    delete application.queryByDepartment[role];
    delete application.rejectionReasonByDepartment[role];

    const existingNocs = Array.isArray(application.departmentNOCs) ? application.departmentNOCs : [];
    application.departmentNOCs = existingNocs.filter((noc) => noc.department !== role);
    application.departmentNOCs.push(
      buildDepartmentNoc({
        application,
        department: role,
        remarks: trimmedComment,
        timestamp: now,
      })
    );
  }

  if (action === 'reject') {
    nextStatus = 'Rejected';
    application.rejectionReasonByDepartment[role] = trimmedComment;
    delete application.queryByDepartment[role];
    application.finalNOC = null;

    (application.requiredDepartments || []).forEach((departmentName) => {
      if (departmentName === role) return;
      const currentStatus = application.statusByDepartment?.[departmentName] || 'Pending';
      if (currentStatus === 'Approved' || currentStatus === 'Rejected') return;
      application.statusByDepartment[departmentName] = 'Rejected';
      application.rejectionReasonByDepartment[departmentName] =
        `Closed after ${role} rejection: ${trimmedComment}`;
      application.reviewedAtByDepartment[departmentName] = now;
    });
  }

  if (action === 'query') {
    nextStatus = 'Query Raised';
    application.queryByDepartment[role] = {
      message: trimmedComment || 'Please provide additional clarification.',
      raisedAt: now
    };
  }

  application.statusByDepartment[role] = nextStatus;
  application.reviewedAtByDepartment[role] = now;
  application.decisionHistory.push({
    department: role,
    action: nextStatus,
    comment: trimmedComment || '-',
    at: now
  });
  application.overallStatus = deriveOverallStatus(application);

  const approvedCount = (application.requiredDepartments || []).filter(
    (departmentName) => application.statusByDepartment?.[departmentName] === 'Approved'
  ).length;
  if (
    action === 'approve' &&
    application.requiredDepartments?.length > 0 &&
    approvedCount === application.requiredDepartments.length
  ) {
    application.finalNOC = buildFinalNoc(application, now);
  }

  savePortalData(data);
  return { application };
};
