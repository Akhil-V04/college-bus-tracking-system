import { useState } from 'react';
import EntityScreen from '../EntityScreen';
import api, { errorMessage } from '../api';
import { LoadingState, Modal } from '../components';

export default function DriversScreen() {
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [importing, setImporting] = useState(false);
  const [credentials, setCredentials] = useState(null);

  async function downloadTemplate() {
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
    } catch (error) {
      alert(errorMessage(error, 'Driver template could not be downloaded.'));
    }
  }

  async function handleFileSelect(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewLoading(true);
    setPreviewError('');
    setPreview(null);
    setCredentials(null);
    try {
      const formData = new FormData();
      formData.append('file', selected);
      const { data } = await api.post('/drivers/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data);
    } catch (error) {
      setPreviewError(errorMessage(error, 'Failed to inspect driver workbook.'));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmDriverImport(reloadTable, setScreenMessage) {
    if (!file || !preview) return;
    setImporting(true);
    setPreviewError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('confirmed', 'true');
      const { data } = await api.post('/drivers/import/confirm', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-preview-digest': preview.previewDigest,
          'x-driver-master-version': preview.masterVersion,
        },
      });
      if (data.credentials?.length) {
        setCredentials(data.credentials);
      } else {
        setImportOpen(false);
      }
      setScreenMessage?.({
        type: 'success',
        text: `Driver master updated successfully (${data.imported?.length || 0} drivers assigned).`,
      });
      reloadTable?.();
    } catch (error) {
      setPreviewError(errorMessage(error, 'Driver import failed. Another admin may have updated drivers.'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <EntityScreen
      config={{
        title: 'Drivers',
        base: '/drivers',
        emptyLabel: 'No drivers have been added yet.',
        headerActions: () => (
          <>
            <button
              type="button"
              className="button button-secondary"
              onClick={downloadTemplate}
              title="Download driver import template (.xlsx)"
            >
              📥 Driver Template (.xlsx)
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setPreviewError('');
                setCredentials(null);
                setImportOpen(true);
              }}
              title="Import driver assignments from Excel"
            >
              📤 Import Drivers (.xlsx)
            </button>
          </>
        ),
        renderExtra: ({ load: reloadTable, setMessage: setScreenMessage }) => importOpen && (
          <Modal
            wide
            title="Import Driver Master (.xlsx)"
            description="Bulk-update driver accounts, mobile numbers, licences, and route assignments."
            onClose={() => setImportOpen(false)}
          >
            <div className="modal-body">
              {credentials ? (
                <div>
                  <div className="notice notice-success">
                    <span>
                      ✓ <strong>Drivers imported successfully!</strong> New driver accounts were created with the initial temporary passwords below. Copy and store them securely before closing this window.
                    </span>
                  </div>
                  <div className="panel table-wrap" style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 18 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Driver Code</th>
                          <th>Temporary Password</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credentials.map((cred) => (
                          <tr key={cred.driverCode}>
                            <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{cred.driverCode}</td>
                            <td style={{ fontFamily: 'monospace', color: 'var(--teal)' }}>{cred.initialPassword}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => setImportOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ background: 'var(--canvas)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <span style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600 }}>
                        Required columns: Driver Code, Name, Phone, License Number, Route Number
                      </span>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={downloadTemplate}
                        style={{ fontSize: 12 }}
                      >
                        📥 Download Template (.xlsx)
                      </button>
                    </div>
                  </div>

                  <div style={{
                    border: '2px dashed var(--line)',
                    borderRadius: 14,
                    padding: 24,
                    textAlign: 'center',
                    background: 'var(--surface)',
                    marginBottom: 16,
                  }}>
                    <input
                      id="driver-file-input"
                      type="file"
                      accept=".xlsx"
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                    />
                    <label htmlFor="driver-file-input" style={{ cursor: 'pointer', display: 'inline-block' }}>
                      <div style={{ fontSize: 30, marginBottom: 6 }}>🗂️</div>
                      <strong style={{ display: 'block', color: 'var(--teal)', fontSize: 14, textDecoration: 'underline' }}>
                        {file ? file.name : 'Click to select driver Excel workbook (.xlsx)'}
                      </strong>
                      <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                        {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Spreadsheet with driver assignments'}
                      </span>
                    </label>
                  </div>

                  {previewError && (
                    <div className="notice notice-error" style={{ marginBottom: 14 }}>
                      <span>{previewError}</span>
                    </div>
                  )}

                  {previewLoading && (
                    <LoadingState label="Inspecting driver sheet and checking route numbers…" />
                  )}

                  {preview && !previewLoading && (
                    <div>
                      <div className="stats-grid" style={{ marginBottom: 16 }}>
                        <div className="panel stat-card">
                          <p className="stat-label">Total Rows</p>
                          <p className="stat-value">{preview.summary.totalRows}</p>
                          <p className="stat-note">in spreadsheet</p>
                        </div>
                        <div className="panel stat-card" style={{ borderLeft: '3px solid var(--green)' }}>
                          <p className="stat-label">Valid Drivers</p>
                          <p className="stat-value" style={{ color: 'var(--green)' }}>{preview.summary.validRows}</p>
                          <p className="stat-note">ready</p>
                        </div>
                        <div className="panel stat-card" style={{ borderLeft: preview.summary.invalidRows > 0 ? '3px solid var(--red)' : '3px solid var(--green)' }}>
                          <p className="stat-label">Errors</p>
                          <p className="stat-value" style={{ color: preview.summary.invalidRows > 0 ? 'var(--red)' : 'var(--green)' }}>
                            {preview.summary.invalidRows}
                          </p>
                          <p className="stat-note">{preview.summary.invalidRows > 0 ? 'block import' : 'clean'}</p>
                        </div>
                        <div className="panel stat-card">
                          <p className="stat-label">To Remove</p>
                          <p className="stat-value" style={{ color: preview.summary.blockedRemovals > 0 ? 'var(--red)' : 'var(--muted)' }}>
                            {preview.summary.removalsCount || 0}
                          </p>
                          <p className="stat-note">{preview.summary.blockedRemovals ? 'blocked by trip' : 'will be deactivated'}</p>
                        </div>
                      </div>

                      {preview.summary.invalidRows > 0 && (
                        <div className="notice notice-error" style={{ marginBottom: 14 }}>
                          <span>
                            ⚠️ Some driver rows contain errors (e.g. duplicate license, duplicate phone, or invalid route number). Correct the file before importing.
                          </span>
                        </div>
                      )}

                      <div className="panel table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Row</th>
                              <th>Driver</th>
                              <th>Phone & Licence</th>
                              <th>Assigned Route</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.rows.map((row) => (
                              <tr key={row.rowNumber} style={{ background: !row.valid ? 'var(--danger-bg)' : undefined }}>
                                <td style={{ fontWeight: 700 }}>#{row.rowNumber}</td>
                                <td>
                                  <div className="cell-title">{row.name}</div>
                                  <div className="cell-subtitle">{row.driverCode}</div>
                                </td>
                                <td>
                                  <div>{row.phone}</div>
                                  <div className="cell-subtitle">{row.licenseNo}</div>
                                </td>
                                <td>
                                  {row.routeNo ? `Route ${row.routeNo}` : <span style={{ color: 'var(--muted)' }}>Unassigned</span>}
                                </td>
                                <td>
                                  {row.valid ? (
                                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Valid</span>
                                  ) : (
                                    <div style={{ color: 'var(--red)', fontSize: 11 }}>
                                      {row.errors.map((e, idx) => <div key={idx}>• {e.message}</div>)}
                                    </div>
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
                      onClick={() => setImportOpen(false)}
                      disabled={importing}
                    >
                      Cancel
                    </button>
                    {preview && (
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => confirmDriverImport(reloadTable, setScreenMessage)}
                        disabled={preview.summary.invalidRows > 0 || preview.summary.blockedRemovals > 0 || importing}
                      >
                        {importing ? 'Importing Drivers…' : `Confirm & Import ${preview.summary.validRows} Drivers`}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </Modal>
        ),
        columns: [
          { key: 'driverCode', label: 'Driver code' },
          { key: 'name', label: 'Name' },
          { key: 'phone', label: 'Private phone' },
          { key: 'licenseNo', label: 'Licence number' },
          {
            key: 'assignedRoute',
            label: 'Assigned route',
            render: (driver) => driver.assignedRoute
              ? `Route ${driver.assignedRoute.routeNo} — ${driver.assignedRoute.name}`
              : 'Not assigned',
          },
        ],
        fields: [
          { name: 'driverCode', label: 'Driver login code', type: 'text' },
          { name: 'name', label: 'Driver name', type: 'text' },
          { name: 'phone', label: 'Phone (admin-only)', type: 'text' },
          { name: 'licenseNo', label: 'Licence number', type: 'text' },
          {
            name: 'password',
            label: 'Login password (required when creating; leave blank to keep it while editing)',
            type: 'password',
          },
        ],
      }}
    />
  );
}