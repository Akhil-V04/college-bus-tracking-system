import { useCallback, useEffect, useState } from 'react';
import api from './api';

// A generic CRUD screen driven by a config object:
//   - title: header text
//   - base: backend path (e.g. "/routes/crud") — list + POST at base,
//     PUT/DELETE at base/:id
//   - columns: [{ key, label, render? }] for the table
//   - fields: form field descriptors for the add/edit modal:
//       { name, label, type, options?, placeholder? }
//       type: text | number | select | date | time | textarea
//   - listQuery: extra query params for the list call (unused by default)
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
  const [message, setMessage] = useState('');

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
    fields.forEach((f) => { initial[f.name] = f.type === 'number' ? '' : ''; });
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
        if (v === '' || v === null || v === undefined) return; // skip empty on update
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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <button
          onClick={openAdd}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add New
        </button>
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
      ) : rows.length === 0 ? (
        <div className="rounded bg-white py-10 text-center text-slate-400">
          {emptyLabel || 'No records yet'}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-500">
                  {columns.map((c) => (
                    <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        {c.render ? c.render(row) : row[c.key] ?? '—'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(row)} className="mr-2 text-blue-600 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(row)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded border px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded border px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="text-lg font-bold text-slate-800">
              {editing ? `Edit ${title.slice(0, -1)}` : `Add ${title.slice(0, -1)}`}
            </h2>
            {formError && (
              <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>
            )}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {fields.map((f) => (
                <div key={f.name}>
                  <label className="mb-1 block text-sm font-medium text-slate-600">{f.label}</label>
                  {f.type === 'select' ? (
                    <select
                      value={form[f.name] ?? ''}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [f.name]: f.keepString ? e.target.value : Number(e.target.value) }))
                      }
                      className="w-full rounded border border-slate-300 px-3 py-2"
                    >
                      <option value="">{f.placeholder || 'Select...'}</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      value={form[f.name] ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                      className="w-full rounded border border-slate-300 px-3 py-2"
                    />
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : f.type || 'text'}
                      value={form[f.name] ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      step={f.type === 'number' ? 'any' : undefined}
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded border border-slate-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}