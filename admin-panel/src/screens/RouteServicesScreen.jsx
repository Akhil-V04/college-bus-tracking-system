import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { EmptyState, Field, LoadingState, Modal, Notice, PageHeader } from '../components';

const blankForm = { routeNo: '', name: '', areaCovered: '', capacity: 50, driverId: '' };

export default function RouteServicesScreen() {
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [assignedCounts, setAssignedCounts] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [routeResponse, driverResponse, passengerResponse] = await Promise.all([
        api.get('/route-services/admin', { params: { limit: 200 } }),
        api.get('/drivers', { params: { limit: 200 } }),
        api.get('/passenger/routes'),
      ]);
      setRoutes(routeResponse.data.items);
      setDrivers(driverResponse.data.items);
      setAssignedCounts(new Map(passengerResponse.data.map((route) => [route.id, route.assignedPassengerCount])));
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Routes could not be loaded.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing({ id: null });
    setForm(blankForm);
  }

  function openEdit(route) {
    setEditing(route);
    setForm({
      routeNo: route.routeNo,
      name: route.name,
      areaCovered: route.areaCovered,
      capacity: route.capacity,
      driverId: route.driverId ?? '',
    });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        routeNo: form.routeNo.trim(),
        name: form.name.trim(),
        areaCovered: form.areaCovered.trim(),
        capacity: Number(form.capacity),
        driverId: form.driverId === '' ? null : Number(form.driverId),
      };
      if (editing.id) await api.put(`/route-services/${editing.id}`, payload);
      else await api.post('/route-services', payload);
      setEditing(null);
      setMessage({ type: 'success', text: editing.id ? 'Route service updated.' : 'Route service created.' });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Route could not be saved.') });
    } finally {
      setSaving(false);
    }
  }

  async function remove(route) {
    if (!window.confirm(`Delete route ${route.routeNo}? Existing schedules, rosters, or trips will prevent deletion.`)) return;
    try {
      await api.delete(`/route-services/${route.id}`);
      setMessage({ type: 'success', text: `Route ${route.routeNo} deleted.` });
      load();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Route could not be deleted.') });
    }
  }

  return (
    <>
      <PageHeader eyebrow="Network configuration" title="Routes and capacity"
        description="The route number is also the operational bus number. Physical registration plates are intentionally not stored."
        actions={<button className="button button-primary" onClick={openCreate}>+ Add route</button>} />
      <Notice message={message} onDismiss={() => setMessage(null)} />
      {loading ? <LoadingState label="Loading route services…" /> : routes.length === 0 ? (
        <EmptyState title="No routes configured" description="Create the first operational route service." />
      ) : (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead><tr><th>Route</th><th>Area covered</th><th>Assigned driver</th><th>Assigned / capacity</th><th /></tr></thead>
            <tbody>{routes.map((route) => {
              const assigned = assignedCounts.get(route.id) || 0;
              const over = assigned > route.capacity;
              return <tr key={route.id}>
                <td><div className="cell-title">Route {route.routeNo}</div><div className="cell-subtitle">{route.name}</div></td>
                <td>{route.areaCovered}</td>
                <td>{route.driver ? <><div className="cell-title">{route.driver.name}</div><div className="cell-subtitle">{route.driver.driverCode}</div></> : <span className="cell-subtitle">Not assigned</span>}</td>
                <td><div className="cell-title" style={{ color: over ? 'var(--red)' : undefined }}>{assigned} / {route.capacity}</div><div className="capacity-meter"><i style={{ width: `${Math.min(100, (assigned / route.capacity) * 100)}%`, background: over ? 'var(--red)' : undefined }} /></div></td>
                <td><div className="row-actions"><button className="text-button" onClick={() => openEdit(route)}>Edit</button><button className="text-button text-button-danger" onClick={() => remove(route)}>Delete</button></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit route service' : 'Create route service'}
          description="One route number represents the passenger-facing bus service." onClose={() => setEditing(null)}>
          <form className="modal-body" onSubmit={save}>
            <div className="form-grid">
              <Field label="Route / bus number"><input value={form.routeNo} maxLength={30} onChange={(event) => setForm({ ...form, routeNo: event.target.value })} required /></Field>
              <Field label="Capacity" hint="Assigned passengers are checked against this number."><input type="number" min="1" max="200" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} required /></Field>
              <div className="form-span"><Field label="Route name"><input value={form.name} maxLength={150} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field></div>
              <div className="form-span"><Field label="Area covered"><textarea value={form.areaCovered} maxLength={500} onChange={(event) => setForm({ ...form, areaCovered: event.target.value })} required /></Field></div>
              <div className="form-span"><Field label="Assigned driver" hint="A driver can be assigned to only one route at a time."><select value={form.driverId} onChange={(event) => setForm({ ...form, driverId: event.target.value })}><option value="">No driver assigned</option>{drivers.filter((driver) => !driver.assignedRoute || driver.id === Number(form.driverId)).map((driver) => <option key={driver.id} value={driver.id}>{driver.driverCode} — {driver.name}</option>)}</select></Field></div>
            </div>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save route'}</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
