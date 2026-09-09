import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { EmptyState, Field, LoadingState, Modal, Notice, PageHeader, StatusBadge } from '../components';

const emptyRoster = { name: '', academicYear: '', copyFromRosterId: '' };
const emptyPassenger = {
  routeServiceId: '', boardingStopId: '', passengerType: 'STUDENT', name: '', busPassId: '',
  rollNo: '', facultyId: '', department: '', year: '', section: '',
};

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export default function RostersScreen() {
  const [rosters, setRosters] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyRoster);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [passengerForm, setPassengerForm] = useState(emptyPassenger);
  const [saving, setSaving] = useState(false);
  const [exportingId, setExportingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rosterResponse, routeResponse, stopResponse] = await Promise.all([
        api.get('/rosters'),
        api.get('/route-services/admin', { params: { limit: 200 } }),
        api.get('/stops', { params: { limit: 200 } }),
      ]);
      setRosters(rosterResponse.data);
      setRoutes(routeResponse.data.items);
      setStops(stopResponse.data.items);
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Rosters could not be loaded.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openDetail(rosterId) {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/rosters/${rosterId}`, { params: { page: 1, limit: 200 } });
      setDetail(data);
      setPassengerForm(emptyPassenger);
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Roster details could not be loaded.') });
    } finally {
      setDetailLoading(false);
    }
  }

  async function createRoster(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), academicYear: form.academicYear.trim() };
      if (form.copyFromRosterId) payload.copyFromRosterId = Number(form.copyFromRosterId);
      await api.post('/rosters', payload);
      setCreating(false);
      setForm(emptyRoster);
      setMessage({ type: 'success', text: 'New annual roster draft created. The published roster is unchanged.' });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Roster draft could not be created.') });
    } finally {
      setSaving(false);
    }
  }

  async function addPassenger(event) {
    event.preventDefault();
    setSaving(true);
    const student = passengerForm.passengerType === 'STUDENT';
    try {
      await api.post(`/rosters/${detail.roster.id}/passengers`, {
        routeServiceId: Number(passengerForm.routeServiceId),
        boardingStopId: Number(passengerForm.boardingStopId),
        passengerType: passengerForm.passengerType,
        name: passengerForm.name.trim(),
        busPassId: passengerForm.busPassId.trim(),
        rollNo: student ? passengerForm.rollNo.trim() : null,
        facultyId: student ? null : passengerForm.facultyId.trim(),
        department: passengerForm.department.trim() || null,
        year: student ? Number(passengerForm.year) : null,
        section: student ? passengerForm.section.trim() : null,
      });
      await openDetail(detail.roster.id);
      setMessage({ type: 'success', text: `${student ? 'Student' : 'Faculty member'} added to the draft.` });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Passenger could not be added.') });
    } finally {
      setSaving(false);
    }
  }

  async function removePassenger(passenger) {
    if (!window.confirm(`Remove ${passenger.name} from this draft roster?`)) return;
    try {
      await api.delete(`/rosters/${detail.roster.id}/passengers/${passenger.id}`);
      await openDetail(detail.roster.id);
      setMessage({ type: 'success', text: 'Passenger removed from the draft.' });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Passenger could not be removed.') });
    }
  }

  async function validateRoster() {
    try {
      const { data } = await api.post(`/rosters/${detail.roster.id}/validate`);
      const warningText = data.warnings.map((item) => item.message).join(' ');
      const errorText = data.errors.map((item) => item.message).join(' ');
      if (!data.valid) setMessage({ type: 'error', text: errorText || 'Roster validation failed.' });
      else if (warningText) setMessage({ type: 'warning', text: `Roster is valid, with warnings: ${warningText}` });
      else setMessage({ type: 'success', text: 'Roster is valid and ready to publish.' });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Roster validation could not run.') });
    }
  }

  async function publishRoster() {
    if (!window.confirm('Publish this roster? The current passenger list will be archived and all passenger views will switch to this version.')) return;
    try {
      const { data } = await api.post(`/rosters/${detail.roster.id}/publish`);
      const warnings = data.warnings?.map((item) => item.message).join(' ');
      setDetail(null);
      setMessage({ type: warnings ? 'warning' : 'success', text: warnings ? `Roster published with warnings: ${warnings}` : 'Roster published successfully.' });
      await load();
    } catch (error) {
      const details = error.response?.data?.errors?.map((item) => item.message).join(' ');
      setMessage({ type: 'error', text: details || errorMessage(error, 'Roster could not be published.') });
    }
  }

  async function downloadCsv(roster) {
    setExportingId(roster.id);
    try {
      const passengers = [];
      let page = 1;
      let totalPages = 1;
      do {
        const { data } = await api.get(`/rosters/${roster.id}`, { params: { page, limit: 200 } });
        passengers.push(...data.passengers);
        totalPages = data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      const headers = ['Academic Year', 'Roster Version', 'Route Number', 'Route Name', 'Passenger Type', 'Name', 'Bus Pass ID', 'Student Roll No', 'Faculty ID', 'Department', 'Year', 'Section', 'Boarding Stop'];
      const rows = passengers.map((passenger) => [
        roster.academicYear, roster.version, passenger.routeService.routeNo, passenger.routeService.name,
        passenger.passengerType, passenger.name, passenger.busPassId, passenger.rollNo, passenger.facultyId,
        passenger.department, passenger.year, passenger.section, passenger.boardingStop.name,
      ]);
      const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `transport-roster-${roster.academicYear}-v${roster.version}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      setMessage({ type: 'success', text: `Downloaded ${passengers.length} passenger rows in table-column CSV format.` });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Roster CSV could not be downloaded.') });
    } finally {
      setExportingId(null);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Academic-year data" title="Annual rosters"
        description="Prepare next year's list in a draft. Publishing atomically archives the current list and updates passenger views."
        actions={<button className="button button-primary" onClick={() => setCreating(true)}>+ Create next-year draft</button>} />
      <Notice message={message} onDismiss={() => setMessage(null)} />
      {loading ? <LoadingState label="Loading annual rosters…" /> : rosters.length === 0 ? (
        <EmptyState title="No rosters yet" description="Create a draft for the current academic year." />
      ) : (
        <div className="panel table-wrap"><table className="data-table">
          <thead><tr><th>Roster</th><th>Academic year</th><th>Version</th><th>Passengers</th><th>Status</th><th /></tr></thead>
          <tbody>{rosters.map((roster) => <tr key={roster.id}>
            <td><div className="cell-title">{roster.name}</div><div className="cell-subtitle">Created {new Date(roster.createdAt).toLocaleDateString('en-IN')}</div></td>
            <td>{roster.academicYear}</td><td>v{roster.version}</td><td>{roster._count.passengers}</td><td><StatusBadge value={roster.status} /></td>
            <td><div className="row-actions"><button className="text-button" onClick={() => downloadCsv(roster)} disabled={exportingId === roster.id}>{exportingId === roster.id ? 'Exporting…' : 'Download CSV'}</button><button className="text-button" onClick={() => openDetail(roster.id)}>Manage</button></div></td>
          </tr>)}</tbody>
        </table></div>
      )}

      {creating && <Modal title="Create annual roster draft" description="You may start empty or copy a previous year, then review before publishing." onClose={() => setCreating(false)}>
        <form className="modal-body" onSubmit={createRoster}><div className="form-grid">
          <div className="form-span"><Field label="Draft name"><input value={form.name} maxLength={150} placeholder="2027–28 verified transport list" onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field></div>
          <div className="form-span"><Field label="Academic year" hint="Use a format such as 2027-28."><input value={form.academicYear} pattern="\d{4}-\d{2,4}" placeholder="2027-28" onChange={(event) => setForm({ ...form, academicYear: event.target.value })} required /></Field></div>
          <div className="form-span"><Field label="Copy passengers from" hint="Optional: useful when many assignments stay the same."><select value={form.copyFromRosterId} onChange={(event) => setForm({ ...form, copyFromRosterId: event.target.value })}><option value="">Start with an empty draft</option>{rosters.map((roster) => <option key={roster.id} value={roster.id}>{roster.academicYear} · {roster.name} · v{roster.version}</option>)}</select></Field></div>
        </div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setCreating(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Creating…' : 'Create draft'}</button></div></form>
      </Modal>}

      {(detail || detailLoading) && <Modal wide title={detail ? detail.roster.name : 'Loading roster'} description={detail ? `${detail.roster.academicYear} · Version ${detail.roster.version} · ${detail.pagination.total} passengers` : undefined} onClose={() => setDetail(null)}>
        {detailLoading && !detail ? <LoadingState label="Loading roster passengers…" /> : detail && <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}><StatusBadge value={detail.roster.status} /><div className="row-actions"><button className="button button-secondary" onClick={() => downloadCsv({ ...detail.roster, _count: { passengers: detail.pagination.total } })}>Download CSV</button><button className="button button-secondary" onClick={validateRoster}>Validate</button>{detail.roster.status === 'DRAFT' && <button className="button button-primary" onClick={publishRoster}>Publish</button>}</div></div>
          {detail.passengers.length === 0 ? <EmptyState title="No passengers in this draft" description="Add a student or faculty member below." /> : <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Passenger</th><th>Type</th><th>Identifier</th><th>Route / stop</th><th /></tr></thead><tbody>{detail.passengers.map((passenger) => <tr key={passenger.id}><td><div className="cell-title">{passenger.name}</div><div className="cell-subtitle">Pass {passenger.busPassId}</div></td><td><StatusBadge value={passenger.passengerType} /></td><td>{passenger.rollNo || passenger.facultyId}</td><td><div className="cell-title">Route {passenger.routeService.routeNo}</div><div className="cell-subtitle">{passenger.boardingStop.name}</div></td><td>{detail.roster.status === 'DRAFT' && <button className="text-button text-button-danger" onClick={() => removePassenger(passenger)}>Remove</button>}</td></tr>)}</tbody></table>{detail.pagination.totalPages > 1 && <p className="cell-subtitle" style={{ padding: 12 }}>Showing the first 200 passengers here. The CSV export includes all {detail.pagination.total} rows.</p>}</div>}
          {detail.roster.status === 'DRAFT' && <form onSubmit={addPassenger} style={{ marginTop: 20 }}><h3 style={{ color: 'var(--navy)', fontSize: 15 }}>Add passenger</h3><div className="form-grid">
            <Field label="Passenger type"><select value={passengerForm.passengerType} onChange={(event) => setPassengerForm({ ...emptyPassenger, passengerType: event.target.value })}><option value="STUDENT">Student</option><option value="FACULTY">Faculty</option></select></Field>
            <Field label="Bus pass ID"><input value={passengerForm.busPassId} onChange={(event) => setPassengerForm({ ...passengerForm, busPassId: event.target.value })} required /></Field>
            <div className="form-span"><Field label="Full name"><input value={passengerForm.name} onChange={(event) => setPassengerForm({ ...passengerForm, name: event.target.value })} required /></Field></div>
            <Field label="Route"><select value={passengerForm.routeServiceId} onChange={(event) => setPassengerForm({ ...passengerForm, routeServiceId: event.target.value })} required><option value="">Select route</option>{routes.map((route) => <option key={route.id} value={route.id}>Route {route.routeNo} — {route.name}</option>)}</select></Field>
            <Field label="Boarding stop"><select value={passengerForm.boardingStopId} onChange={(event) => setPassengerForm({ ...passengerForm, boardingStopId: event.target.value })} required><option value="">Select stop</option>{stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select></Field>
            {passengerForm.passengerType === 'STUDENT' ? <><Field label="Student roll number"><input value={passengerForm.rollNo} onChange={(event) => setPassengerForm({ ...passengerForm, rollNo: event.target.value })} required /></Field><Field label="Department"><input value={passengerForm.department} onChange={(event) => setPassengerForm({ ...passengerForm, department: event.target.value })} required /></Field><Field label="Year"><input type="number" min="1" max="10" value={passengerForm.year} onChange={(event) => setPassengerForm({ ...passengerForm, year: event.target.value })} required /></Field><Field label="Section"><input value={passengerForm.section} onChange={(event) => setPassengerForm({ ...passengerForm, section: event.target.value })} required /></Field></> : <><Field label="Faculty ID"><input value={passengerForm.facultyId} onChange={(event) => setPassengerForm({ ...passengerForm, facultyId: event.target.value })} required /></Field><Field label="Department (optional)"><input value={passengerForm.department} onChange={(event) => setPassengerForm({ ...passengerForm, department: event.target.value })} /></Field></>}
          </div><div className="modal-actions"><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Adding…' : 'Add passenger'}</button></div></form>}
        </div>}
      </Modal>}
    </>
  );
}