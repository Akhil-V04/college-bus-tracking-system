import { useEffect, useState } from 'react';
import api from '../api';

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
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Delayed Buses Today</h1>
        <div className="flex gap-2">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {checking ? 'Checking...' : 'Re-check late buses'}
          </button>
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {verifying ? 'Verifying...' : 'Verify hash chain'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 rounded px-3 py-2 text-sm ${
            message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-slate-500">Loading...</div>
      ) : alerts.length === 0 ? (
        <div className="rounded bg-white py-10 text-center text-slate-400">
          No late buses today — every running trip is on schedule.
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const trip = alert.trip;
            const bus = trip?.bus;
            const affected = alert.studentsAffected || [];
            const advisors = alert.advisorsNotified || [];
            return (
              <div key={alert.id} className="rounded-lg bg-white p-5 shadow">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold text-slate-800">
                      {bus?.busNo || 'Bus ?'} · Route {bus?.route?.routeNo || '—'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {bus?.route?.name || ''} · Driver: {bus?.driver?.name || '—'}
                    </p>
                  </div>
                  <span className="rounded bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
                    Late — predicted arrival {fmtTime(alert.predictedEta)}
                  </span>
                </div>

                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Affected students ({affected.length})
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {affected.slice(0, 5).map((s) => s.name).join(', ')}
                      {affected.length > 5 ? ` +${affected.length - 5} more` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Advisors notified ({advisors.length})
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {advisors.length === 0
                        ? 'No matching class advisor on file'
                        : advisors.map((a) => `${a.name} (${a.email})`).join(', ')}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-400">
                  Alerted at {fmtTime(alert.triggeredAt)} · chain #{alert.id}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
