import { useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth';

const navigation = [
  { to: '/', label: 'Overview', icon: '⌂', end: true },
  { to: '/routes', label: 'Routes & capacity', icon: '↝' },
  { to: '/schedules', label: 'Schedules', icon: '◷' },
  { to: '/rosters', label: 'Annual rosters', icon: '▤' },
  { to: '/drivers', label: 'Drivers', icon: '◉' },
  { to: '/class-advisors', label: 'Class advisors', icon: '◎' },
  { to: '/late-alerts', label: 'Late alerts', icon: '!' },
  { to: '/operations', label: 'Operations', icon: '⌁' },
  { to: '/audit-log', label: 'Audit history', icon: '✓' },
  { to: '/sessions', label: 'Sessions', icon: '◌' },

  { to: '/issues', label: 'AI Issues', icon: '◆' },
  { to: '/knowledge', label: 'Knowledge base', icon: '▣' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
];

export default function Layout() {
  const { checking, isLoggedIn, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="admin-label">Signed in as</span>
          <strong>{user?.id || 'Administrator'}</strong>
          <button type="button" className="button button-ghost button-wide" onClick={logout}>Sign out</button>
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
          <span className="system-pill"><i /> System online</span>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
