import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { EmptyState, Field, LoadingState, Modal, Notice, PageHeader, StatusBadge } from '../components';

const emptyRoster = { name: '', academicYear: '', copyFromRosterId: '' };
const emptyPassenger = {
  routeServiceId: '', boardingStopId: '', passengerType: 'STUDENT', name: '',
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
  const [publishing, setPublishing] = useState(false);
  const [detailNotice, setDetailNotice] = useState(null);
  const [exportingId, setExportingId] = useState(null);

  // Excel / CSV Import states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTargetRoster, setImportTargetRoster] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [importing, setImporting] = useState(false);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

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
    const rollNo = student ? passengerForm.rollNo.trim() : null;
    const facultyId = student ? null : passengerForm.facultyId.trim();
    const autoPassId = student ? `PASS-${rollNo}` : `PASS-${facultyId}`;
    try {
      await api.post(`/rosters/${detail.roster.id}/passengers`, {
        routeServiceId: Number(passengerForm.routeServiceId),
        boardingStopId: Number(passengerForm.boardingStopId),
        passengerType: passengerForm.passengerType,
        name: passengerForm.name.trim(),
        busPassId: autoPassId,
        rollNo,
        facultyId,
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
    if (!detail) return;
    setDetailNotice({ type: 'info', text: 'Validating roster against route capacities and class advisors...' });
    try {
      const { data } = await api.post(`/rosters/${detail.roster.id}/validate`, {}, { timeout: 60000 });
      const warningText = data.warnings?.map((item) => item.message).join(' ');
      const errorText = data.errors?.map((item) => item.message).join(' ');
      if (!data.valid) {
        setDetailNotice({ type: 'error', text: errorText || 'Roster validation failed.' });
      } else if (warningText) {
        setDetailNotice({ type: 'warning', text: `Roster is valid! Non-blocking warnings: ${warningText}` });
      } else {
        setDetailNotice({ type: 'success', text: 'Roster is verified and ready to publish.' });
      }
    } catch (error) {
      setDetailNotice({ type: 'error', text: errorMessage(error, 'Roster validation could not run.') });
    }
  }

  async function publishRoster() {
    if (!window.confirm('Publish this roster? The current passenger list will be archived and all passenger views will switch to this version.')) return;
    setPublishing(true);
    setDetailNotice(null);
    try {
      const { data } = await api.post(`/rosters/${detail.roster.id}/publish`, { confirmed: true }, { timeout: 180000 });
      const warnings = data.warnings?.map((item) => item.message).join(' ');
      setDetail(null);
      setMessage({ type: warnings ? 'warning' : 'success', text: warnings ? `Roster published with warnings: ${warnings}` : 'Roster published successfully.' });
      await load();
    } catch (error) {
      const details = error.response?.data?.errors?.map((item) => item.message).join(' ');
      const msg = details || errorMessage(error, 'Roster could not be published.');
      setDetailNotice({ type: 'error', text: msg });
      setMessage({ type: 'error', text: msg });
    } finally {
      setPublishing(false);
    }
  }

  async function deleteRoster(roster) {
    if (roster.status === 'PUBLISHED') {
      setMessage({ type: 'error', text: 'Cannot delete the active published roster. Please publish another roster first.' });
      return;
    }
    const passengerCount = roster._count?.passengers ?? detail?.pagination?.total ?? 0;
    const passengerNotice = passengerCount > 0 ? ` and its ${passengerCount} passenger assignment(s)` : '';
    if (!window.confirm(`Are you sure you want to delete the roster "${roster.name}" (${roster.academicYear} v${roster.version})${passengerNotice}? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/rosters/${roster.id}`);
      setMessage({ type: 'success', text: `Roster "${roster.name}" deleted successfully.` });
      if (detail?.roster?.id === roster.id) {
        setDetail(null);
      }
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Roster could not be deleted.') });
    }
  }

  async function downloadCsv(roster) {
    setExportingId(roster.id);
    try {
      const response = await api.get(`/rosters/${roster.id}/export?format=csv`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `transport-roster-${roster.academicYear}-v${roster.version}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      setMessage({ type: 'success', text: 'Downloaded roster CSV (.csv).' });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Roster CSV could not be downloaded.') });
    } finally {
      setExportingId(null);
    }
  }

  async function downloadTemplate(format = 'xlsx') {
    try {
      const response = await api.get(`/rosters/template?format=${format}`, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `annual-roster-import-template.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      setMessage({ type: 'success', text: `Downloaded annual roster template (.${format}). Fill student & faculty details and upload.` });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Roster template could not be downloaded.') });
    }
  }

  async function downloadDriverTemplate() {
    try {
      const response = await api.get('/drivers/import/template', { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'driver-import-template.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      setMessage({ type: 'success', text: 'Downloaded driver master template (.xlsx).' });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Driver template could not be downloaded.') });
    }
  }

  async function downloadXlsx(roster) {
    setExportingId(roster.id);
    try {
      const response = await api.get(`/rosters/${roster.id}/export?format=xlsx`, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `transport-roster-${roster.academicYear}-v${roster.version}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      setMessage({ type: 'success', text: 'Downloaded roster workbook (.xlsx).' });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Roster workbook could not be downloaded.') });
    } finally {
      setExportingId(null);
    }
  }

  function openImportModal(roster) {
    setImportTargetRoster(roster);
    setImportFile(null);
    setImportPreview(null);
    setPreviewLoading(false);
    setPreviewError('');
    setShowErrorsOnly(false);
    setImportModalOpen(true);
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setPreviewLoading(true);
    setPreviewError('');
    setImportPreview(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(`/rosters/${importTargetRoster.id}/import/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      });
      setImportPreview(data);
    } catch (error) {
      setPreviewError(errorMessage(error, 'Failed to inspect Excel file. Please ensure sheets and columns match the template.'));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmImport() {
    if (!importTargetRoster || !importFile || !importPreview) return;
    setImporting(true);
    setPreviewError('');
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('confirmed', 'true');
      const { data } = await api.post(`/rosters/${importTargetRoster.id}/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-preview-digest': importPreview.previewDigest,
          'x-roster-version': String(importTargetRoster.version),
        },
        timeout: 180000,
      });
      setImportModalOpen(false);
      setMessage({
        type: 'success',
        text: `Successfully imported ${data.importedCount || importPreview.summary.validRows} passengers into draft roster (${importTargetRoster.name}).`,
      });
      if (detail && detail.roster.id === importTargetRoster.id) {
        await openDetail(importTargetRoster.id);
      }
      await load();
    } catch (error) {
      setPreviewError(errorMessage(error, 'Import failed. The draft roster or master data may have changed.'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Academic-year data"
        title="Annual rosters"
        description="Prepare next year's student & faculty passenger list in a draft. Upload Excel (.xlsx) files to bulk-assign routes, check capacities, and eliminate duplicates."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="button button-secondary" onClick={() => downloadTemplate('xlsx')} title="Download pre-formatted Excel template with instructions and reference sheets">
              📥 Roster Template (.xlsx)
            </button>
            <button className="button button-secondary" onClick={downloadDriverTemplate} title="Download driver master import template">
              📥 Driver Template (.xlsx)
            </button>
            <button className="button button-primary" onClick={() => setCreating(true)}>
              + Create new draft
            </button>
          </div>
        }
      />

      <Notice message={message} onDismiss={() => setMessage(null)} />

      {loading ? (
        <LoadingState label="Loading annual rosters…" />
      ) : rosters.length === 0 ? (
        <EmptyState title="No rosters yet" description="Create a draft for the current academic year." />
      ) : (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Roster</th>
                <th>Academic year</th>
                <th>Version</th>
                <th>Passengers</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rosters.map((roster) => (
                <tr key={roster.id}>
                  <td>
                    <div className="cell-title">{roster.name}</div>
                    <div className="cell-subtitle">Created {new Date(roster.createdAt).toLocaleDateString('en-IN')}</div>
                  </td>
                  <td>{roster.academicYear}</td>
                  <td>v{roster.version}</td>
                  <td>{roster._count.passengers}</td>
                  <td><StatusBadge value={roster.status} /></td>
                  <td>
                    <div className="row-actions">
                      {roster.status === 'DRAFT' && (
                        <button
                          className="text-button"
                          style={{ color: 'var(--teal)', fontWeight: 700 }}
                          onClick={() => openImportModal(roster)}
                        >
                          📤 Upload Excel
                        </button>
                      )}
                      <button className="text-button" onClick={() => downloadXlsx(roster)} disabled={exportingId === roster.id}>
                        {exportingId === roster.id ? 'Exporting…' : 'Export Excel'}
                      </button>
                      <button className="text-button" onClick={() => downloadCsv(roster)} disabled={exportingId === roster.id}>
                        CSV
                      </button>
                      <button className="text-button" onClick={() => openDetail(roster.id)}>
                        Manage
                      </button>
                      {roster.status !== 'PUBLISHED' && (
                        <button
                          className="text-button text-button-danger"
                          onClick={() => deleteRoster(roster)}
                          title="Delete this roster"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create draft modal */}
      {creating && (
        <Modal title="Create annual roster draft" description="You may start empty or copy a previous year, then review before publishing." onClose={() => setCreating(false)}>
          <form className="modal-body" onSubmit={createRoster}>
            <div className="form-grid">
              <div className="form-span">
                <Field label="Draft name">
                  <input value={form.name} maxLength={150} placeholder="2027–28 verified transport list" onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                </Field>
              </div>
              <div className="form-span">
                <Field label="Academic year" hint="Use a format such as 2027-28.">
                  <input value={form.academicYear} pattern="\d{4}-\d{2,4}" placeholder="2027-28" onChange={(event) => setForm({ ...form, academicYear: event.target.value })} required />
                </Field>
              </div>
              <div className="form-span">
                <Field label="Copy passengers from" hint="Optional: useful when many assignments stay the same.">
                  <select value={form.copyFromRosterId} onChange={(event) => setForm({ ...form, copyFromRosterId: event.target.value })}>
                    <option value="">Start with an empty draft</option>
                    {rosters.map((roster) => (
                      <option key={roster.id} value={roster.id}>
                        {roster.academicYear} · {roster.name} · v{roster.version}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setCreating(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Creating…' : 'Create draft'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Roster detail modal */}
      {(detail || detailLoading) && (
        <Modal wide title={detail ? detail.roster.name : 'Loading roster'} description={detail ? `${detail.roster.academicYear} · Version ${detail.roster.version} · ${detail.pagination.total} passengers` : undefined} onClose={() => setDetail(null)}>
          {detailLoading && !detail ? (
            <LoadingState label="Loading roster passengers…" />
          ) : detail && (
            <div className="modal-body">
              {detailNotice && (
                <div style={{ marginBottom: 14 }}>
                  <Notice message={detailNotice} onDismiss={() => setDetailNotice(null)} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                <StatusBadge value={detail.roster.status} />
                <div className="row-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {detail.roster.status === 'DRAFT' && (
                    <button className="button button-primary" onClick={() => openImportModal(detail.roster)}>
                      📤 Upload Excel Sheet
                    </button>
                  )}
                  <button className="button button-secondary" onClick={() => downloadXlsx(detail.roster)}>
                    Download Excel (.xlsx)
                  </button>
                  <button className="button button-secondary" onClick={() => downloadCsv({ ...detail.roster, _count: { passengers: detail.pagination.total } })}>
                    CSV
                  </button>
                  <button className="button button-secondary" onClick={validateRoster}>
                    Validate
                  </button>
                  {detail.roster.status === 'DRAFT' && (
                    <button className="button button-primary" onClick={publishRoster} disabled={publishing}>
                      {publishing ? 'Publishing…' : 'Publish'}
                    </button>
                  )}
                  {detail.roster.status !== 'PUBLISHED' && (
                    <button
                      className="button button-danger"
                      onClick={() => deleteRoster({ ...detail.roster, _count: { passengers: detail.pagination.total } })}
                    >
                      Delete roster
                    </button>
                  )}
                </div>
              </div>

              {detail.passengers.length === 0 ? (
                <EmptyState title="No passengers in this draft" description="Upload an Excel sheet or add a student or faculty member below." />
              ) : (
                <div className="panel table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Passenger</th>
                        <th>Type</th>
                        <th>Identifier / Roll No</th>
                        <th>Class / Dept</th>
                        <th>Route / stop</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {detail.passengers.map((passenger) => (
                        <tr key={passenger.id}>
                          <td>
                            <div className="cell-title">{passenger.name}</div>
                            <div className="cell-subtitle">
                              {passenger.passengerType === 'STUDENT' ? passenger.rollNo : (passenger.facultyId || 'Faculty')}
                            </div>
                          </td>
                          <td><StatusBadge value={passenger.passengerType} /></td>
                          <td>
                            {passenger.passengerType === 'STUDENT' ? (
                              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{passenger.rollNo}</span>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>{passenger.facultyId || 'Faculty'}</span>
                            )}
                          </td>
                          <td>
                            {passenger.department ? (
                              <div>
                                {passenger.department}
                                {passenger.year ? ` · Year ${passenger.year}` : ''}
                                {passenger.section ? `-${passenger.section}` : ''}
                              </div>
                            ) : '—'}
                          </td>
                          <td>
                            <div className="cell-title">Route {passenger.routeService.routeNo}</div>
                            <div className="cell-subtitle">{passenger.boardingStop.name}</div>
                          </td>
                          <td>
                            {detail.roster.status === 'DRAFT' && (
                              <button className="text-button text-button-danger" onClick={() => removePassenger(passenger)}>
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {detail.pagination.totalPages > 1 && (
                    <p className="cell-subtitle" style={{ padding: 12 }}>
                      Showing the first 200 passengers here. The Excel export includes all {detail.pagination.total} rows.
                    </p>
                  )}
                </div>
              )}

              {/* Add Single Passenger Form */}
              {detail.roster.status === 'DRAFT' && (
                <form onSubmit={addPassenger} style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
                  <h3 style={{ color: 'var(--navy)', fontSize: 15, margin: '0 0 14px' }}>Add passenger manually</h3>
                  <div className="form-grid">
                    <Field label="Passenger type">
                      <select value={passengerForm.passengerType} onChange={(event) => setPassengerForm({ ...emptyPassenger, passengerType: event.target.value })}>
                        <option value="STUDENT">Student</option>
                        <option value="FACULTY">Faculty</option>
                      </select>
                    </Field>
                    <Field label="Full name">
                      <input value={passengerForm.name} placeholder="e.g. Rahul Sharma" onChange={(event) => setPassengerForm({ ...passengerForm, name: event.target.value })} required />
                    </Field>
                    <Field label="Route">
                      <select value={passengerForm.routeServiceId} onChange={(event) => setPassengerForm({ ...passengerForm, routeServiceId: event.target.value })} required>
                        <option value="">Select route</option>
                        {routes.map((route) => (
                          <option key={route.id} value={route.id}>
                            Route {route.routeNo} — {route.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Boarding stop">
                      <select value={passengerForm.boardingStopId} onChange={(event) => setPassengerForm({ ...passengerForm, boardingStopId: event.target.value })} required>
                        <option value="">Select stop</option>
                        {stops.map((stop) => (
                          <option key={stop.id} value={stop.id}>{stop.name}</option>
                        ))}
                      </select>
                    </Field>
                    {passengerForm.passengerType === 'STUDENT' ? (
                      <>
                        <Field label="Student roll number">
                          <input value={passengerForm.rollNo} placeholder="e.g. 24B01A0501" onChange={(event) => setPassengerForm({ ...passengerForm, rollNo: event.target.value })} required />
                        </Field>
                        <Field label="Department">
                          <input value={passengerForm.department} placeholder="e.g. CSE" onChange={(event) => setPassengerForm({ ...passengerForm, department: event.target.value })} required />
                        </Field>
                        <Field label="Year">
                          <input type="number" min="1" max="10" placeholder="1-4" value={passengerForm.year} onChange={(event) => setPassengerForm({ ...passengerForm, year: event.target.value })} required />
                        </Field>
                        <Field label="Section">
                          <input value={passengerForm.section} placeholder="e.g. A" onChange={(event) => setPassengerForm({ ...passengerForm, section: event.target.value })} required />
                        </Field>
                      </>
                    ) : (
                      <>
                        <Field label="Faculty ID">
                          <input value={passengerForm.facultyId} placeholder="e.g. FAC-CSE-012" onChange={(event) => setPassengerForm({ ...passengerForm, facultyId: event.target.value })} required />
                        </Field>
                        <Field label="Department (optional)">
                          <input value={passengerForm.department} placeholder="e.g. ECE" onChange={(event) => setPassengerForm({ ...passengerForm, department: event.target.value })} />
                        </Field>
                      </>
                    )}
                  </div>
                  <div className="modal-actions">
                    <button type="submit" className="button button-primary" disabled={saving}>
                      {saving ? 'Adding…' : 'Add passenger'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Excel / CSV Import Modal */}
      {importModalOpen && importTargetRoster && (
        <Modal
          wide
          title={`Upload Excel Sheet — ${importTargetRoster.name}`}
          description={`Academic Year ${importTargetRoster.academicYear} · Draft v${importTargetRoster.version}`}
          onClose={() => setImportModalOpen(false)}
        >
          <div className="modal-body">
            {/* Guidance banner */}
            <div style={{ background: 'var(--canvas)', border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <strong style={{ display: 'block', color: 'var(--navy)', fontSize: 14 }}>
                    Automated Excel Ingestion & Verification
                  </strong>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
                    Upload your annual student & faculty spreadsheet. The system verifies every row against published stops and bus capacities, flags duplicates, and ensures student roll numbers are valid.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => downloadTemplate('xlsx')}
                  style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  📥 Download Pre-Filled Template (.xlsx)
                </button>
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)' }}>
                <span>• <strong>Students:</strong> Type=STUDENT, Roll Number, Name, Dept, Year, Sec, Route Number, Boarding Stop</span>
                <span>• <strong>Faculty:</strong> Type=FACULTY, Faculty ID, Name, Dept, Route Number, Boarding Stop</span>
                <span>• <strong>No Data Leaks:</strong> Phone numbers and private emails are excluded from passenger visibility</span>
              </div>
            </div>

            {/* File dropzone / selector */}
            <div style={{
              border: '2px dashed var(--line)',
              borderRadius: 14,
              padding: 24,
              textAlign: 'center',
              background: 'var(--surface)',
              marginBottom: 18,
            }}>
              <input
                id="roster-file-input"
                type="file"
                accept=".xlsx,.csv"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <label
                htmlFor="roster-file-input"
                style={{ cursor: 'pointer', display: 'inline-block' }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                <strong style={{ display: 'block', color: 'var(--teal)', fontSize: 14, textDecoration: 'underline' }}>
                  {importFile ? importFile.name : 'Click to select Excel (.xlsx) or CSV file'}
                </strong>
                <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                  {importFile ? `${(importFile.size / 1024).toFixed(1)} KB — Click to change file` : 'Supports standard college transport sheets (up to 10,000 rows)'}
                </span>
              </label>
            </div>

            {/* Error notice if preview failed */}
            {previewError && (
              <div className="notice notice-error">
                <span>{previewError}</span>
              </div>
            )}

            {/* Loading preview state */}
            {previewLoading && (
              <LoadingState label="Inspecting Excel rows, verifying boarding stops, and checking bus capacities…" />
            )}

            {/* Preview Results */}
            {importPreview && !previewLoading && (
              <div>
                {/* Stats 4-grid */}
                <div className="stats-grid" style={{ marginBottom: 16 }}>
                  <div className="panel stat-card">
                    <p className="stat-label">Total Rows</p>
                    <p className="stat-value">{importPreview.summary.totalRows}</p>
                    <p className="stat-note">in spreadsheet</p>
                  </div>
                  <div className="panel stat-card" style={{ borderLeft: '3px solid var(--green)' }}>
                    <p className="stat-label">Valid Rows</p>
                    <p className="stat-value" style={{ color: 'var(--green)' }}>{importPreview.summary.validRows}</p>
                    <p className="stat-note">ready to import</p>
                  </div>
                  <div className="panel stat-card" style={{ borderLeft: importPreview.summary.invalidRows > 0 ? '3px solid var(--red)' : '3px solid var(--green)' }}>
                    <p className="stat-label">Invalid Rows</p>
                    <p className="stat-value" style={{ color: importPreview.summary.invalidRows > 0 ? 'var(--red)' : 'var(--green)' }}>
                      {importPreview.summary.invalidRows}
                    </p>
                    <p className="stat-note">{importPreview.summary.invalidRows > 0 ? 'require correction' : 'clean'}</p>
                  </div>
                  <div className="panel stat-card" style={{ borderLeft: importPreview.summary.warnings > 0 ? '3px solid var(--warning)' : '3px solid var(--line)' }}>
                    <p className="stat-label">Warnings</p>
                    <p className="stat-value" style={{ color: importPreview.summary.warnings > 0 ? 'var(--warning)' : 'var(--muted)' }}>
                      {importPreview.summary.warnings}
                    </p>
                    <p className="stat-note">non-blocking notices</p>
                  </div>
                </div>

                {/* Extra columns notice */}
                {importPreview.unknownHeaders?.length > 0 && (
                  <div className="notice notice-info" style={{ marginBottom: 14 }}>
                    <span>
                      ℹ️ <strong>Extra columns detected:</strong> {importPreview.unknownHeaders.join(', ')}. These columns will be safely ignored without disrupting passenger ingestion.
                    </span>
                  </div>
                )}

                {/* Status banner */}
                {importPreview.summary.invalidRows > 0 ? (
                  <div className="notice notice-error" style={{ marginBottom: 14 }}>
                    <span>
                      ⚠️ <strong>Validation blocked:</strong> {importPreview.summary.invalidRows} row(s) contain errors (e.g. stop not on route, duplicate roll numbers, or over-capacity). Review the issues below and correct your Excel sheet.
                    </span>
                  </div>
                ) : (
                  <div className="notice notice-success" style={{ marginBottom: 14 }}>
                    <span>
                      ✓ <strong>Validation passed!</strong> All {importPreview.summary.validRows} rows are verified and ready to be imported into this draft roster.
                    </span>
                  </div>
                )}

                {/* Issues / Rows Table */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Spreadsheet Row Review</strong>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showErrorsOnly}
                      onChange={(e) => setShowErrorsOnly(e.target.checked)}
                    />
                    Show rows with issues only ({importPreview.rows.filter((r) => !r.valid || r.warnings.length > 0).length})
                  </label>
                </div>

                <div className="panel table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Row</th>
                        <th>Status</th>
                        <th>Passenger</th>
                        <th>Route / Stop</th>
                        <th>Validation Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.rows
                        .filter((r) => (!showErrorsOnly || !r.valid || r.warnings.length > 0))
                        .slice(0, 100)
                        .map((row) => (
                          <tr key={row.rowNumber} style={{ background: !row.valid ? 'var(--danger-bg)' : undefined }}>
                            <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>#{row.rowNumber}</td>
                            <td>
                              {row.valid ? (
                                <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 11 }}>✓ OK</span>
                              ) : (
                                <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 11 }}>✕ ERROR</span>
                              )}
                            </td>
                            <td>
                              <div className="cell-title">{row.normalized?.name || row.values?.name || '—'}</div>
                              <div className="cell-subtitle">
                                {row.normalized?.passengerType || row.values?.passengerType || '—'}
                                {row.normalized?.rollNo ? ` · Roll: ${row.normalized.rollNo}` : ''}
                                {row.normalized?.facultyId ? ` · ID: ${row.normalized.facultyId}` : ''}
                              </div>
                            </td>
                            <td>
                              <div className="cell-title">Route {row.normalized?.routeNo || row.values?.routeNo || '—'}</div>
                              <div className="cell-subtitle">{row.normalized?.boardingStop || row.values?.boardingStop || '—'}</div>
                            </td>
                            <td>
                              {row.errors.map((err, i) => (
                                <div key={i} style={{ color: 'var(--red)', fontSize: 11, fontWeight: 600 }}>
                                  • {err.message}
                                </div>
                              ))}
                              {row.warnings.map((warn, i) => (
                                <div key={i} style={{ color: 'var(--warning)', fontSize: 11 }}>
                                  • {warn.message}
                                </div>
                              ))}
                              {row.valid && row.warnings.length === 0 && (
                                <span style={{ color: 'var(--muted)', fontSize: 11 }}>Verified against route schedule</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setImportModalOpen(false)}
                disabled={importing}
              >
                Close
              </button>
              {importPreview && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={confirmImport}
                  disabled={importPreview.summary.invalidRows > 0 || importing}
                  title={importPreview.summary.invalidRows > 0 ? 'Resolve all errors before importing' : 'Confirm and add passengers to draft'}
                >
                  {importing ? 'Importing Passengers…' : `Confirm & Import ${importPreview.summary.validRows} Passengers`}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}