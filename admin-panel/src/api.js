import axios from 'axios';

const developmentApiUrl = `${window.location.protocol}//${window.location.hostname}:4000/api/v1`;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || developmentApiUrl,
  timeout: 15000,
  withCredentials: true,
  headers: { 'X-Requested-With': 'college-bus-admin' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) window.dispatchEvent(new Event('admin-auth-expired'));
    return Promise.reject(error);
  }
);

export function errorMessage(error, fallback = 'Something went wrong') {
  return error.response?.data?.error || error.message || fallback;
}

export default api;