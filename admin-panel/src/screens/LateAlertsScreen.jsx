import { useEffect, useState } from 'react';
import api from '../api';
import { EmptyState, LoadingState, Modal, Notice, PageHeader, Field } from '../components';

// "Delayed Buses Today" dashboard. Shows every late alert triggered for
// running trips, compares ETAs against the 9:45 AM college arrival cutoff,
// lets the admin configure the deadline, re-run checks, and verify hash chains.
export default function LateAlertsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState(null);

  // Cutoff deadline state (e.g., 9:45 AM)
  const [deadlineInfo, setDeadlineInfo] = useState({
    deadline: '09:45',
    formatted: '9:45 AM',
    timeZone: 'Asia/Kolkata',
    deadlineTodayIso: null,
  });
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [editDeadline, setEditDeadline] = useState('09:45');
  const [savingDeadline, setSavingDeadline] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [alertsRes, deadlineRes] = await Promise.allSettled([
        api.get('/late-alerts'),
        api.get('/late-alerts/deadline'),
      ]);

      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value.data || []);
      } else {
        throw alertsRes.reason;
      }

      if (deadlineRes.status === 'fulfilled' && deadlineRes.value?.data) {
        setDeadlineInfo(deadlineRes.value.data);
        setEditDeadline(deadlineRes.value.data.deadline || '09:45');
      }
      setMessage(null);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load: ' + (err.response?.data?.error || err.message) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const { data } = await api.post('/late-alerts/check');
      setMessage({
        type: 'success',
        text: `Checked running trips against ${deadlineInfo.formatted || '9:45 AM'} cutoff — ${data.triggered?.length || 0} alert(s) active`,
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

  const handleSaveDeadline = async (e) => {
    e.preventDefault();
    if (!editDeadline || !/^\d{2}:\d{2}$/.test(editDeadline.trim())) {
      setMessage({ type: 'error', text: 'Please enter a valid HH:MM time (e.g. 09:45)' });
      return;
    }
    setSavingDeadline(true);
    try {
      const { data } = await api.patch('/late-alerts/deadline', { deadline: editDeadline.trim() });
      setDeadlineInfo((prev) => ({
        ...prev,
        deadline: data.deadline,
        formatted: data.formatted,
      }));
      setShowDeadlineModal(false);
      setMessage({
        type: 'success',
        text: `College arrival cutoff updated to ${data.formatted} (${data.deadline})`,
      });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update cutoff: ' + (err.response?.data?.error || err.message) });
    } finally {
      setSavingDeadline(false);
    }
  };

  const fmtTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Aggregated stat counters
  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');
  const totalStudents = alerts.reduce((acc, a) => acc + (a.studentsAffected?.length || 0), 0);
  const totalAdvisors = alerts.reduce((acc, a) => acc + (a.advisorsNotified?.length || 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Trip Monitoring & Punctuality"
        title="Delayed Buses Today"
        description="Monitor automated delay detections based on the campus arrival cutoff, manage dispatch alerts, and verify cryptographic hash chains."
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setEditDeadline(deadlineInfo.deadline || '09:45');
                setShowDeadlineModal(true);
              }}
              className="button button-secondary"
            >
              ⏰ Cutoff: {deadlineInfo.formatted || '9:45 AM'}
            </button>
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

      {/* Prominent Operational Arrival Cutoff Banner */}
      <div
        className="panel"
        style={{
          padding: '18px 22px',
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(234, 88, 12, 0.03) 100%)',
          border: '1px solid rgba(234, 88, 12, 0.35)',
          borderRadius: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(145deg, var(--teal), var(--teal-dark))',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 24,
              boxShadow: '0 6px 16px rgba(234, 88, 12, 0.35)',
              flexShrink: 0,
            }}
          >
            ⏰
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                College Arrival Cutoff: <span style={{ color: 'var(--teal)' }}>{deadlineInfo.formatted || '9:45 AM'}</span>
              </h3>
              <span
                className="status-badge"
                style={{
                  background: 'var(--teal-soft)',
                  color: 'var(--teal)',
                  border: '1px solid rgba(234, 88, 12, 0.4)',
                  padding: '3px 8px',
                }}
              >
                Last Time of Arrival
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
              <strong>{deadlineInfo.formatted || '9:45 AM'}</strong> is the designated arrival cutoff time for morning routes. Any bus projected to arrive past this threshold triggers automatic delay alerts to concerned department advisors and students.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditDeadline(deadlineInfo.deadline || '09:45');
            setShowDeadlineModal(true);
          }}
          className="button button-secondary"
          style={{ fontSize: 12.5, padding: '8px 14px' }}
        >
          ⚙ Change Cutoff Time
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        <div className="panel stat-card">
          <p className="stat-label">Arrival Cutoff</p>
          <p className="stat-value" style={{ color: 'var(--teal)' }}>
            {deadlineInfo.formatted || '9:45 AM'}
          </p>
          <p className="stat-note">Last arrival window ({deadlineInfo.timeZone || 'Asia/Kolkata'})</p>
        </div>

        <div className="panel stat-card">
          <p className="stat-label">Delayed Trips Today</p>
          <p className="stat-value" style={{ color: activeAlerts.length > 0 ? 'var(--red)' : 'var(--green)' }}>
            {activeAlerts.length}
          </p>
          <p className="stat-note">{alerts.length} total alert record(s)</p>
        </div>

        <div className="panel stat-card">
          <p className="stat-label">Affected Students</p>
          <p className="stat-value">{totalStudents}</p>
          <p className="stat-note">En route on delayed morning buses</p>
        </div>

        <div className="panel stat-card">
          <p className="stat-label">Advisors Alerted</p>
          <p className="stat-value">{totalAdvisors}</p>
          <p className="stat-note">Academic advisors notified by SMS/Email</p>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading late alerts…" />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="No late buses today"
          description={`Every running trip is currently operating on schedule and projected to reach campus before the ${deadlineInfo.formatted || '9:45 AM'} arrival cutoff.`}
        />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {alerts.map((alert) => {
            const trip = alert.trip;
            const route = trip?.routeService || trip?.bus?.route;
            const driver = trip?.driver || trip?.bus?.driver;
            const affected = alert.studentsAffected || [];
            const advisors = alert.advisorsNotified || [];
            const notifications = alert.notifications || [];

            // Compute delay relative to cutoff
            const cutoffDate = trip?.collegeDeadlineAt
              ? new Date(trip.collegeDeadlineAt)
              : deadlineInfo.deadlineTodayIso
              ? new Date(deadlineInfo.deadlineTodayIso)
              : null;
            const etaDate = alert.predictedEta ? new Date(alert.predictedEta) : null;
            let delayMinutes = null;
            if (cutoffDate && etaDate) {
              const diffMs = etaDate.getTime() - cutoffDate.getTime();
              delayMinutes = Math.max(1, Math.round(diffMs / 60000));
            }

            return (
              <article key={alert.id} className="panel" style={{ padding: 22 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p className="cell-title" style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>Route {route?.routeNo || '—'} {route?.name ? `· ${route.name}` : ''}</span>
                    </p>
                    <p className="cell-subtitle">
                      Driver: {driver?.name || 'Assigned Driver'} · Trip #{trip?.id || alert.tripId}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="status-badge status-active">
                      Late · Predicted {fmtTime(alert.predictedEta)}
                    </span>
                    {delayMinutes != null && (
                      <span
                        className="status-badge"
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: 'var(--red)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}
                      >
                        +{delayMinutes} min past {deadlineInfo.formatted || '9:45 AM'} cutoff
                      </span>
                    )}
                  </div>
                </div>

                {/* Timeline / Cutoff Comparison Card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16,
                    padding: '11px 16px',
                    margin: '14px 0 16px',
                    background: 'var(--canvas)',
                    borderRadius: 10,
                    border: '1px solid var(--line)',
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--muted)' }}>Campus Arrival Cutoff:</span>
                    <strong style={{ color: 'var(--ink)' }}>{deadlineInfo.formatted || '9:45 AM'}</strong>
                  </div>
                  <span style={{ color: 'var(--muted)' }}>→</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--muted)' }}>Estimated Arrival:</span>
                    <strong style={{ color: 'var(--red)' }}>{fmtTime(alert.predictedEta)}</strong>
                  </div>
                  {delayMinutes != null && (
                    <span style={{ color: 'var(--red)', fontWeight: 700 }}>
                      (+{delayMinutes} mins overdue)
                    </span>
                  )}
                  <div style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 11.5 }}>
                    Alert dispatched: {fmtTime(alert.triggeredAt)}
                  </div>
                </div>

                {/* Impact breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                  <div>
                    <p className="stat-label">
                      Affected students ({affected.length})
                    </p>
                    <p style={{ margin: '4px 0 0', color: 'var(--ink)', fontSize: 13, lineHeight: 1.5 }}>
                      {affected.length === 0 ? (
                        <span style={{ color: 'var(--muted)' }}>No passenger manifest attached</span>
                      ) : (
                        <>
                          {affected.slice(0, 5).map((s) => s.name || s.studentId || 'Student').join(', ')}
                          {affected.length > 5 ? ` +${affected.length - 5} more` : ''}
                        </>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="stat-label">
                      Advisors notified ({advisors.length})
                    </p>
                    <p style={{ margin: '4px 0 0', color: 'var(--ink)', fontSize: 13, lineHeight: 1.5 }}>
                      {advisors.length === 0
                        ? 'No matching class advisor on file'
                        : advisors.map((a) => `${a.name} (${a.email || 'Advisor'})`).join(', ')}
                    </p>
                  </div>
                </div>

                {/* Outbox notification delivery indicators if present */}
                {notifications.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--line)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Delivery status:
                    </span>
                    {notifications.map((n) => (
                      <span
                        key={n.id}
                        className={`status-badge status-${String(n.status).toLowerCase()}`}
                        style={{ fontSize: 10 }}
                        title={n.lastError || `Sent to ${n.recipient}`}
                      >
                        {n.recipient}: {n.status}
                      </span>
                    ))}
                  </div>
                )}

                <p className="cell-subtitle" style={{ marginTop: 14, fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Alerted at {fmtTime(alert.triggeredAt)} · Cryptographic Chain Record #{alert.id}</span>
                  {alert.recordHash && (
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)' }}>
                      Hash: {alert.recordHash.slice(0, 16)}…
                    </span>
                  )}
                </p>
              </article>
            );
          })}
        </div>
      )}

      {/* Configure Cutoff Time Modal */}
      {showDeadlineModal && (
        <Modal
          title="Configure College Arrival Cutoff"
          description="Adjust the official morning arrival cutoff time. Any active morning trip projected to arrive past this threshold triggers automatic late alerts."
          onClose={() => setShowDeadlineModal(false)}
        >
          <div className="modal-body">
            <form onSubmit={handleSaveDeadline} className="stack-form">
              <Field
                label="Arrival Cutoff Time (24h HH:MM format)"
                hint="Set the time after which buses are officially late. Example: 09:45 for 9:45 AM."
              >
                <input
                  type="time"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  required
                />
              </Field>

              {/* Quick Presets */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  Quick Presets:
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['09:30', '09:45', '10:00'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditDeadline(preset)}
                      className={`button ${editDeadline === preset ? 'button-primary' : 'button-secondary'}`}
                      style={{ fontSize: 12, padding: '5px 11px' }}
                    >
                      {preset === '09:45' ? '09:45 AM (Standard)' : `${preset} AM`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDeadlineModal(false)}
                  className="button button-secondary"
                  disabled={savingDeadline}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={savingDeadline}
                >
                  {savingDeadline ? 'Saving…' : 'Save Cutoff Time'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
