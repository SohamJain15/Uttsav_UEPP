import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => config);

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default api;
