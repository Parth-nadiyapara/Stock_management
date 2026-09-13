import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'auth_token';

export const api = axios.create({ baseURL: API_URL });

// sessionStorage (not localStorage) is scoped to a single browser
// tab, so each tab can be logged in as a different user - the
// backend is fully stateless Bearer-JWT, so whichever token this
// tab holds is exactly the identity used for its requests.
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Centralize "extract a friendly message" so every page can just
// do `catch (err) { toast.error(getErrorMessage(err)) }`.
export function getErrorMessage(err) {
  return err?.response?.data?.error || err?.message || 'Something went wrong';
}
