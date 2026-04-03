import api from "./api";
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
    try {
      const response = await api.post("/risk/calculate", payload);
      return response.data;
    } catch (error) {
      return {
        level: calculateRiskFromEvent(payload),
      };
    }
  },
};
