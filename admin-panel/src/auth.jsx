import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('collegeBusAdminToken') || localStorage.getItem('token');
    const savedUser = localStorage.getItem('admin_user');
    if (token && savedUser) {
      try { return JSON.parse(savedUser); } catch (_e) { return null; }
    }
    return null;
  });
  const [checking, setChecking] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem('collegeBusAdminToken');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('admin_user');
    setUser(null);
    setChecking(false);
  }, []);
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch (_error) { /* expired/offline sessions still clear locally */ }
    finally { clearSession(); }
  }, [clearSession]);
  const login = useCallback((session) => {
    if (session.role !== 'admin') throw new Error('Only administrators can use this panel.');
    if (session.token) {
      localStorage.setItem('collegeBusAdminToken', session.token);
      localStorage.setItem('token', session.token);
    }
    const userData = { id: session.id, role: session.role };
    localStorage.setItem('admin_user', JSON.stringify(userData));
    setUser(userData);
    setChecking(false);
  }, []);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('collegeBusAdminToken') || localStorage.getItem('token');
    if (!token) {
      setChecking(false);
      return;
    }

    api.get('/auth/me').then(({ data }) => {
      if (active && data.role === 'admin') {
        const userData = { id: data.id, role: data.role };
        setUser(userData);
        localStorage.setItem('admin_user', JSON.stringify(userData));
      }
    }).catch((err) => {
      if (active && err.response?.status === 401) {
        clearSession();
      }
    }).finally(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, [clearSession]);
  useEffect(() => {
    window.addEventListener('admin-auth-expired', clearSession);
    return () => window.removeEventListener('admin-auth-expired', clearSession);
  }, [clearSession]);

  const value = useMemo(() => ({ user, checking, isLoggedIn: Boolean(user), login, logout }), [user, checking, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}