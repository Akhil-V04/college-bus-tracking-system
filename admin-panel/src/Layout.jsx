import { useState, useEffect } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth';
import api from './api';

const navigation = [
  { to: '/', label: 'Overview', iconName: 'overview', fallback: '⌂', end: true },
  { to: '/routes', label: 'Routes & capacity', iconName: 'routes', fallback: '↝' },
  { to: '/stops', label: 'Stops & Map', iconName: 'stops', fallback: '📍' },
  { to: '/schedules', label: 'Schedules', iconName: 'schedules', fallback: '◷' },
  { to: '/schedule-builder', label: 'Map Builder', iconName: 'schedule-builder', fallback: '🗺️' },
  { to: '/rosters', label: 'Annual rosters', iconName: 'rosters', fallback: '▤' },
  { to: '/drivers', label: 'Drivers', iconName: 'drivers', fallback: '◉' },
  { to: '/class-advisors', label: 'Class advisors', iconName: 'class-advisors', fallback: '◎' },
  { to: '/late-alerts', label: 'Late alerts', iconName: 'late-alerts', fallback: '!' },
  { to: '/operations', label: 'Operations', iconName: 'operations', fallback: '⌁' },
  { to: '/audit-log', label: 'Audit history', iconName: 'audit-log', fallback: '✓' },
  { to: '/sessions', label: 'Sessions', iconName: 'sessions', fallback: '◌' },
  { to: '/issues', label: 'AI Issues', iconName: 'issues', fallback: '◆' },
  { to: '/knowledge', label: 'Knowledge base', iconName: 'knowledge', fallback: '▣' },
  { to: '/notifications', label: 'Notifications', iconName: 'notifications', fallback: '🔔' },
];

function AdminSidebarIcon({ iconName, fallback }) {
  const [loadError, setLoadError] = useState(false);
  const [usePng, setUsePng] = useState(false);

  if (loadError) {
    return <span className="nav-icon" aria-hidden="true">{fallback}</span>;
  }

  return (
    <span className="nav-icon" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <img
        src={`/icons/${iconName}.${usePng ? 'png' : 'svg'}`}
        alt=""
        style={{ width: 18, height: 18, objectFit: 'contain' }}
        onError={() => {
          if (!usePng) setUsePng(true);
          else setLoadError(true);
        }}
      />
    </span>
  );
}

export default function Layout() {
  const { checking, isLoggedIn, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('admin-theme');
    return saved === 'dark';
  });

  const [backendOnline, setBackendOnline] = useState(null); // null = checking, true = online, false = offline

  // Apply theme class to html root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('admin-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Periodic live health check of backend server
  useEffect(() => {
    let mounted = true;
    async function checkHealth() {
      try {
        await api.get('/health', { timeout: 3500 });
        if (mounted) setBackendOnline(true);
      } catch (_error) {
        if (mounted) setBackendOnline(false);
      }
    }
    checkHealth();
    const timer = setInterval(checkHealth, 8000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  if (checking) return <div className="app-loading"><div className="spinner" /><p>Checking administrator session…</p></div>;
  if (!isLoggedIn) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark brand-mark-small">CB</div>
          <div><strong>Bus Control</strong><span>Transport office</span></div>
        </div>
        <nav className="sidebar-nav" aria-label="Admin navigation">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
              <AdminSidebarIcon iconName={item.iconName} fallback={item.fallback} />
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="admin-label">Signed in as</span>
          <strong>{user?.id || 'Administrator'}</strong>
          <button type="button" onClick={logout} className="text-button" style={{ color: 'var(--muted)', padding: '2px 0', textAlign: 'left', fontSize: 11 }}>
            Sign out →
          </button>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}

      <div className="content-shell">
        <header className="topbar">
          <button type="button" className="menu-button" onClick={() => setMenuOpen((open) => !open)}
            aria-label="Open navigation">☰</button>
          <div>
            <p className="topbar-title">College transport administration</p>
            <p className="topbar-date">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' }).format(new Date())}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              type="button" 
              onClick={() => setIsDark(!isDark)}
              className="button button-ghost"
              aria-label="Toggle theme"
            >
              {isDark ? '☀️ Light' : '🌙 Dark'}
            </button>
            {backendOnline === true && (
              <span className="system-pill" title="Backend server is running and healthy">
                <i /> System online
              </span>
            )}
            {backendOnline === false && (
              <span className="system-pill system-pill-offline" title="Backend server is offline or unreachable">
                <i /> System offline
              </span>
            )}
            {backendOnline === null && (
              <span className="system-pill system-pill-checking" title="Checking backend connection...">
                <i /> Connecting…
              </span>
            )}
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
