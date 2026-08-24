import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth';

const NAV = [
  { to: '/routes', label: 'Routes' },
  { to: '/stops', label: 'Stops' },
  { to: '/buses', label: 'Buses' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/students', label: 'Students' },
  { to: '/class-advisors', label: 'Class Advisors' },
];

export default function Layout() {
  const { isLoggedIn, role, logout } = useAuth();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-56 flex-col bg-slate-800 text-slate-100">
        <div className="border-b border-slate-700 px-4 py-4 text-sm font-semibold">
          Bus Tracking Admin
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm ${
                  isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/60'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {role === 'admin' && (
            <NavLink
              to="/delayed-buses"
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm ${
                  isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/60'
                }`
              }
            >
              Delayed Buses Today
            </NavLink>
          )}
        </nav>
        <div className="border-t border-slate-700 p-3">
          <button
            onClick={logout}
            className="w-full rounded bg-slate-700 py-2 text-sm hover:bg-slate-600"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}