import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { EmptyState, LoadingState, Notice, PageHeader, StatusBadge } from '../components';

const emptyFilters = { action: '', entityType: '', from: '', to: '' };

export default function AuditLogScreen() {
  const [filters, setFilters] = useState(emptyFilters);
  const [query, setQuery] = useState({ ...emptyFilters, page: 1 });
  const [data, setData] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    const params = { page: query.page, limit: 50 };
    for (const key of ['action', 'entityType']) if (query[key]) params[key] = query[key];
    if (query.from) params.from = new Date(query.from + 'T00:00:00').toISOString();
    if (query.to) params.to = new Date(query.to + 'T23:59:59.999').toISOString();
    api.get('/admin-audit-logs', { params })
      .then(({ data: response }) => { if (active) setData(response); })
      .catch((error) => { if (active) setMessage({ type: 'error', text: errorMessage(error, 'Audit history could not be loaded.') }); });
    return () => { active = false; };
  }, [query]);

  const submit = (event) => {
    event.preventDefault();
    setQuery({ ...filters, page: 1 });
  };

  return <>
    <PageHeader eyebrow="Accountability" title="Administrator audit history"
      description="Review privacy-safe records of administrator changes. Credentials, phone numbers and passenger identifiers are deliberately excluded." />
    <Notice message={message} onDismiss={() => setMessage(null)} />

    <form className="panel filter-bar" onSubmit={submit} aria-label="Audit log filters">
      <label>Action<input value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} placeholder="e.g. ROSTER_PUBLISHED" /></label>
      <label>Entity type<input value={filters.entityType} onChange={(e) => setFilters({ ...filters, entityType: e.target.value })} placeholder="e.g. TransportRoster" /></label>
      <label>From<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
      <label>To<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
      <button className="button button-primary" type="submit">Apply filters</button>
      <button className="button button-secondary" type="button" onClick={() => { setFilters(emptyFilters); setQuery({ ...emptyFilters, page: 1 }); }}>Clear</button>
    </form>

    {!data ? <LoadingState label="Loading audit history…" /> : data.items.length === 0 ?
      <EmptyState title="No matching audit records" description="Change the filters or perform an administrator action." /> :
      <section className="panel">
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Administrator</th><th>Change summary</th></tr></thead>
          <tbody>{data.items.map((entry) => <tr key={entry.id}>
            <td><div className="cell-title">{new Date(entry.createdAt).toLocaleDateString('en-IN')}</div><div className="cell-subtitle">{new Date(entry.createdAt).toLocaleTimeString('en-IN')}</div></td>
            <td><StatusBadge value={entry.action} /></td>
            <td><div className="cell-title">{entry.entityType}</div><div className="cell-subtitle">{entry.entityId || '—'}</div></td>
            <td>{entry.adminIdentifier}</td>
            <td><code className="summary-code">{JSON.stringify(entry.afterSummary || entry.beforeSummary || {})}</code></td>
          </tr>)}</tbody>
        </table></div>
        <div className="pagination-bar">
          <span>Page {data.pagination.page} of {Math.max(1, data.pagination.totalPages)} · {data.pagination.total} records</span>
          <div><button className="button button-secondary" disabled={query.page <= 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}>Previous</button>
          <button className="button button-secondary" disabled={query.page >= data.pagination.totalPages} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Next</button></div>
        </div>
      </section>}
  </>;
}
