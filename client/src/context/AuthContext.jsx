import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getErrorMessage, getToken, setToken, clearToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    // No token in this tab's sessionStorage - skip the network call
    // entirely instead of firing a request that's guaranteed to 401.
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  async function login(username, password) {
    try {
      const { data } = await api.post('/auth/login', { username, password });
      setToken(data.token); // scoped to this browser tab only
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      clearToken();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
