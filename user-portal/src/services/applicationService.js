import api from "./api";
import axios from "axios";
import { determineDepartments } from "../utils/determineDepartments";
import { calculateRiskFromEvent } from "../utils/riskUtils";

const normalizeStatus = (rawStatus) => {
  const status = String(rawStatus || "").trim().toLowerCase();
  if (status === "approved" || status === "approve") return "Approved";
  if (status === "rejected" || status === "reject" || status === "denied") return "Rejected";
  if (status === "query" || status === "query raised") return "Query Raised";
  if (status === "in review" || status === "in_review" || status === "review") return "In Review";
  return "Pending";
};

const normalizeRiskLevel = (rawRisk) => {
  const risk = String(rawRisk || "").trim().toLowerCase();
  if (risk.includes("high")) return "High";
  if (risk.includes("low")) return "Low";
  return "Medium";
};

const normalizeDepartments = (departments = []) =>
  (Array.isArray(departments) ? departments : [])
    .filter((department) => department?.name || department?.department)
    .map((department) => ({
      name: department.name || department.department || "Department",
      status: normalizeStatus(department.status),
      reason: department.reason || department.rejection_reason || "",
      updatedAt: department.updatedAt || department.updated_at || null,
      queryId: department.queryId || department.query_id || null,
    }));

const buildTimelineFromDepartments = (departments = []) => [
  { label: "Application Submitted", status: "Approved" },
  ...departments.map((department) => ({
    label: department.name,
    status: department.status,
  })),
];

const normalizeApplicationListItem = (item = {}) => {
  const departments = normalizeDepartments(item.departments);
  return {
    id: item.id || item.app_id || "",
    eventName: item.eventName || item.event_name || "Unknown Event",
    eventType: item.eventType || item.event_type || "Unknown",
    crowdSize: Number(item.crowdSize || item.crowd_size || 0),
    venueType: item.venueType || item.venue_type || "",
    venueAddress: item.address || item.raw_address || "",
    address: item.address || item.raw_address || "",
    status: normalizeStatus(item.status),
    submittedAt: item.submittedAt || item.submitted_at || "",
    eventDate: item.eventDate || item.start_date || item.submittedAt || item.submitted_at || "",
    riskLevel: normalizeRiskLevel(item.riskLevel || item.risk_level),
    departments,
    timeline: buildTimelineFromDepartments(departments),
  };
};

const toIsoDateTime = (dateValue, timeValue) => {
  if (!dateValue) return "";
  const timePart = (timeValue || "00:00").slice(0, 5);
  return `${dateValue}T${timePart}:00`;
};

const buildSubmitPayload = (payload = {}) => ({
  event_name: payload.eventName || payload.event_name || "",
  event_type: payload.eventType || payload.event_type || "",
  crowd_size: Number(payload.crowdSize || payload.crowd_size || 0),
  start_date: toIsoDateTime(payload.startDate || payload.start_date, payload.startTime || payload.start_time),
  end_date: toIsoDateTime(payload.endDate || payload.end_date, payload.endTime || payload.end_time),
  venue_name: payload.venueName || payload.venue_name || "",
  venue_type: payload.venueType || payload.venue_type || "",
  venue_ownership: payload.venueOwnership || payload.venue_ownership || "",
  address: payload.address || "",
  city: payload.city || "",
  pincode: payload.pincode || "110001",
  map_latitude:
    payload.mapLatitude !== undefined && payload.mapLatitude !== ""
      ? Number(payload.mapLatitude)
      : payload.map_latitude !== undefined && payload.map_latitude !== ""
        ? Number(payload.map_latitude)
        : null,
  map_longitude:
    payload.mapLongitude !== undefined && payload.mapLongitude !== ""
      ? Number(payload.mapLongitude)
      : payload.map_longitude !== undefined && payload.map_longitude !== ""
        ? Number(payload.map_longitude)
        : null,
  has_fireworks: Boolean(payload.fireworks || payload.has_fireworks),
  has_loudspeakers: Boolean(payload.soundSystem || payload.has_loudspeakers),
  is_moving_procession: Boolean(payload.isMovingProcession || payload.is_moving_procession),
  food_stalls: Boolean(payload.foodStalls || payload.food_stalls),
});

