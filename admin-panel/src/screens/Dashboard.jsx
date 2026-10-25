import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { LoadingState, Notice, PageHeader, StatusBadge } from '../components';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState(null);
  const [showAllRoutes, setShowAllRoutes] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/route-services/admin', { params: { limit: 200 } }),
      api.get('/drivers', { params: { limit: 200 } }),
      api.get('/rosters'),
      api.get('/schedules'),
      api.get('/class-advisors', { params: { limit: 200 } }),
      api.get('/late-alerts'),
      api.get('/passenger/routes').catch(() => ({ data: [] })),
    ])
      .then(([routes, drivers, rosters, schedules, advisors, alerts, passengerRoutes]) => {
        if (!active) return;
        const passengerCounts = new Map(
          (passengerRoutes.data || []).map((route) => [route.id, route.assignedPassengerCount])
        );
        setData({
          routes: routes.data.items,
          drivers: drivers.data.items,
          rosters: rosters.data,
          schedules: schedules.data,
          advisors: advisors.data.items,
          alerts: alerts.data,
          passengerCounts,
        });
      })
      .catch((error) => {
        if (active) setMessage({ type: 'error', text: errorMessage(error, 'Dashboard could not be loaded.') });
      });
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => {
    if (!data) return null;
    const publishedRoster = data.rosters.find((roster) => roster.status === 'PUBLISHED');
    return {
      publishedRoster,
      draftRosters: data.rosters.filter((roster) => roster.status === 'DRAFT').length,
      publishedSchedules: data.schedules.filter((schedule) => schedule.status === 'PUBLISHED').length,
      unassignedRoutes: data.routes.filter((route) => !route.driver).length,
    };
  }, [data]);

  const displayRoutes = useMemo(() => {
    if (!data?.routes) return [];
    return showAllRoutes ? data.routes : data.routes.slice(0, 8);
  }, [data?.routes, showAllRoutes]);

  return (
    <>
      <PageHeader eyebrow="Operations overview" title="Transport dashboard"
        description="A live administrative summary of routes, assigned passengers, schedules, and late-bus evidence."
        actions={<Link className="button button-primary" to="/rosters">Manage annual roster</Link>} />
      <Notice message={message} onDismiss={() => setMessage(null)} />
      {!data ? <LoadingState label="Loading transport operations…" /> : (
        <>
          <section className="stats-grid">
            <article className="panel stat-card"><p className="stat-label">Route services</p><p className="stat-value">{data.routes.length}</p><p className="stat-note">{summary.unassignedRoutes} without a driver</p></article>
            <article className="panel stat-card"><p className="stat-label">Assigned passengers</p><p className="stat-value">{summary.publishedRoster?._count?.passengers || 0}</p><p className="stat-note">{summary.publishedRoster?.academicYear || 'No published roster'}</p></article>
            <article className="panel stat-card"><p className="stat-label">Published schedules</p><p className="stat-value">{summary.publishedSchedules}</p><p className="stat-note">{data.schedules.length} total versions</p></article>
            <article className="panel stat-card"><p className="stat-label">Late alerts today</p><p className="stat-value">{data.alerts.length}</p><p className="stat-note">{data.alerts.filter((alert) => alert.status === 'ACTIVE').length} currently active</p></article>
          </section>

          <section className="dashboard-grid">
            <article className="panel">
              <header className="panel-header">
                <h2>Route capacity overview</h2>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {data.routes.length > 8 && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setShowAllRoutes((prev) => !prev)}
                    >
                      {showAllRoutes ? 'Show top 8' : `Show all ${data.routes.length}`}
                    </button>
                  )}
                  <Link className="text-button" to="/routes">Open routes</Link>
                </div>
              </header>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Route</th><th>Driver</th><th>Assigned / Capacity</th></tr></thead>
                  <tbody>
                    {displayRoutes.map((route) => {
                      const assigned =
                        route.assignedPassengerCount ??
                        route._count?.rosterPassengers ??
                        data.passengerCounts?.get(route.id) ??
                        0;
                      const percentage = route.capacity > 0 ? Math.min(100, Math.round((assigned / route.capacity) * 100)) : 0;
                      const over = assigned > route.capacity;
                      return <tr key={route.id}>
                        <td><div className="cell-title">Route {route.routeNo}</div><div className="cell-subtitle">{route.name}</div></td>
                        <td>{route.driver?.name || <span className="cell-subtitle">Not assigned</span>}</td>
                        <td>
                          <div className="cell-title" style={{ color: over ? 'var(--red)' : undefined }}>
                            {assigned} / {route.capacity} seats <span className="cell-subtitle" style={{ fontSize: 11, marginLeft: 4 }}>({percentage}%)</span>
                          </div>
                          <div className="capacity-meter">
                            <i style={{ width: `${percentage}%`, background: over ? 'var(--red)' : undefined }} />
                          </div>
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
              {data.routes.length > 8 && (
                <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', fontSize: 12 }}>
                  <span className="cell-subtitle">Showing {displayRoutes.length} of {data.routes.length} routes</span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setShowAllRoutes((prev) => !prev)}
                  >
                    {showAllRoutes ? 'Collapse to top 8' : `View all ${data.routes.length} routes →`}
                  </button>
                </div>
              )}
            </article>

            <div style={{ display: 'grid', gap: 18 }}>
              <article className="panel">
                <header className="panel-header"><h2>Roster lifecycle</h2><Link className="text-button" to="/rosters">View all</Link></header>
                <div className="panel-body">
                  {summary.publishedRoster ? <>
                    <StatusBadge value={summary.publishedRoster.status} />
                    <h3 style={{ margin: '12px 0 4px', color: 'var(--navy)' }}>{summary.publishedRoster.name}</h3>
                    <p className="cell-subtitle">{summary.publishedRoster.academicYear} · Version {summary.publishedRoster.version}</p>
                  </> : <p className="cell-subtitle">No roster is published.</p>}
                  <p style={{ margin: '17px 0 0', fontSize: 12, color: 'var(--muted)' }}>{summary.draftRosters} draft roster(s) awaiting validation or publication.</p>
                </div>
              </article>
              <article className="panel">
                <header className="panel-header"><h2>Configuration coverage</h2></header>
                <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
                  <div><strong>{data.drivers.length}</strong> <span className="cell-subtitle">drivers stored privately</span></div>
                  <div><strong>{data.advisors.length}</strong> <span className="cell-subtitle">class advisor mappings</span></div>
                  <div><strong>{data.routes.length - summary.unassignedRoutes}</strong> <span className="cell-subtitle">routes with assigned drivers</span></div>
                </div>
              </article>
            </div>
          </section>
        </>
      )}
    </>
  );
}
