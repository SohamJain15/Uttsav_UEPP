import api from "./api";

const normalizeAuthPayload = (data = {}) => {
  const accessToken =
    data.access_token || data.token || data?.session?.access_token || "";

  const user = data.user || {};
  const profile = data.profile || {};

  return {
    access_token: accessToken,
    token_type: data.token_type || "bearer",
    user: {
      id: user.id || profile.id || "",
      email: user.email || profile.email || "",
      full_name: profile.full_name || user.full_name || "",
      organization: profile.organization || "",
      department: profile.department || "",
      phone_number: profile.phone_number || user.phone || "",
    },
    profile: profile || null,
  };
};

export const authService = {
  async login(payload) {
    let response;
    try {
      response = await api.post("/api/auth/login", payload);
    } catch (primaryError) {
      response = await api.post("/api/user/login", payload);
    }
    const normalizedData = normalizeAuthPayload(response.data);

    // FIX: Actively store the token so the api.js interceptor can attach it to future requests
    if (normalizedData.access_token) {
      localStorage.setItem("uttsav_auth", JSON.stringify(normalizedData));
    }

    return normalizedData;
  },

  async register(payload) {
    const registerPayload = {
      email: payload.email,
      password: payload.password,
      full_name: payload.full_name || payload.fullName || payload.name || payload.email?.split("@")?.[0] || "User",
      phone_number: payload.phone_number || payload.phoneNumber || payload.phone || `NA-${Date.now()}`,
      department: payload.department || "Organizer",
    };
    const response = await api.post("/api/auth/register", registerPayload);
    return response.data;
  },

  async getProfile() {
    const response = await api.get("/api/user/profile");
    return response.data?.profile || response.data?.user || null;
  },

  logout() {
    localStorage.removeItem("uttsav_auth");
  }
};
