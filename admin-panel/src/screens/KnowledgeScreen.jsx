import { useEffect, useState, useRef } from 'react';
import api, { errorMessage } from '../api';
import { LoadingState, Notice, PageHeader, EmptyState, Modal, Field } from '../components';

export default function KnowledgeScreen() {
  const [documents, setDocuments] = useState(null);
  const [message, setMessage] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', sourceType: 'POLICY', content: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDocs();
  }, []);

  function loadDocs() {
    api.get('/knowledge')
      .then((res) => setDocuments(res.data))
      .catch((err) => setMessage({ type: 'error', text: errorMessage(err) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.content) {
      setMessage({ type: 'error', text: 'Title and content are required.' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/knowledge', form);
      setMessage({ type: 'success', text: 'Document uploaded and indexed successfully.' });
      setShowAdd(false);
      setForm({ title: '', sourceType: 'POLICY', content: '' });
      loadDocs();
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'Failed to upload document.') });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(doc) {
    try {
      await api.patch(`/knowledge/${doc.id}`, { active: !doc.active });
      loadDocs();
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    }
  }

  async function deleteDoc(doc) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/knowledge/${doc.id}`);
      setMessage({ type: 'success', text: 'Document deleted.' });
      loadDocs();
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="RAG Transport Assistant"
        title="Knowledge Base"
        description="Manage college transport documents that the AI Transport Assistant uses to answer passenger questions."
        actions={<button className="button button-primary" onClick={() => setShowAdd(true)}>+ Add Document</button>}
      />
      <Notice message={message} onDismiss={() => setMessage(null)} />

      {!documents ? (
        <LoadingState label="Loading knowledge base..." />
      ) : documents.length === 0 ? (
        <EmptyState title="No documents uploaded" description="Upload transport policies, FAQs, and procedures so the assistant can answer passenger questions." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Chunks</th>
                <th>Active</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div className="cell-title">{doc.title}</div>
                    <div className="cell-subtitle">{(doc.content || '').slice(0, 80)}…</div>
                  </td>
                  <td><span className="cell-subtitle">{doc.sourceType}</span></td>
                  <td>{doc._count?.chunks ?? '—'}</td>
                  <td>
                    <button
                      type="button"
                      className={`button button-ghost ${doc.active ? '' : 'button-muted'}`}
                      onClick={() => toggleActive(doc)}
                    >
                      {doc.active ? '✓ Active' : '○ Inactive'}
                    </button>
                  </td>
                  <td><span className="cell-subtitle">{new Date(doc.createdAt).toLocaleDateString('en-IN')}</span></td>
                  <td>
                    <button type="button" className="button button-ghost" style={{ color: 'var(--danger, #ef4444)' }} onClick={() => deleteDoc(doc)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Knowledge Document" description="Paste transport policy, FAQ, or procedure text" onClose={() => setShowAdd(false)} wide>
          <form onSubmit={handleSubmit} style={{ padding: 20, display: 'grid', gap: 16 }}>
            <Field label="Document Title">
              <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Emergency Procedures" />
            </Field>
            <Field label="Source Type">
              <select value={form.sourceType} onChange={(e) => setForm((p) => ({ ...p, sourceType: e.target.value }))}>
                <option value="POLICY">Transport Policy</option>
                <option value="FAQ">FAQ</option>
                <option value="EMERGENCY">Emergency Procedure</option>
                <option value="TIMETABLE">Timetable / Schedule</option>
                <option value="GUIDELINES">Guidelines</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Document Content" hint="Paste the full text of the document here.">
              <textarea rows={12} value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} placeholder="Paste the full policy text here..." />
            </Field>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="button button-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Uploading & Indexing…' : 'Upload Document'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