const normalizeRiskResponse = (responseData = {}, originalPayload = {}) => {
  const responseLevel =
    responseData.risk_level || responseData.level || responseData.riskLevel || calculateRiskFromEvent(originalPayload);

  return {
    level: String(responseLevel || "Medium"),
    confidence: typeof responseData.confidence === "number" ? responseData.confidence : null,
    aiRecommendation:
      responseData.ai_recommendation ||
      responseData.aiRecommendation ||
      "AI recommendation unavailable. Rules-based fallback has been applied.",
    drivingFactors: Array.isArray(responseData.driving_factors)
      ? responseData.driving_factors
      : Array.isArray(responseData.drivingFactors)
        ? responseData.drivingFactors
        : [],
  };
};

const buildRiskPayload = (payload = {}) => ({
  event_type: payload.eventType || payload.event_type || "",
  venue_type: payload.venueType || payload.venue_type || "",
  crowd_size: Number(payload.crowdSize || payload.crowd_size || 0),
  start_date: payload.startDate || payload.start_date || "",
  end_date: payload.endDate || payload.end_date || "",
  start_time: payload.startTime || payload.start_time || "",
  end_time: payload.endTime || payload.end_time || "",
  fireworks: Boolean(payload.fireworks || payload.has_fireworks),
  temporaryStructures: Boolean(payload.temporaryStructures || payload.has_temp_structures),
  stageRequired: Boolean(payload.stageRequired),
  soundSystem: Boolean(payload.soundSystem || payload.loudspeaker_used),
  roadClosureRequired: Boolean(payload.roadClosureRequired || payload.road_closure_required),
  is_moving_procession: Boolean(payload.is_moving_procession || payload.isMovingProcession),
  foodStalls: Boolean(payload.foodStalls || payload.food_stalls_present),
  liquorServed: Boolean(payload.liquorServed || payload.liquor_served),
  max_venue_capacity: Number(payload.maxVenueCapacity || payload.max_venue_capacity || 0) || undefined,
  venue_area_sq_meters: Number(payload.venueAreaSqMeters || payload.venue_area_sq_meters || 0) || undefined,
  number_of_fire_exits: Number(payload.numberOfFireExits || payload.number_of_fire_exits || 0) || undefined,
});

const buildRiskApiCandidates = () => {
  const explicitOrigin = (import.meta.env.VITE_BACKEND_ORIGIN || "").trim().replace(/\/$/, "");
  const candidates = [];

  if (explicitOrigin) {
    candidates.push(`${explicitOrigin}/api/user/risk/calculate`);
  }

  candidates.push("http://127.0.0.1:8000/api/user/risk/calculate");
  candidates.push("/api/user/risk/calculate");

  return Array.from(new Set(candidates));
};

const buildApprovalPayload = (payload = {}) => ({
  eventType: payload.eventType || payload.event_type || "",
  crowdSize: Number(payload.crowdSize || payload.crowd_size || 0),
  startDate: payload.startDate || payload.start_date || "",
  endDate: payload.endDate || payload.end_date || "",
  startTime: payload.startTime || payload.start_time || "",
  endTime: payload.endTime || payload.end_time || "",
  venueType: payload.venueType || payload.venue_type || "",
  mapLatitude:
    payload.mapLatitude !== undefined && payload.mapLatitude !== ""
      ? Number(payload.mapLatitude)
      : payload.map_latitude !== undefined
        ? Number(payload.map_latitude)
        : undefined,
  mapLongitude:
    payload.mapLongitude !== undefined && payload.mapLongitude !== ""
      ? Number(payload.mapLongitude)
      : payload.map_longitude !== undefined
        ? Number(payload.map_longitude)
        : undefined,
  roadClosureRequired: Boolean(payload.roadClosureRequired || payload.road_closure_required),
  trafficImpact: payload.trafficImpact || payload.traffic_impact || "",
  isMovingProcession: Boolean(payload.isMovingProcession || payload.is_moving_procession),
  fireworks: Boolean(payload.fireworks || payload.has_fireworks),
  foodStalls: Boolean(payload.foodStalls || payload.food_stalls_present),
});

