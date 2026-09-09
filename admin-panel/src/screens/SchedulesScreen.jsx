import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { EmptyState, Field, LoadingState, Modal, Notice, PageHeader, StatusBadge } from '../components';

const emptySchedule = { routeServiceId: '', name: '', direction: 'MORNING', effectiveFrom: '' };
const emptyStop = { stopId: '', sequenceOrder: 0, scheduledTime: '07:00' };

export default function SchedulesScreen() {
  const [schedules, setSchedules] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptySchedule);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stopForm, setStopForm] = useState(emptyStop);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduleResponse, routeResponse, stopResponse] = await Promise.all([
        api.get('/schedules'),
        api.get('/route-services/admin', { params: { limit: 200 } }),
        api.get('/stops', { params: { limit: 200 } }),
      ]);
      setSchedules(scheduleResponse.data);
      setRoutes(routeResponse.data.items);
      setStops(stopResponse.data.items);
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Schedules could not be loaded.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openDetail(scheduleId) {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/schedules/${scheduleId}`);
      setDetail(data);
      setStopForm({ ...emptyStop, sequenceOrder: data.stops.length });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Schedule details could not be loaded.') });
    } finally {
      setDetailLoading(false);
    }
  }

  async function createSchedule(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/schedules', {
        routeServiceId: Number(form.routeServiceId),
        name: form.name.trim(),
        direction: form.direction.trim().toUpperCase(),
        effectiveFrom: form.effectiveFrom || null,
      });
      setCreating(false);
      setForm(emptySchedule);
      setMessage({ type: 'success', text: 'Draft schedule created. Add its stops before publishing.' });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Schedule could not be created.') });
    } finally {
      setSaving(false);
    }
  }

  async function addStop(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(`/schedules/${detail.id}/stops`, {
        stopId: Number(stopForm.stopId),
        sequenceOrder: Number(stopForm.sequenceOrder),
        scheduledTime: stopForm.scheduledTime,
      });
      await openDetail(detail.id);
      setMessage({ type: 'success', text: 'Stop added to the draft schedule.' });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Stop could not be added.') });
    } finally {
      setSaving(false);
    }
  }

  async function removeStop(entry) {
    if (!window.confirm(`Remove ${entry.stop.name} from this draft schedule?`)) return;
    try {
      await api.delete(`/schedules/${detail.id}/stops/${entry.id}`);
      await openDetail(detail.id);
      setMessage({ type: 'success', text: 'Schedule stop removed.' });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Schedule stop could not be removed.') });
    }
  }

  async function validateSchedule() {
    try {
      const { data } = await api.post(`/schedules/${detail.id}/validate`);
      setMessage(data.valid
        ? { type: 'success', text: 'Schedule is valid and ready to publish.' }
        : { type: 'error', text: data.errors.join(' ') });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Schedule validation failed.') });
    }
  }

  async function publishSchedule() {
    if (!window.confirm('Publish this schedule? The currently published version for this route and direction will be archived.')) return;
    try {
      await api.post(`/schedules/${detail.id}/publish`);
      setDetail(null);
      setMessage({ type: 'success', text: 'Schedule published. Passenger views now use this version.' });
      await load();
    } catch (error) {
      const details = error.response?.data?.errors?.join(' ');
      setMessage({ type: 'error', text: details || errorMessage(error, 'Schedule could not be published.') });
    }
  }

  return (
    <>
      <PageHeader eyebrow="Timetable management" title="Schedules"
        description="Build draft stop timelines, validate their order, and publish one active version per route and direction."
        actions={<button className="button button-primary" onClick={() => setCreating(true)}>+ New schedule</button>} />
      <Notice message={message} onDismiss={() => setMessage(null)} />
      {loading ? <LoadingState label="Loading schedules…" /> : schedules.length === 0 ? (
        <EmptyState title="No schedules yet" description="Create a draft schedule and add at least two ordered stops." />
      ) : (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead><tr><th>Route</th><th>Schedule</th><th>Direction</th><th>Version</th><th>Stops</th><th>Status</th><th /></tr></thead>
            <tbody>{schedules.map((schedule) => <tr key={schedule.id}>
              <td><div className="cell-title">Route {schedule.routeService.routeNo}</div><div className="cell-subtitle">{schedule.routeService.name}</div></td>
              <td>{schedule.name}</td><td>{schedule.direction}</td><td>v{schedule.version}</td><td>{schedule._count.stops}</td>
              <td><StatusBadge value={schedule.status} /></td>
              <td><button className="text-button" onClick={() => openDetail(schedule.id)}>Manage</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}

      {creating && <Modal title="Create draft schedule" description="The version number is assigned automatically." onClose={() => setCreating(false)}>
        <form className="modal-body" onSubmit={createSchedule}>
          <div className="form-grid">
            <div className="form-span"><Field label="Route"><select value={form.routeServiceId} onChange={(event) => setForm({ ...form, routeServiceId: event.target.value })} required><option value="">Select route</option>{routes.map((route) => <option key={route.id} value={route.id}>Route {route.routeNo} — {route.name}</option>)}</select></Field></div>
            <div className="form-span"><Field label="Schedule name"><input value={form.name} maxLength={150} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field></div>
            <Field label="Direction"><select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })}><option value="MORNING">Morning / to college</option><option value="EVENING">Evening / from college</option></select></Field>
            <Field label="Effective from"><input type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /></Field>
          </div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setCreating(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Creating…' : 'Create draft'}</button></div>
        </form>
      </Modal>}

      {(detail || detailLoading) && <Modal wide title={detail ? `${detail.name} · Route ${detail.routeService.routeNo}` : 'Loading schedule'} description={detail ? `Version ${detail.version} · ${detail.direction}` : undefined} onClose={() => setDetail(null)}>
        {detailLoading && !detail ? <LoadingState label="Loading schedule stops…" /> : detail && <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}><StatusBadge value={detail.status} /><div className="row-actions"><button className="button button-secondary" onClick={validateSchedule}>Validate</button>{detail.status === 'DRAFT' && <button className="button button-primary" onClick={publishSchedule}>Publish</button>}</div></div>
          {detail.stops.length === 0 ? <EmptyState title="No stops in this draft" description="Add the first stop below." /> : <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Stop</th><th>Time</th><th /></tr></thead><tbody>{detail.stops.map((entry) => <tr key={entry.id}><td>{entry.sequenceOrder}</td><td>{entry.stop.name}</td><td>{entry.scheduledTime}</td><td>{detail.status === 'DRAFT' && <button className="text-button text-button-danger" onClick={() => removeStop(entry)}>Remove</button>}</td></tr>)}</tbody></table></div>}
          {detail.status === 'DRAFT' && <form onSubmit={addStop} style={{ marginTop: 20 }}><h3 style={{ color: 'var(--navy)', fontSize: 15 }}>Add stop</h3><div className="form-grid"><div className="form-span"><Field label="Stop"><select value={stopForm.stopId} onChange={(event) => setStopForm({ ...stopForm, stopId: event.target.value })} required><option value="">Select stop</option>{stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select></Field></div><Field label="Sequence"><input type="number" min="0" value={stopForm.sequenceOrder} onChange={(event) => setStopForm({ ...stopForm, sequenceOrder: event.target.value })} required /></Field><Field label="Scheduled arrival"><input type="time" value={stopForm.scheduledTime} onChange={(event) => setStopForm({ ...stopForm, scheduledTime: event.target.value })} required /></Field></div><div className="modal-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add stop'}</button></div></form>}
        </div>}
      </Modal>}
    </>
  );
}