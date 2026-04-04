import api from './api';

const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:8001')
  .trim()
  .replace(/\/$/, '');

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

const normalizeDocumentUrl = (rawUrl) => {
  if (typeof rawUrl === 'string') {
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/')) {
      return `${backendOrigin}${trimmed}`;
    }
    return trimmed;
  }

  if (rawUrl && typeof rawUrl === 'object') {
    const nestedData = rawUrl.data && typeof rawUrl.data === 'object' ? rawUrl.data : {};
    return normalizeDocumentUrl(
      rawUrl.publicURL || rawUrl.publicUrl || rawUrl.url || nestedData.publicUrl || nestedData.publicURL || ''
    );
  }

  return '';
};

const normalizeConditions = (conditions) => (Array.isArray(conditions) ? conditions.filter(Boolean) : []);

const normalizeDepartmentApplication = (item = {}) => {
  const requiredDepartments = Array.isArray(item.requiredDepartments)
    ? item.requiredDepartments
    : [];
  const statusByDepartment = item.statusByDepartment || {};
  const reviewedAtByDepartment = item.reviewedAtByDepartment || {};
  const riskLevel = normalizeRisk(item.riskLevel);

  const rawDocuments = Array.isArray(item.documents) ? item.documents : [];
  const allDocuments = rawDocuments
    .map((doc) => {
      if (!doc) return null;
      if (typeof doc === 'string') {
        return {
          id: `doc-${doc}`,
          docType: 'General',
          fileName: doc,
          url: '',
          uploadedAt: '',
        };
      }
      return {
        id: doc.id || `${doc.fileName || doc.file_name || 'doc'}-${doc.uploadedAt || ''}`,
        docType: doc.docType || doc.doc_type || 'General',
        fileName: doc.fileName || doc.file_name || 'document',
        url: normalizeDocumentUrl(doc.url || doc.storage_url || doc.document_url || ''),
        uploadedAt: doc.uploadedAt || doc.uploaded_at || '',
      };
    })
    .filter(Boolean);

  const documents = allDocuments.filter((doc) => !String(doc.docType || '').startsWith('NOC'));

  const departmentNOCs = Array.isArray(item.departmentNOCs)
    ? item.departmentNOCs.map((noc) => ({
        applicationId: noc.applicationId || item.id || '',
        department: noc.department || 'Department',
        approvedBy: noc.approvedBy || '',
        timestamp: noc.timestamp || '',
        conditions: normalizeConditions(noc.conditions),
        remarks: noc.remarks || '',
        fileName: noc.fileName || `${noc.department || 'Department'}-NOC.pdf`,
        url: normalizeDocumentUrl(noc.url || ''),
        qrCode: noc.qrCode || '',
      }))
    : allDocuments
      .filter((doc) => String(doc.docType || '').startsWith('NOC_') && doc.docType !== 'NOC_FINAL')
      .map((doc) => ({
        applicationId: item.id || '',
        department: String(doc.docType).replace('NOC_', ''),
        approvedBy: '',
        timestamp: doc.uploadedAt,
        conditions: [],
        remarks: '',
        fileName: doc.fileName,
        url: normalizeDocumentUrl(doc.url),
        qrCode: '',
      }));

  const finalNOC = item.finalNOC
    ? {
        permitId: item.finalNOC.permitId || `UTTSAV-NOC-${item.id || ''}`,
        applicationId: item.finalNOC.applicationId || item.id || '',
        eventName: item.finalNOC.eventName || item.eventName || '',
        approvedDepartments: Array.isArray(item.finalNOC.approvedDepartments)
          ? item.finalNOC.approvedDepartments
          : requiredDepartments,
        issueDate: item.finalNOC.issueDate || '',
        validity: item.finalNOC.validity || 'As per departmental rules and event timeline',
        combinedConditions: normalizeConditions(item.finalNOC.combinedConditions),
        qrCode: item.finalNOC.qrCode || '',
        url: normalizeDocumentUrl(item.finalNOC.url || ''),
        fileName: item.finalNOC.fileName || `NOC-FINAL-${item.id || 'application'}.pdf`,
      }
    : (() => {
        const finalDoc = allDocuments.find((doc) => doc.docType === 'NOC_FINAL');
        if (!finalDoc) return null;
        return {
          permitId: `UTTSAV-NOC-${item.id || ''}`,
          applicationId: item.id || '',
          eventName: item.eventName || '',
          approvedDepartments: requiredDepartments,
          issueDate: finalDoc.uploadedAt,
          validity: 'As per departmental rules and event timeline',
          combinedConditions: [],
          qrCode: '',
          url: normalizeDocumentUrl(finalDoc.url),
          fileName: finalDoc.fileName,
        };
      })();

  return {
    id: item.id || '',
    eventName: item.eventName || 'Unknown Event',
    organizerName: item.organizerName || 'Organizer',
    eventType: item.eventType || 'General',
    date: item.date || '',
    venue: item.venue || 'Venue details pending',
    area: item.area || 'Unknown Area',
    pincode: item.pincode || '000000',
    latitude: Number.isFinite(Number(item.latitude)) ? Number(item.latitude) : null,
    longitude: Number.isFinite(Number(item.longitude)) ? Number(item.longitude) : null,
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
    documents,
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
    departmentNOCs,
    finalNOC,
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
    const trimmedReason = String(rejectionReason || '').trim();

    if (normalizedAction === 'reject' && !trimmedReason) {
      throw new Error('Rejection reason is mandatory for rejected applications.');
    }

    if (normalizedAction === 'query') {
      return api.post('/api/dept/raise-query', {
        app_id: appId,
        query_text: trimmedReason || 'Please provide additional clarification.',
      });
    }

    const actionResponse = await api.post(`/api/dept/applications/${appId}/action`, {
      action: normalizedAction,
      rejection_reason: trimmedReason || null,
    });
    return actionResponse;
  },

  async getQueries() {
    const response = await api.get('/api/dept/queries');
    return Array.isArray(response?.queries) ? response.queries : [];
  },
};