const buildApprovalApiCandidates = () => {
  const explicitOrigin = (import.meta.env.VITE_BACKEND_ORIGIN || "").trim().replace(/\/$/, "");
  const candidates = [];

  if (explicitOrigin) {
    candidates.push(`${explicitOrigin}/api/user/approval/probability`);
  }

  candidates.push("http://127.0.0.1:8000/api/user/approval/probability");
  candidates.push("/api/user/approval/probability");

  return Array.from(new Set(candidates));
};

const normalizeApprovalResponse = (data = {}) => ({
  probability:
    typeof data.approval_probability === "number"
      ? data.approval_probability
      : typeof data.probability === "number"
        ? data.probability
        : null,
  band: data.approval_band || data.band || "",
  bandLabel: data.approval_band_label || data.band_label || data.bandLabel || "",
  factors: Array.isArray(data.factors) ? data.factors : [],
  recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
  summary: data.spatial_temporal_summary || {},
  modelVersion: data.model_version || "",
});

const buildCollisionPayload = (payload = {}) => ({
  isMovingProcession: Boolean(payload.isMovingProcession || payload.is_moving_procession),
  routeOrigin: payload.routeOrigin || payload.route_origin || "",
  routeDestination: payload.routeDestination || payload.route_destination || "",
  startDate: payload.startDate || payload.start_date || "",
  endDate: payload.endDate || payload.end_date || "",
  startTime: payload.startTime || payload.start_time || "",
  endTime: payload.endTime || payload.end_time || "",
  eventName: payload.eventName || payload.event_name || "",
  eventType: payload.eventType || payload.event_type || "",
  crowdSize: Number(payload.crowdSize || payload.crowd_size || 0),
  mapLatitude:
    payload.mapLatitude !== undefined && payload.mapLatitude !== ""
      ? Number(payload.mapLatitude)
      : payload.map_latitude !== undefined
        ? Number(payload.map_latitude)
        : undefined,
  mapLongitude:
    payload.mapLongitude !== undefined && payload.mapLongitude !== ""
      ? Number(payload.mapLongitude)
      : payload.map_longitude !== undefined
        ? Number(payload.map_longitude)
        : undefined,
  preferredRouteId: payload.preferredRouteId || payload.preferred_route_id || "",
  mode: payload.routeMode || payload.mode || "walking",
  alternatives:
    payload.routeAlternatives !== undefined
      ? Boolean(payload.routeAlternatives)
      : payload.alternatives !== undefined
        ? Boolean(payload.alternatives)
        : true,
  spatialThresholdMeters:
    payload.spatialThresholdMeters !== undefined
      ? Number(payload.spatialThresholdMeters)
      : payload.spatial_threshold_meters !== undefined
        ? Number(payload.spatial_threshold_meters)
        : 100,
  temporalThresholdMinutes:
    payload.temporalThresholdMinutes !== undefined
      ? Number(payload.temporalThresholdMinutes)
      : payload.temporal_threshold_minutes !== undefined
        ? Number(payload.temporal_threshold_minutes)
        : 30,
});

