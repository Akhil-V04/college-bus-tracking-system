import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { LoadingState, Notice, PageHeader, StatusBadge, EmptyState, Modal, Field } from '../components';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [message, setMessage] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', priority: 'NORMAL', targetType: 'GLOBAL', targetRoutes: [], expiresAt: '' });

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/admin-notifications'),
      api.get('/route-services')
    ])
      .then(([notiRes, routeRes]) => {
        if (active) {
          setNotifications(notiRes.data);
          setRoutes(routeRes.data);
        }
      })
      .catch((err) => {
        if (active) setMessage({ type: 'error', text: errorMessage(err, 'Failed to load notifications.') });
      });
    return () => { active = false; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };
      const res = await api.post('/admin-notifications', payload);
      setNotifications([res.data, ...notifications]);
      setIsCreating(false);
      setForm({ title: '', message: '', priority: 'NORMAL', targetType: 'GLOBAL', targetRoutes: [], expiresAt: '' });
      setMessage({ type: 'success', text: 'Notification published successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'Failed to publish notification.') });
    }
  }

  function handleRouteToggle(routeId) {
    setForm(prev => {
      const exists = prev.targetRoutes.includes(routeId);
      if (exists) return { ...prev, targetRoutes: prev.targetRoutes.filter(id => id !== routeId) };
      return { ...prev, targetRoutes: [...prev.targetRoutes, routeId] };
    });
  }

  return (
    <>
      <PageHeader
        title="Broadcast Notifications"
        description="Publish announcements, service changes, and alerts to all passengers or specific routes."
        actions={<button className="button button-primary" onClick={() => setIsCreating(true)}>New broadcast</button>}
      />
      <Notice message={message} onDismiss={() => setMessage(null)} />

      {!notifications ? (
        <LoadingState label="Loading notifications..." />
      ) : notifications.length === 0 ? (
        <EmptyState title="No notifications" description="No broadcast notifications have been published yet." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Title & Message</th>
                <th>Target</th>
                <th>Status</th>
                <th>Published At</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id}>
                  <td><StatusBadge value={n.priority} /></td>
                  <td style={{ maxWidth: 300 }}>
                    <strong>{n.title}</strong>
                    <p className="cell-subtitle" style={{ whiteSpace: 'normal', marginTop: 4 }}>{n.message}</p>
                  </td>
                  <td>
                    {n.targetType === 'GLOBAL' ? 'Global' : `${n.targetRoutes?.length || 0} Route(s)`}
                  </td>
                  <td><StatusBadge value={n.status} /></td>
                  <td><span className="cell-subtitle">{new Date(n.publishedAt).toLocaleString('en-IN')}</span></td>
                  <td>
                    {n.expiresAt ? (
                      <span className="cell-subtitle">{new Date(n.expiresAt).toLocaleString('en-IN')}</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreating && (
        <Modal title="New Broadcast Notification" onClose={() => setIsCreating(false)} wide>
          <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'grid', gap: 16 }}>
            <Field label="Notification Title">
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} 
                placeholder="e.g. Route 8 Bus Condition" />
            </Field>

            <Field label="Message">
              <textarea required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} 
                placeholder="e.g. Route 8 bus is not in condition today. Students should board Route 22." rows={4} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Priority">
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="NORMAL">NORMAL (Notice)</option>
                  <option value="IMPORTANT">IMPORTANT (Yellow)</option>
                  <option value="URGENT">URGENT (Red/Critical)</option>
                </select>
              </Field>

              <Field label="Expiration Time (Optional)">
                <input type="datetime-local" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
              </Field>
            </div>

            <Field label="Target Audience">
              <select value={form.targetType} onChange={e => setForm({ ...form, targetType: e.target.value, targetRoutes: [] })}>
                <option value="GLOBAL">Global (All Passengers)</option>
                <option value="ROUTE">Specific Routes</option>
              </select>
            </Field>

            {form.targetType === 'ROUTE' && (
              <div className="panel" style={{ padding: 12, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', maxHeight: 200, overflowY: 'auto' }}>
                {routes.map(r => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input 
                      type="checkbox" 
                      checked={form.targetRoutes.includes(r.id)}
                      onChange={() => handleRouteToggle(r.id)} 
                    />
                    {r.routeNo}
                  </label>
                ))}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="button" onClick={() => setIsCreating(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={form.targetType === 'ROUTE' && form.targetRoutes.length === 0}>
                Publish Broadcast
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
