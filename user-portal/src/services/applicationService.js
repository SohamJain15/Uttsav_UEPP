import api from "./api";
import axios from "axios";
import { dummyApplications } from "../data/dummyApplications";
import { determineDepartments } from "../utils/determineDepartments";
import { calculateRiskFromEvent } from "../utils/riskUtils";

const STORAGE_KEY = "uttsav_submitted_applications";

const readLocalApplications = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
};

const writeLocalApplications = (applications) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
};

const mergeWithLocalData = () => {
  const local = readLocalApplications();
  const localArray = Array.isArray(local) ? local : [];
  return [...localArray, ...dummyApplications];
};

const normalizeRiskResponse = (responseData = {}, originalPayload = {}) => {
  const responseLevel =
    responseData.risk_level || responseData.level || responseData.riskLevel || calculateRiskFromEvent(originalPayload);

  return {
    level: String(responseLevel || "Medium"),
    confidence:
      typeof responseData.confidence === "number" ? responseData.confidence : null,
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

export const applicationService = {
  async createApplication(payload) {
    try {
      const response = await api.post("/applications", payload);
      return response.data;
    } catch (error) {
      const departments = determineDepartments(payload);
      const riskLevel = calculateRiskFromEvent(payload);
      const applicationId = `UTTSAV-${Math.floor(2000 + Math.random() * 8000)}`;

      const mockApplication = {
        id: applicationId,
        ...payload,
        riskLevel,
        departments: departments.map((item) => ({
          name: item.name,
          reason: item.reason,
          status: "Pending",
        })),
        status: "Pending",
        submittedAt: new Date().toISOString(),
        timeline: [
          { label: "Application Submitted", status: "Approved" },
          ...departments.map((item) => ({ label: item.name, status: "Pending" })),
        ],
      };

      const current = readLocalApplications();
      writeLocalApplications([mockApplication, ...current]);

      return mockApplication;
    }
  },

  async getApplications() {
    try {
      const response = await api.get("/applications");
      const payload = response.data;

      if (Array.isArray(payload)) {
        return payload;
      }

      if (Array.isArray(payload?.items)) {
        return payload.items;
      }

      return mergeWithLocalData();
    } catch (error) {
      return mergeWithLocalData();
    }
  },

  async getApplicationById(id) {
    try {
      const response = await api.get(`/applications/${id}`);
      const payload = response.data;

      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        return payload;
      }

      if (payload?.item && typeof payload.item === "object") {
        return payload.item;
      }

      return null;
    } catch (error) {
      const all = mergeWithLocalData();
      return all.find((application) => application.id === id) || null;
    }
  },

  async uploadDocument(formData) {
    try {
      const response = await api.post("/documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      return {
        message: "Mock upload successful",
        fileUrl: "/mock/documents/file.pdf",
      };
    }
  },

  async determineRoutingDepartments(payload) {
    try {
      const response = await api.post("/routing/determine-departments", payload);
      return response.data;
    } catch (error) {
      return determineDepartments(payload);
    }
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
      const response = await api.post("/risk/calculate", riskPayload);
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
};