const buildCollisionApiCandidates = () => {
  const explicitOrigin = (import.meta.env.VITE_BACKEND_ORIGIN || "").trim().replace(/\/$/, "");
  const candidates = [];

  if (explicitOrigin) {
    candidates.push(`${explicitOrigin}/api/user/route-collision/check`);
  }

  candidates.push("http://127.0.0.1:8000/api/user/route-collision/check");
  candidates.push("/api/user/route-collision/check");

  return Array.from(new Set(candidates));
};

const normalizeCollisionResponse = (data = {}) => ({
  collisionStatus: data.collision_status || data.collisionStatus || "UNKNOWN",
  selectedRoute: data.selected_route || data.selectedRoute || null,
  recommendedRouteId: data.recommended_route_id || data.recommendedRouteId || "",
  routeOptions: Array.isArray(data.route_options) ? data.route_options : [],
  warnings: Array.isArray(data.warnings) ? data.warnings : [],
  recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
  summary: data.summary || {},
  thresholds: data.thresholds || {},
  modelVersion: data.model_version || data.modelVersion || "",
});

const normalizeApplicationDetail = (payload = {}) => {
  const root = payload?.data || payload;
  const application = root?.application || {};
  const event = root?.event || {};
  const departments = normalizeDepartments(root?.departments || root?.department_routings || []);
  const timeline = buildTimelineFromDepartments(departments);

  const queryByDepartment = {};
  const rejectionReasonByDepartment = {};
  departments.forEach((department) => {
    if (department.status === "Query Raised" && department.reason) {
      queryByDepartment[department.name] = {
        message: department.reason,
        raisedAt: department.updatedAt || "",
        queryId: department.queryId || null,
      };
    }
    if (department.status === "Rejected" && department.reason) {
      rejectionReasonByDepartment[department.name] = department.reason;
    }
  });

  return {
    id: application.app_id || payload?.id || "",
    eventName: event.name || "Unknown Event",
    eventType: event.category || "General",
    crowdSize: Number(event.expected_crowd || 0),
    venueAddress: event.raw_address || "",
    venueType: event.venue_type || "",
    eventDate: event.start_time || application.submitted_at || "",
    submittedAt: application.submitted_at || "",
    updatedAt: departments[0]?.updatedAt || application.submitted_at || "",
    status: normalizeStatus(application.status),
    riskLevel: normalizeRiskLevel(application.risk_level),
    departments,
    timeline,
    requiredDepartments: departments.map((item) => item.name),
    statusByDepartment: departments.reduce((acc, item) => {
      acc[item.name] = item.status;
      return acc;
    }, {}),
    queryByDepartment,
    rejectionReasonByDepartment,
  };
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.detail || error?.message || fallback;

export const applicationService = {
  async createApplication(payload) {
    const submitPayload = buildSubmitPayload(payload);
    const response = await api.post("/api/user/submit-application", submitPayload);
    const applicationId = response.data?.application_id || response.data?.id;

    if (!applicationId) {
      throw new Error("Application submitted but backend did not return an application id.");
    }

    const createdApplication = await this.getApplicationById(applicationId);
    if (createdApplication?.id) {
      return createdApplication;
    }

    return normalizeApplicationListItem({
      id: applicationId,
      eventName: payload.eventName,
      eventType: payload.eventType,
      crowdSize: payload.crowdSize,
      status: "Pending",
      submittedAt: new Date().toISOString(),
      address: payload.address,
    });
  },

  async getApplications() {
    try {
      const response = await api.get("/api/user/applications");
      const payload = response.data;

      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      return list.map((item) => normalizeApplicationListItem(item));
    } catch (error) {
      return [];
    }
  },

  async getApplicationById(id) {
    try {
      const response = await api.get(`/api/user/applications/${id}`);
      return normalizeApplicationDetail(response.data);
    } catch (error) {
      return null;
    }
  },

  async uploadDocument(formData) {
    const response = await api.post("/api/documents/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  async respondToQuery({ queryId, responseText, appId, documentId }) {
    const response = await api.post("/api/user/respond-query", {
      query_id: queryId,
      organizer_response: responseText,
      app_id: appId || null,
      document_id: documentId || null,
    });
    return response.data;
  },

  async determineRoutingDepartments(payload) {
    return determineDepartments(payload);
  },

  async calculateRisk(payload) {
    const riskPayload = buildRiskPayload(payload);
    const riskEndpoints = buildRiskApiCandidates();

    for (const endpoint of riskEndpoints) {
      try {
        const response = await axios.post(endpoint, riskPayload, {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        });
        return normalizeRiskResponse(response.data, payload);
      } catch (error) {
        // Try the next endpoint candidate.
      }
    }

    try {
      const response = await api.post("/api/user/risk/calculate", riskPayload);
      return normalizeRiskResponse(response.data, payload);
    } catch (error) {
      return {
        level: calculateRiskFromEvent(payload),
        confidence: null,
        aiRecommendation:
          "AI risk engine is unreachable. Displaying rules-based fallback risk level.",
        drivingFactors: [],
      };
    }
  },

  async predictApprovalProbability(payload) {
    const approvalPayload = buildApprovalPayload(payload);
    const candidates = buildApprovalApiCandidates();

    for (const endpoint of candidates) {
      try {
        const response = await axios.post(endpoint, approvalPayload, {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        });
        return normalizeApprovalResponse(response.data);
      } catch (error) {
        // Try next endpoint.
      }
    }

    const crowd = Number(approvalPayload.crowdSize || 0);
    const fallbackProbability = crowd >= 5000 ? 34 : crowd >= 1000 ? 51 : crowd >= 300 ? 66 : 76;
    const fallbackBand = fallbackProbability >= 70 ? "HIGH" : fallbackProbability >= 45 ? "MEDIUM" : "LOW";

    return {
      probability: fallbackProbability,
      band: fallbackBand,
      bandLabel:
        fallbackBand === "HIGH"
          ? "High Likelihood"
          : fallbackBand === "MEDIUM"
            ? "Moderate Likelihood"
            : "Low Likelihood",
      factors: [],
      recommendations: [
        "Live approval forecast service is unreachable. Continue with complete documents and authority clearances.",
      ],
      summary: {
        history_source: "frontend_fallback",
      },
      modelVersion: "fallback-v0",
    };
  },

  async checkRouteCollision(payload) {
    const collisionPayload = buildCollisionPayload(payload);

    if (!collisionPayload.isMovingProcession) {
      return {
        collisionStatus: "NOT_APPLICABLE",
        selectedRoute: null,
        recommendedRouteId: "",
        routeOptions: [],
        warnings: [],
        recommendations: [],
        summary: {},
        thresholds: {},
        modelVersion: "not-applicable",
      };
    }

    if (!collisionPayload.routeOrigin || !collisionPayload.routeDestination) {
      return {
        collisionStatus: "INPUT_REQUIRED",
        selectedRoute: null,
        recommendedRouteId: "",
        routeOptions: [],
        warnings: [],
        recommendations: ["Provide route origin and destination to run collision checks."],
        summary: {},
        thresholds: {},
        modelVersion: "input-required",
      };
    }

    const candidates = buildCollisionApiCandidates();
    for (const endpoint of candidates) {
      try {
        const response = await axios.post(endpoint, collisionPayload, {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        });
        return normalizeCollisionResponse(response.data);
      } catch (error) {
        // Try next endpoint.
      }
    }

    return {
      collisionStatus: "SERVICE_UNAVAILABLE",
      selectedRoute: null,
      recommendedRouteId: "",
      routeOptions: [],
      warnings: [],
      recommendations: [
        "4D route collision service is unreachable. Verify moving route feasibility with Traffic and Police authorities.",
      ],
      summary: {},
      thresholds: {},
      modelVersion: "fallback-v0",
    };
  },

  getErrorMessage(error, fallback = "Request failed.") {
    return getErrorMessage(error, fallback);
  },
};
