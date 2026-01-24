import axios from 'axios';

// IMPORTANT:
// - :3000 is the Next.js frontend in this repo
// - Admin panel runs on :3001
// - Backend should run on a separate port (default here: :3002) or be configured via REACT_APP_API_URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor để thêm token
api.interceptors.request.use(
  (config) => {
    // Use admin_token to avoid conflict with client token
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor để xử lý lỗi
api.interceptors.response.use(
  (response) => {
    // Normalize response shape:
    // - If backend returns { data: ... } (e.g. via a transform interceptor), unwrap it
    // - Else keep original payload
    // - Handle null/empty responses
    if (response.data === null || response.data === undefined) {
      response.data = {};
    } else {
      response.data = response.data?.data ?? response.data;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    // Handle JSON parse errors
    if (error.message?.includes('JSON') || error.message?.includes('null')) {
      return Promise.reject(new Error('Invalid response from server'));
    }
    return Promise.reject(error);
  }
);

export default api;

