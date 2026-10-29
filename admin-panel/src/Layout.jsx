import { useState, useEffect } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth';
import api from './api';

const navigation = [
  { to: '/', label: 'Overview', iconName: 'overview', fallback: '⌂', end: true },
  { to: '/routes', label: 'Routes & capacity', iconName: 'routes', fallback: '↝' },
  { to: '/stops', label: 'Stops & Map', iconName: 'stops', fallback: '📍' },
  { to: '/schedules', label: 'Schedules', iconName: 'schedules', fallback: '◷' },
  { to: '/schedule-builder', label: 'Event Overrides', iconName: 'schedule-builder', fallback: '⚡' },
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

  const [activeBreakdowns, setActiveBreakdowns] = useState([]);
  const [dismissedBreakdownIds, setDismissedBreakdownIds] = useState(new Set());

  // Periodic polling for active bus breakdown emergencies
  useEffect(() => {
    let mounted = true;
    async function fetchBreakdowns() {
      try {
        const res = await api.get('/emergencies/active');
        if (mounted && Array.isArray(res.data)) {
          setActiveBreakdowns(res.data);
        }
      } catch (_e) {
        // silent
      }
    }
    fetchBreakdowns();
    const interval = setInterval(fetchBreakdowns, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleResolveBreakdown = async (id) => {
    try {
      await api.patch(`/emergencies/${id}/status`, { status: 'RESOLVED' });
      setActiveBreakdowns((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert('Could not resolve breakdown: ' + (err?.response?.data?.error || err.message));
    }
  };

  const handleDismissBreakdown = (id) => {
    setDismissedBreakdownIds((prev) => new Set(prev).add(id));
  };

  const visibleBreakdowns = activeBreakdowns.filter((b) => !dismissedBreakdownIds.has(b.id));

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
          <div className="sidebar-footer-user">
            <span className="admin-status-dot" aria-hidden="true" />
            <div className="sidebar-footer-info">
              <strong>{user?.id || 'admin'}</strong>
              <span>Administrator</span>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="sidebar-signout-btn"
            title="Sign out of administration"
          >
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

        {/* ─── Real-Time Bus Breakdown Emergency Alerts ─── */}
        {visibleBreakdowns.length > 0 && (
          <div style={{ padding: '0 24px', marginTop: 16 }}>
            {visibleBreakdowns.map((b) => {
              const nearestBuses = (b.assistance || [])
                .map((a) => {
                  const rNo = a.candidateTrip?.routeService?.routeNo;
                  const km = a.distanceMeters != null ? (a.distanceMeters / 1000).toFixed(1) + ' km' : null;
                  return rNo ? `Route ${rNo}${km ? ` (${km})` : ''}` : null;
                })
                .filter(Boolean);

              return (
                <div
                  key={b.id}
                  style={{
                    backgroundColor: 'rgba(220, 38, 38, 0.12)',
                    border: '1.5px solid #EF4444',
                    borderRadius: 10,
                    padding: '14px 18px',
                    marginBottom: 12,
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 24, animation: 'pulse 1.5s infinite' }}>🚨</span>
                      <div>
                        <strong style={{ color: '#EF4444', fontSize: 16, letterSpacing: 0.5 }}>
                          ACTIVE BUS BREAKDOWN: Route {b.routeService?.routeNo || 'Bus'} ({b.routeService?.name || 'Assigned Route'})
                        </strong>
                        <div style={{ fontSize: 13, color: '#fca5a5', marginTop: 2 }}>
                          Driver in charge: <strong>{b.reporterDriver?.name || 'Driver'}</strong> (📞 <a href={`tel:${b.reporterDriver?.phone}`} style={{ color: '#FFFFFF', textDecoration: 'underline' }}>{b.reporterDriver?.phone}</a>) • Reported at {new Date(b.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleResolveBreakdown(b.id)}
                        className="button button-danger"
                        style={{ padding: '6px 14px', fontSize: 13, fontWeight: 700 }}
                      >
                        ✓ Mark Resolved
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissBreakdown(b.id)}
                        className="button button-ghost"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        ✕ Dismiss
                      </button>
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: '#e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}>
                    <div>
                      <strong>Incident Details:</strong> &quot;{b.description || 'Bus breakdown reported by driver - stopped on road'}&quot;
                      {b.incidentLatitude != null && (
                        <span style={{ marginLeft: 12, color: '#94a3b8' }}>
                          GPS: {b.incidentLatitude.toFixed(4)}, {b.incidentLongitude.toFixed(4)}
                        </span>
                      )}
                    </div>

                    <div>
                      <strong style={{ color: '#f59e0b' }}>Nearest 3 Buses Alerted:</strong>{' '}
                      {nearestBuses.length > 0 ? nearestBuses.join(' • ') : 'None active within 50 km'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <main className="page-content"><Outlet /></main>
        <footer className="admin-footer">
          <p>© 2026 Vignana Bharathi Institute of Technology (VBIT) Transport Administration</p>
          <div className="admin-footer-dev">
            <span className="admin-footer-pulse" aria-hidden="true" />
            <span>Developed by <strong>Akhil Vadeeboina</strong></span>
          </div>
        </footer>
      </div>
    </div>
  );
}
