import axios from "axios";

const getStoredToken = () => {
  try {
    const raw = localStorage.getItem("uttsav_auth");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return (
      parsed?.access_token ||
      parsed?.token ||
      parsed?.session?.access_token ||
      ""
    );
  } catch (error) {
    return "";
  }
};

const backendOrigin = (
  import.meta.env.VITE_BACKEND_ORIGIN || "http://localhost:8000"
).trim().replace(/\/$/, "");

const api = axios.create({
  baseURL: backendOrigin || "",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default api;
