import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { LoadingState, Notice, PageHeader } from '../components';

export default function OperationsScreen() {
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState(null);
  const load = () => api.get('/operations/summary')
    .then(({ data }) => { setSummary(data); setMessage(null); })
    .catch((error) => setMessage({ type: 'error', text: errorMessage(error, 'Operations summary could not be loaded.') }));
  useEffect(() => { load(); const timer = setInterval(load, 30_000); return () => clearInterval(timer); }, []);

  const cards = summary ? [
    ['Running trips', summary.runningTrips, summary.staleRunningTrips ? summary.staleRunningTrips + ' need GPS attention' : 'All reporting normally', summary.staleRunningTrips ? 'danger' : 'good'],
    ['Active late alerts', summary.activeLateAlerts, 'Open alert evidence and delivery', summary.activeLateAlerts ? 'warning' : 'good'],
    ['Pending notifications', summary.pendingNotifications, summary.failedNotifications + ' failed', summary.failedNotifications ? 'danger' : 'good'],
    ['Administrator sessions', summary.activeAdminSessions, 'Currently active server sessions', 'neutral'],
  ] : [];

  return <>
    <PageHeader eyebrow="System health" title="Operations centre" description="Privacy-safe live health for trips, alerts, delivery workers and administrator sessions. Refreshes every 30 seconds." actions={<button className="button button-secondary" onClick={load}>Refresh now</button>} />
    <Notice message={message} onDismiss={() => setMessage(null)} />
    {!summary ? <LoadingState label="Checking operational health…" /> : <>
      <section className="stats-grid">{cards.map(([label, value, note, tone]) => <article className={'panel stat-card health-' + tone} key={label}><p className="stat-label">{label}</p><p className="stat-value">{value}</p><p className="stat-note">{note}</p></article>)}</section>
      <section className="dashboard-grid">
        <article className="panel"><header className="panel-header"><h2>Response checklist</h2></header><div className="panel-body operations-list">
          <div><strong>Stale running trips</strong><span>Ask the assigned driver to reopen GPS sharing; do not infer passenger attendance.</span></div>
          <div><strong>Failed notifications</strong><span>Review the error in Late alerts, correct SMTP/provider configuration, then use audited retry.</span></div>
          <div><strong>Unexpected sessions</strong><span>Open Sessions and revoke one or all server-side administrator sessions.</span></div>
        </div></article>
        <article className="panel"><header className="panel-header"><h2>Quick actions</h2></header><div className="panel-body quick-links">
          <Link className="button button-secondary" to="/late-alerts">Review late alerts</Link>
          <Link className="button button-secondary" to="/sessions">Manage sessions</Link>
          <Link className="button button-secondary" to="/audit-log">Open audit history</Link>
        </div></article>
      </section>
      <p className="generated-note">Generated {new Date(summary.generatedAt).toLocaleString('en-IN')}</p>
    </>}
  </>;
}
