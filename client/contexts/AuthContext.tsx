'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOAuthLogin: (accessToken?: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to refresh token on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api.post('/auth/refresh');
        const { accessToken } = res.data;
        setToken(accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        const meRes = await api.get('/auth/me');
        setUser(meRes.data);
      } catch {
        // Not logged in
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, user: userData } = res.data;
    setToken(accessToken);
    setUser(userData);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await api.post('/auth/signup', { email, password, displayName });
    const { accessToken, user: userData } = res.data;
    setToken(accessToken);
    setUser(userData);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
    window.location.href = '/login';
  }, []);

  const completeOAuthLogin = useCallback(async (accessToken?: string) => {
    try {
      const token = accessToken ?? (await api.post('/auth/refresh')).data.accessToken;
      setToken(token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const meRes = await api.get('/auth/me');
      setUser(meRes.data);
      return true;
    } catch {
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, completeOAuthLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
