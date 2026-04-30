import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + '/api',
  withCredentials: true,
  timeout: 8000, // Default 8 seconds for normal requests
});

// Request interceptor: set longer timeout for export requests
api.interceptors.request.use((config) => {
  if (config.url?.includes('/export/')) {
    config.timeout = 60000; // 60 seconds for PDF/DOCX export
  }
  return config;
});

// Response interceptor: on 401, try token refresh once
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      try {
        const res = await api.post('/auth/refresh', {}, { timeout: 5000 });
        const { accessToken } = res.data;
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        original.headers['Authorization'] = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
