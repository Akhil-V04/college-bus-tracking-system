import { useEffect, useState, useCallback, useMemo } from 'react';
import api, { errorMessage } from '../api';
import { LoadingState, Notice, PageHeader, StatusBadge, EmptyState, Modal, Field } from '../components';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [message, setMessage] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    message: '',
    priority: 'NORMAL',
    targetType: 'GLOBAL',
    targetRoutes: [],
    expiresAt: '',
    autoPrefixRoutes: true,
  });

  const loadData = useCallback(async () => {
    try {
      const [notiRes, routeRes] = await Promise.all([
        api.get('/admin-notifications'),
        api.get('/route-services'),
      ]);
      setNotifications(Array.isArray(notiRes.data) ? notiRes.data : []);
      const routeList = Array.isArray(routeRes.data) ? routeRes.data : routeRes.data?.items || [];
      // Sort routes naturally (1, 2, 5, 10)
      routeList.sort((a, b) => String(a.routeNo).localeCompare(String(b.routeNo), undefined, { numeric: true }));
      setRoutes(routeList);
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'Failed to load notifications.') });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedRouteObjects = useMemo(() => {
    return routes.filter((r) => form.targetRoutes.includes(r.id));
  }, [routes, form.targetRoutes]);

  const selectedRouteNosFormatted = useMemo(() => {
    if (selectedRouteObjects.length === 0) return '';
    return selectedRouteObjects.map((r) => `Route ${r.routeNo}`).join(', ');
  }, [selectedRouteObjects]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      let finalTitle = form.title.trim();
      let finalMessage = form.message.trim();

      // If targeting specific routes and autoPrefixRoutes is enabled, ensure clear route tag is included
      if (form.targetType === 'ROUTE' && form.autoPrefixRoutes && selectedRouteObjects.length > 0) {
        const routePrefix = `[${selectedRouteObjects.map((r) => `Route ${r.routeNo}`).join(', ')}]`;
        if (!finalTitle.includes(routePrefix) && !finalTitle.toLowerCase().includes('route')) {
          finalTitle = `${routePrefix} ${finalTitle}`;
        }
      }

      const payload = {
        title: finalTitle,
        message: finalMessage,
        priority: form.priority,
        targetType: form.targetType,
        targetRoutes: form.targetRoutes,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };

      const res = await api.post('/admin-notifications', payload);
      setNotifications((prev) => [res.data, ...(prev || [])]);
      setIsCreating(false);
      setForm({
        title: '',
        message: '',
        priority: 'NORMAL',
        targetType: 'GLOBAL',
        targetRoutes: [],
        expiresAt: '',
        autoPrefixRoutes: true,
      });
      setMessage({
        type: 'success',
        text: `Broadcast published successfully${
          form.targetType === 'ROUTE' ? ` for ${selectedRouteNosFormatted}` : ' campus-wide'
        }.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'Failed to publish notification.') });
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this broadcast notification?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/admin-notifications/${id}`);
      setNotifications((prev) => (prev || []).filter((n) => n.id !== id));
      setMessage({ type: 'success', text: 'Notification removed successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'Failed to delete notification.') });
    } finally {
      setDeletingId(null);
    }
  }

  function handleRouteToggle(routeId) {
    setForm((prev) => {
      const exists = prev.targetRoutes.includes(routeId);
      if (exists) return { ...prev, targetRoutes: prev.targetRoutes.filter((id) => id !== routeId) };
      return { ...prev, targetRoutes: [...prev.targetRoutes, routeId] };
    });
  }

  function handleSelectAllRoutes() {
    setForm((prev) => ({
      ...prev,
      targetRoutes: routes.map((r) => r.id),
    }));
  }

  function handleClearAllRoutes() {
    setForm((prev) => ({
      ...prev,
      targetRoutes: [],
    }));
  }

  return (
    <>
      <PageHeader
        eyebrow="Campus Announcements"
        title="Broadcast Notifications"
        description="Publish announcements, schedule alerts, and route updates. Since passenger apps operate without login, notifications clearly display affected route numbers."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="button button-secondary" onClick={loadData}>
              Refresh
            </button>
            <button className="button button-primary" onClick={() => setIsCreating(true)}>
              New broadcast
            </button>
          </div>
        }
      />
      <Notice message={message} onDismiss={() => setMessage(null)} />

      {!notifications ? (
        <LoadingState label="Loading notifications..." />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="No broadcast announcements have been published yet."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Title & Message</th>
                <th>Target Routes</th>
                <th>Status</th>
                <th>Published At</th>
                <th>Expires</th>
                <th aria-label="Actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => {
                const routeLabels =
                  n.routesFormatted ||
                  (n.targetRouteNos && n.targetRouteNos.length > 0
                    ? n.targetRouteNos.map((r) => `Route ${r}`).join(', ')
                    : n.targetRoutes?.length
                    ? `${n.targetRoutes.length} Route(s)`
                    : 'All Routes');

                return (
                  <tr key={n.id}>
                    <td>
                      <StatusBadge value={n.priority} />
                    </td>
                    <td style={{ maxWidth: 340 }}>
                      <strong style={{ fontSize: 14 }}>{n.title}</strong>
                      <p className="cell-subtitle" style={{ whiteSpace: 'normal', marginTop: 4, lineHeight: 1.45 }}>
                        {n.message}
                      </p>
                    </td>
                    <td>
                      {n.targetType === 'GLOBAL' ? (
                        <span
                          className="status-badge"
                          style={{
                            background: 'var(--teal-soft)',
                            color: 'var(--teal)',
                            border: '1px solid rgba(234, 88, 12, 0.3)',
                          }}
                        >
                          📢 All Routes (Global)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span
                            className="status-badge"
                            style={{
                              background: 'rgba(234, 88, 12, 0.15)',
                              color: 'var(--teal)',
                              fontWeight: 800,
                            }}
                          >
                            🚌 {routeLabels}
                          </span>
                          <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                            Displayed in passenger app for these routes
                          </small>
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge value={n.status} />
                    </td>
                    <td>
                      <span className="cell-subtitle">
                        {new Date(n.publishedAt).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td>
                      {n.expiresAt ? (
                        <span className="cell-subtitle">
                          {new Date(n.expiresAt).toLocaleString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <button
                        className="button button-secondary"
                        style={{ fontSize: 12, padding: '4px 8px', color: 'var(--danger, #dc2626)' }}
                        onClick={() => handleDelete(n.id)}
                        disabled={deletingId === n.id}
                      >
                        {deletingId === n.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isCreating && (
        <Modal title="New Broadcast Notification" onClose={() => setIsCreating(false)} wide>
          <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'grid', gap: 16 }}>
            <Field label="Notification Title">
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Route 8 Bus Maintenance Notice"
              />
            </Field>

            <Field label="Message Text">
              <textarea
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="e.g. Route 8 bus is undergoing maintenance today. Students assigned to Route 8 should board Route 22 at the same stops."
                rows={4}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Priority Level">
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="NORMAL">NORMAL (Notice · Blue)</option>
                  <option value="IMPORTANT">IMPORTANT (Alert · Yellow)</option>
                  <option value="URGENT">URGENT (Critical · Red)</option>
                </select>
              </Field>

              <Field label="Expiration Time (Optional)">
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </Field>
            </div>

            <Field
              label="Target Audience"
              hint="Passengers do not need to log in. Specific route notifications are delivered to the app with clear route number tags so students immediately see their bus status."
            >
              <select
                value={form.targetType}
                onChange={(e) => setForm({ ...form, targetType: e.target.value, targetRoutes: [] })}
              >
                <option value="GLOBAL">Global (All Passengers / Campus-Wide)</option>
                <option value="ROUTE">Specific Routes (Tag Route Numbers)</option>
              </select>
            </Field>

            {form.targetType === 'ROUTE' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    Select Affected Routes ({form.targetRoutes.length} selected):
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleSelectAllRoutes}
                      className="button button-secondary"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllRoutes}
                      className="button button-secondary"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: 12,
                    display: 'grid',
                    gap: 8,
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    maxHeight: 200,
                    overflowY: 'auto',
                    border: '1px solid var(--line)',
                  }}
                >
                  {routes.map((r) => {
                    const isChecked = form.targetRoutes.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 8,
                          background: isChecked ? 'var(--teal-soft)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleRouteToggle(r.id)}
                        />
                        <span style={{ fontWeight: isChecked ? 800 : 500, fontSize: 13, color: isChecked ? 'var(--teal)' : 'var(--ink)' }}>
                          Route {r.routeNo}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Live Preview Box */}
                {selectedRouteObjects.length > 0 && (
                  <div
                    style={{
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.08) 0%, rgba(234, 88, 12, 0.02) 100%)',
                      border: '1px solid rgba(234, 88, 12, 0.35)',
                      borderRadius: 10,
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
                        Passenger App Notification Preview:
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="status-badge" style={{ background: 'var(--teal)', color: '#fff' }}>
                        🚌 {selectedRouteNosFormatted}
                      </span>
                      <strong style={{ fontSize: 14, color: 'var(--navy)' }}>
                        {form.title || 'Notification Title'}
                      </strong>
                    </div>
                    <p style={{ margin: 0, color: 'var(--ink)', fontSize: 13, lineHeight: 1.45 }}>
                      {form.message || 'Notification message text...'}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="button button-secondary" onClick={() => setIsCreating(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="button button-primary"
                disabled={form.targetType === 'ROUTE' && form.targetRoutes.length === 0}
              >
                Publish Broadcast
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
