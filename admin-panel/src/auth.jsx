import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem('collegeBusAdminToken');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setUser(null);
    setChecking(false);
  }, []);
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch (_error) { /* expired/offline sessions still clear locally */ }
    finally { clearSession(); }
  }, [clearSession]);
  const login = useCallback((session) => {
    if (session.role !== 'admin') throw new Error('Only administrators can use this panel.');
    setUser({ id: session.id, role: session.role });
    setChecking(false);
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/auth/me').then(({ data }) => {
      if (active && data.role === 'admin') setUser(data);
    }).catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
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