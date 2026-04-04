const AUTH_STORAGE_KEY = 'uttsav_department_auth';

const getStoredToken = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.token || parsed?.session?.access_token || '';
  } catch (error) {
    return '';
  }
};

const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN || '').trim().replace(/\/$/, '');

const toUrl = (path) => {
  if (String(path).startsWith('http://') || String(path).startsWith('https://')) {
    return path;
  }
  return `${backendOrigin}${path}`;
};

const readResponseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
};

const buildError = (status, payload) => {
  if (payload && typeof payload === 'object') {
    const detail = payload.detail || payload.message;
    if (detail) return new Error(String(detail));
  }
  return new Error(`Request failed with status ${status}`);
};

const request = async (path, { method = 'GET', body, headers = {}, signal } = {}) => {
  const token = getStoredToken();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const mergedHeaders = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
  };

  if (token) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(toUrl(path), {
    method,
    headers: mergedHeaders,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    signal,
  });

  const payload = await readResponseBody(response);
  if (!response.ok) {
    throw buildError(response.status, payload);
  }

  return payload;
};

const api = {
  request,
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
};

export default api;
