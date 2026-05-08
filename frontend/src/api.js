/**
 * API service module — handles all backend communication with JWT auth.
 * Stores tokens in localStorage and auto-refreshes on 401.
 */
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

// Create axios instance with auth interceptor
const api = axios.create({ baseURL: API_BASE });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('te_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('te_refresh_token');
      if (refresh) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh/`, { refresh });
          localStorage.setItem('te_access_token', res.data.access);
          original.headers.Authorization = `Bearer ${res.data.access}`;
          return api(original);
        } catch {
          // Refresh failed — clear tokens
          clearAuth();
        }
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
export function saveAuth(data) {
  localStorage.setItem('te_access_token', data.access);
  localStorage.setItem('te_refresh_token', data.refresh);
  localStorage.setItem('te_user', JSON.stringify(data.user));
}

export function getStoredUser() {
  const u = localStorage.getItem('te_user');
  return u ? JSON.parse(u) : null;
}

export function clearAuth() {
  localStorage.removeItem('te_access_token');
  localStorage.removeItem('te_refresh_token');
  localStorage.removeItem('te_user');
}

export function isLoggedIn() {
  return !!localStorage.getItem('te_access_token');
}

export async function googleLogin(credential) {
  const res = await axios.post(`${API_BASE}/auth/google/`, { credential });
  saveAuth(res.data);
  return res.data;
}

// --- Trips ---
export async function fetchTrips() {
  const res = await api.get('/trips/');
  return res.data;
}

export async function createTrip(tripData) {
  const res = await api.post('/trips/', tripData);
  return res.data;
}

export async function deleteTrip(id) {
  await api.delete(`/trips/${id}/`);
}

// --- Documents ---
export async function fetchDocuments(tripId) {
  const res = await api.get(`/documents/?trip=${tripId}`);
  return res.data;
}

export async function uploadDocument(tripId, file, title) {
  const formData = new FormData();
  formData.append('trip', tripId);
  formData.append('title', title || file.name);
  formData.append('document_type', file.type || 'Document');
  formData.append('file', file);
  const res = await api.post('/documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deleteDocument(id) {
  await api.delete(`/documents/${id}/`);
}

// --- Expenses ---
export async function fetchExpenses(tripId) {
  const res = await api.get(`/expenses/?trip=${tripId}`);
  return res.data;
}

export async function createExpense(tripId, title, amount) {
  const res = await api.post('/expenses/', { trip: tripId, title, amount });
  return res.data;
}

export default api;
