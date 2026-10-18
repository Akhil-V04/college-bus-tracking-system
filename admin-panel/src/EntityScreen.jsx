import { useCallback, useEffect, useState } from 'react';
import api from './api';
import { EmptyState, LoadingState, Notice, PageHeader, Modal, Field } from './components';

// A generic CRUD screen driven by a config object:
//   - title: header text
//   - base: backend path (e.g. "/drivers") — list + POST at base,
//     PUT/DELETE at base/:id
//   - columns: [{ key, label, render? }] for the table
//   - fields: form field descriptors for the add/edit modal:
//       { name, label, type, options?, placeholder? }
//       type: text | number | select | date | time | textarea
export default function EntityScreen({ config }) {
  const { title, base, columns, fields, emptyLabel } = config;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(base, { params: { page, limit: 25 } });
      setRows(data.items || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load: ' + (err.response?.data?.error || err.message) });
    } finally {
      setLoading(false);
    }
  }, [base, page]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    const initial = {};
    fields.forEach((f) => { initial[f.name] = ''; });
    setForm(initial);
    setEditing(null);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(row) {
    const copy = {};
    fields.forEach((f) => { copy[f.name] = row[f.name] ?? ''; });
    setForm(copy);
    setEditing(row);
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {};
      fields.forEach((f) => {
        if (f.name === 'passwordHash' || f.send === false) return;
        if (f.keepString) { payload[f.name] = form[f.name]; return; }
        let v = form[f.name];
        if (v === '' || v === null || v === undefined) return;
        payload[f.name] = f.type === 'number' ? Number(v) : v;
      });

      if (editing) {
        await api.put(`${base}/${editing.id}`, payload);
      } else {
        await api.post(base, payload);
      }
      setModalOpen(false);
      setMessage({ type: 'success', text: editing ? 'Updated successfully' : 'Added successfully' });
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!window.confirm('Delete this record?')) return;
    try {
      await api.delete(`${base}/${row.id}`);
      setMessage({ type: 'success', text: 'Deleted successfully' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: 'Delete failed: ' + (err.response?.data?.error || err.message) });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title={title}
        description={`Manage ${title.toLowerCase()} records, credentials and route assignments.`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {typeof config.headerActions === 'function' ? config.headerActions({ load, setMessage }) : config.headerActions}
            <button className="button button-primary" onClick={openAdd}>
              + Add New
            </button>
          </div>
        }
      />

      <Notice message={message} onDismiss={() => setMessage(null)} />

      {loading ? (
        <LoadingState label={`Loading ${title.toLowerCase()}…`} />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyLabel || 'No records yet'} description="Click '+ Add New' to create the first record." />
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {columns.map((c) => (
                      <td key={c.key}>
                        {c.render ? c.render(row) : (row[c.key] ?? '—')}
                      </td>
                    ))}
                    <td>
                      <div className="row-actions">
                        <button className="text-button" onClick={() => openEdit(row)}>
                          Edit
                        </button>
                        <button className="text-button text-button-danger" onClick={() => handleDelete(row)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="pagination-bar">
              <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} total</span>
              <div>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="button button-secondary"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="button button-secondary"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {modalOpen && (
        <Modal
          title={editing ? `Edit ${title.slice(0, -1)}` : `Add ${title.slice(0, -1)}`}
          description="Provide details and save changes."
          onClose={() => setModalOpen(false)}
        >
          {formError && (
            <div style={{ padding: '0 24px', marginTop: 16 }}>
              <Notice message={{ type: 'error', text: formError }} onDismiss={() => setFormError('')} />
            </div>
          )}
          <form onSubmit={handleSubmit} className="stack-form modal-body">
            {fields.map((f) => (
              <Field key={f.name} label={f.label} hint={f.placeholder}>
                {f.type === 'select' ? (
                  <select
                    value={form[f.name] ?? ''}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, [f.name]: f.keepString ? e.target.value : Number(e.target.value) }))
                    }
                  >
                    <option value="">{f.placeholder || 'Select…'}</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    value={form[f.name] ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                  />
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : f.type || 'text'}
                    value={form[f.name] ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                    placeholder={f.placeholder}
                    step={f.type === 'number' ? 'any' : undefined}
                  />
                )}
              </Field>
            ))}
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="button button-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="button button-primary"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {config.renderExtra?.({ load, setMessage })}
    </>
  );
}