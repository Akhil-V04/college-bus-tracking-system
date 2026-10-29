import axios from 'axios';

const developmentApiUrl = `${window.location.protocol}//${window.location.hostname}:4000/api/v1`;

axios.defaults.timeout = 180000;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || developmentApiUrl,
  timeout: 180000,
  withCredentials: true,
  headers: { 'X-Requested-With': 'college-bus-admin' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('collegeBusAdminToken') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.includes('/auth/login')) {
      window.dispatchEvent(new Event('admin-auth-expired'));
    }
    return Promise.reject(error);
  }
);

export function errorMessage(error, fallback = 'Something went wrong') {
  return error.response?.data?.error || error.message || fallback;
}

export default api;