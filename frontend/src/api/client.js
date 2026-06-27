import axios from 'axios';
import { resolveApiUrl } from '../utils/apiHost';

const API_URL = resolveApiUrl();

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sci_agent_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || '';
    if (status === 401 && (url.includes('/auth/') || url.includes('/conversations/'))) {
      localStorage.removeItem('sci_agent_token');
    }
    return Promise.reject(err);
  }
);

export default api;
export { API_URL };
