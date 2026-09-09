import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { EmptyState, LoadingState, Notice, PageHeader, StatusBadge } from '../components';
import { useAuth } from '../auth';

export default function SessionsScreen() {
  const { logout } = useAuth();
  const [sessions, setSessions] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setSessions(null);
    api.get('/auth/admin/sessions')
      .then(({ data }) => setSessions(data))
      .catch((error) => setMessage({ type: 'error', text: errorMessage(error, 'Sessions could not be loaded.') }));
  }, []);
  useEffect(load, [load]);

  const revoke = async (session) => {
    if (!window.confirm(session.current ? 'Revoke this session and sign out now?' : 'Revoke this administrator session?')) return;
    setBusy(session.id);
    try {
      await api.post('/auth/admin/sessions/' + session.id + '/revoke');
      if (session.current) return logout();
      setMessage({ type: 'success', text: 'Session revoked.' });
      load();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Session could not be revoked.') });
    } finally { setBusy(null); }
  };

  const revokeAll = async () => {
    if (!window.confirm('Revoke every administrator session, including this one? You will be signed out.')) return;
    setBusy('all');
    try { await api.post('/auth/admin/sessions/revoke-all'); } finally { await logout(); }
  };

  return <>
    <PageHeader eyebrow="Security" title="Administrator sessions"
      description="Review server-side sessions and revoke access immediately. No device fingerprints or IP addresses are stored." actions={<button className="button button-danger" onClick={revokeAll} disabled={Boolean(busy)}>Revoke all sessions</button>} />
    <Notice message={message} onDismiss={() => setMessage(null)} />
    {!sessions ? <LoadingState label="Loading administrator sessions…" /> : sessions.length === 0 ?
      <EmptyState title="No sessions found" description="Sign in again to create a session." /> :
      <section className="panel"><div className="table-wrap"><table className="data-table">
        <thead><tr><th>Created</th><th>Expires</th><th>Status</th><th>Reason</th><th aria-label="Actions" /></tr></thead>
        <tbody>{sessions.map((session) => <tr key={session.id}>
          <td><div className="cell-title">{new Date(session.createdAt).toLocaleString('en-IN')}</div><div className="cell-subtitle">{session.current ? 'Current session' : session.id.slice(0, 8) + '…'}</div></td>
          <td>{new Date(session.expiresAt).toLocaleString('en-IN')}</td>
          <td><StatusBadge value={session.status} /></td>
          <td>{session.revokeReason || '—'}</td>
          <td><div className="row-actions"><button className="button button-danger" disabled={session.status !== 'ACTIVE' || Boolean(busy)} onClick={() => revoke(session)}>{busy === session.id ? 'Revoking…' : 'Revoke'}</button></div></td>
        </tr>)}</tbody>
      </table></div></section>}
  </>;
}
