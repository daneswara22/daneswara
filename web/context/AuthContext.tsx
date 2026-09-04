'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from '@/lib/api';

interface User {
  id: string;
  tenant_id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
}

interface AuthContextType {
  user: User | null | false;
  setUser: (u: any) => void;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null | false>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('pos_token', urlToken);
      params.delete('token');
      const clean = window.location.pathname + (params.toString() ? `?${params}` : '') + window.location.hash;
      window.history.replaceState({}, '', clean);
    }
    const token = localStorage.getItem('pos_token');
    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem('pos_token');
        setUser(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('pos_token', data.token);
    setUser(data.user);
    return data.user as User;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    if (typeof window !== 'undefined') localStorage.removeItem('pos_token');
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
