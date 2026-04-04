import api from './api';

const normalizeStatus = (rawStatus) => {
  const normalized = String(rawStatus || '').trim().toLowerCase();
  if (normalized === 'approved' || normalized === 'approve') return 'Approved';
  if (normalized === 'rejected' || normalized === 'reject' || normalized === 'denied') return 'Rejected';
  if (normalized === 'query' || normalized === 'query raised' || normalized === 'query_raised') return 'Query Raised';
  if (normalized === 'in review' || normalized === 'in_review' || normalized === 'review') return 'In Review';
  return 'Pending';
};

const normalizeRisk = (rawRisk) => {
  const normalized = String(rawRisk || '').trim().toLowerCase();
  if (normalized.includes('high')) return 'High';
  if (normalized.includes('low')) return 'Low';
  return 'Medium';
};

const normalizeDepartmentApplication = (item = {}) => {
  const requiredDepartments = Array.isArray(item.requiredDepartments)
    ? item.requiredDepartments
    : [];
  const statusByDepartment = item.statusByDepartment || {};
  const reviewedAtByDepartment = item.reviewedAtByDepartment || {};
  const riskLevel = normalizeRisk(item.riskLevel);

  return {
    id: item.id || '',
    eventName: item.eventName || 'Unknown Event',
    organizerName: item.organizerName || 'Organizer',
    eventType: item.eventType || 'General',
    date: item.date || '',
    venue: item.venue || 'Venue details pending',
    area: item.area || 'Unknown Area',
    pincode: item.pincode || '000000',
    crowdSize: Number(item.crowdSize || 0),
    riskLevel,
    requiredDepartments,
    statusByDepartment,
    reviewedAtByDepartment,
    overallStatus: normalizeStatus(item.overallStatus),
    departmentStatus: normalizeStatus(item.departmentStatus || item.overallStatus),
    dueAt: item.dueAt || '',
    submittedAt: item.submittedAt || '',
    updatedAt: item.updatedAt || '',
    documents: Array.isArray(item.documents) ? item.documents.filter(Boolean) : [],
    aiRiskBreakdown: {
      capacityUtilization: Number(item.aiRiskBreakdown?.capacityUtilization || 0),
      exitSafetyRating: item.aiRiskBreakdown?.exitSafetyRating || 'Needs Review',
      riskScore: Number(item.aiRiskBreakdown?.riskScore || 0),
      recommendation:
        item.aiRiskBreakdown?.recommendation ||
        'Proceed with standard departmental verification checklist.',
    },
    focusData: item.focusData || {},
    queryByDepartment: item.queryByDepartment || {},
    rejectionReasonByDepartment: item.rejectionReasonByDepartment || {},
    decisionHistory: Array.isArray(item.decisionHistory) ? item.decisionHistory : [],
  };
};

export const departmentService = {
  async getApplications() {
    const response = await api.get('/api/dept/applications');
    const applications = Array.isArray(response?.applications)
      ? response.applications
      : Array.isArray(response?.data)
        ? response.data
        : [];
    return applications.map((application) => normalizeDepartmentApplication(application));
  },

  async getApplicationDetail(appId) {
    const response = await api.get(`/api/dept/applications/detail/${appId}`);
    return normalizeDepartmentApplication(response?.application || response?.data?.application || {});
  },

  async markInReview(appId) {
    return api.post(`/api/dept/applications/${appId}/mark-in-review`, {});
  },

  async submitAction({ appId, action, rejectionReason }) {
    const normalizedAction = String(action || '').trim().toLowerCase();
    return api.post(`/api/dept/applications/${appId}/action`, {
      action: normalizedAction,
      rejection_reason: rejectionReason || null,
    });
  },
};
