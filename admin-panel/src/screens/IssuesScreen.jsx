import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { LoadingState, Notice, PageHeader, StatusBadge, EmptyState, Modal, Field } from '../components';

export default function IssuesScreen() {
  const [issues, setIssues] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [reports, setReports] = useState([]);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    api.get('/issues')
      .then((res) => { if (active) setIssues(res.data); })
      .catch((err) => { if (active) setMessage({ type: 'error', text: errorMessage(err, 'Could not load issues.') }); });
    return () => { active = false; };
  }, []);

  async function openIssue(issue) {
    setSelectedIssue(issue);
    try {
      const res = await api.get(`/feedback?issueId=${issue.id}`);
      setReports(res.data?.items || res.data || []);
    } catch {
      setReports([]);
    }
  }

  async function updateStatus(issueId, status) {
    try {
      await api.patch(`/issues/${issueId}`, { status });
      setIssues((prev) => prev.map((i) => (i.id === issueId ? { ...i, status } : i)));
      if (selectedIssue?.id === issueId) setSelectedIssue((prev) => ({ ...prev, status }));
      setMessage({ type: 'success', text: `Issue status updated to ${status}` });
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'Status update failed.') });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="AI Issue Intelligence"
        title="Issue Clusters"
        description="Semantically grouped passenger reports. Multiple reports about the same problem are automatically clustered into a single issue."
      />
      <Notice message={message} onDismiss={() => setMessage(null)} />

      {!issues ? (
        <LoadingState label="Loading issues..." />
      ) : issues.length === 0 ? (
        <EmptyState title="No issues reported" description="Passenger issue reports will appear here once submitted." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Category</th>
                <th>Route</th>
                <th>Reports</th>
                <th>Status</th>
                <th>Latest</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id}>
                  <td>
                    <button type="button" className="text-button" onClick={() => openIssue(issue)}>
                      {issue.title}
                    </button>
                  </td>
                  <td><span className="cell-subtitle">{issue.category.replaceAll('_', ' ')}</span></td>
                  <td>{issue.routeService?.routeNo || '—'}</td>
                  <td><strong>{issue.reportCount}</strong></td>
                  <td><StatusBadge value={issue.status} /></td>
                  <td><span className="cell-subtitle">{new Date(issue.latestReportAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span></td>
                  <td>
                    <select
                      value={issue.status}
                      onChange={(e) => updateStatus(issue.id, e.target.value)}
                      className="inline-select"
                    >
                      <option value="NEW">NEW</option>
                      <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="DISMISSED">DISMISSED</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedIssue && (
        <Modal title={`Issue: ${selectedIssue.title}`} description={`${selectedIssue.reportCount} linked reports`} onClose={() => setSelectedIssue(null)} wide>
          <div className="modal-body" style={{ padding: 20 }}>
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              <div><strong>Category:</strong> {selectedIssue.category.replaceAll('_', ' ')}</div>
              <div><strong>Route:</strong> {selectedIssue.routeService?.routeNo || 'N/A'}</div>
              <div><strong>Status:</strong> <StatusBadge value={selectedIssue.status} /></div>
              <div><strong>First reported:</strong> {new Date(selectedIssue.firstReportAt).toLocaleString('en-IN')}</div>
              <div><strong>Latest report:</strong> {new Date(selectedIssue.latestReportAt).toLocaleString('en-IN')}</div>
            </div>

            <h3 style={{ marginBottom: 12 }}>Linked Reports</h3>
            {reports.length === 0 ? (
              <p className="cell-subtitle">No linked reports found.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {reports.map((report) => (
                  <div key={report.id} className="panel" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <StatusBadge value={report.status} />
                      <span className="cell-subtitle">{new Date(report.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    <p style={{ margin: 0 }}>{report.description}</p>
                    {report.additionalInfo && <p className="cell-subtitle" style={{ margin: '6px 0 0' }}>{report.additionalInfo}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
