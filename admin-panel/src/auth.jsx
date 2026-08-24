import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

// useAuth reads token + role from localStorage so the panel persists across reloads.
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [role, setRole] = useState(() => localStorage.getItem('role') || null);

  function login({ token: t, role: r }) {
    localStorage.setItem('token', t);
    localStorage.setItem('role', r);
    setToken(t);
    setRole(r);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken(null);
    setRole(null);
  }

  const isLoggedIn = Boolean(token);

  useEffect(() => {
    function onStorage() {
      setToken(localStorage.getItem('token'));
      setRole(localStorage.getItem('role'));
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ token, role, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}