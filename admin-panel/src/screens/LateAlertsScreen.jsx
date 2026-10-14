import { useEffect, useState } from 'react';
import api from '../api';
import { EmptyState, LoadingState, Notice, PageHeader } from '../components';

// "Delayed Buses Today" dashboard. Shows every late alert triggered for
// running trips, lets the admin re-run the late check, and verifies the
// SHA-256 hash chain that makes the alert history tamper-evident.
export default function LateAlertsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/late-alerts');
      setAlerts(data || []);
      setMessage(null);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load: ' + (err.response?.data?.error || err.message) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const { data } = await api.post('/late-alerts/check');
      setMessage({
        type: 'success',
        text: `Checked running trips — ${data.triggered.length} new alert(s) triggered`,
      });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: 'Check failed: ' + (err.response?.data?.error || err.message) });
    } finally {
      setChecking(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const { data } = await api.get('/late-alerts/verify');
      setMessage(
        data.valid
          ? { type: 'success', text: `Hash chain valid — ${data.count} alert(s), no tampering` }
          : { type: 'error', text: `Chain INVALID at alert #${data.id}: ${data.reason}` }
      );
    } catch (err) {
      setMessage({ type: 'error', text: 'Verify failed: ' + (err.response?.data?.error || err.message) });
    } finally {
      setVerifying(false);
    }
  };

  const fmtTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <PageHeader
        eyebrow="Trip Monitoring"
        title="Delayed Buses Today"
        description="Monitor automated delay detections and verify cryptographic hash chains of trip notifications."
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleCheck}
              disabled={checking}
              className="button button-primary"
            >
              {checking ? 'Checking…' : 'Re-check late buses'}
            </button>
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="button button-secondary"
            >
              {verifying ? 'Verifying…' : 'Verify hash chain'}
            </button>
          </div>
        }
      />

      <Notice message={message} onDismiss={() => setMessage(null)} />

      {loading ? (
        <LoadingState label="Loading late alerts…" />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="No late buses today"
          description="Every running trip is currently operating on schedule."
        />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {alerts.map((alert) => {
            const trip = alert.trip;
            const bus = trip?.bus;
            const affected = alert.studentsAffected || [];
            const advisors = alert.advisorsNotified || [];
            return (
              <article key={alert.id} className="panel" style={{ padding: 22 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p className="cell-title" style={{ fontSize: 16 }}>
                      {bus?.busNo || 'Bus ?'} · Route {bus?.route?.routeNo || '—'}
                    </p>
                    <p className="cell-subtitle">
                      {bus?.route?.name || ''} · Driver: {bus?.driver?.name || '—'}
                    </p>
                  </div>
                  <span className="status-badge status-active">
                    Late — predicted arrival {fmtTime(alert.predictedEta)}
                  </span>
                </div>

                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                  <div>
                    <p className="stat-label">
                      Affected students ({affected.length})
                    </p>
                    <p style={{ margin: '4px 0 0', color: 'var(--ink)', fontSize: 13, lineHeight: 1.5 }}>
                      {affected.slice(0, 5).map((s) => s.name).join(', ')}
                      {affected.length > 5 ? ` +${affected.length - 5} more` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="stat-label">
                      Advisors notified ({advisors.length})
                    </p>
                    <p style={{ margin: '4px 0 0', color: 'var(--ink)', fontSize: 13, lineHeight: 1.5 }}>
                      {advisors.length === 0
                        ? 'No matching class advisor on file'
                        : advisors.map((a) => `${a.name} (${a.email})`).join(', ')}
                    </p>
                  </div>
                </div>

                <p className="cell-subtitle" style={{ marginTop: 14, fontSize: 11 }}>
                  Alerted at {fmtTime(alert.triggeredAt)} · chain #{alert.id}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
