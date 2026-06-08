import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from './api';

export type UserRole = 'superadmin' | 'bc_admin' | 'manager' | 'accountant';

export interface AuthUser {
  id: number;
  email: string;
  full_name?: string;
  role: UserRole;
  business_center_id?: number;
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then(r => setUser(r.data))
        .catch(() => { localStorage.removeItem('token'); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      delete api.defaults.headers.common['Authorization'];
      setLoading(false);
    }
  }, [token]);

  async function login(email: string, password: string) {
    const params = new URLSearchParams({ username: email, password });
    const { data } = await api.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    localStorage.setItem('token', data.access_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
    setToken(data.access_token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, token, login, logout, loading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

export function useRole() {
  const { user } = useAuth();
  return {
    isAdmin: user?.role === 'superadmin' || user?.role === 'bc_admin',
    isManager: user?.role === 'superadmin' || user?.role === 'bc_admin' || user?.role === 'manager',
    isSuperadmin: user?.role === 'superadmin',
    role: user?.role,
  };
}
