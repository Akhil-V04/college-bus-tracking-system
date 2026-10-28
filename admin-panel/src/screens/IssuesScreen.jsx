import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { LoadingState, Notice, PageHeader, StatusBadge, EmptyState, Modal } from '../components';

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
      const res = await api.get(`/issues/${issue.id}/reports`);
      setReports(Array.isArray(res.data) ? res.data : (res.data?.items || []));
    } catch {
      try {
        const res = await api.get(`/feedback?issueId=${issue.id}`);
        setReports(res.data?.items || res.data || []);
      } catch {
        setReports([]);
      }
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

  // Count active urgent driver issues
  const urgentCount = issues ? issues.filter(i => i.priority === 'URGENT' && i.status !== 'RESOLVED' && i.status !== 'DISMISSED').length : 0;

  return (
    <>
      <PageHeader
        eyebrow="AI Issue Intelligence"
        title="Issue Clusters"
        description="Smart passenger feedback grouping. Multiple complaints regarding the same driver or route are automatically consolidated into top-priority issues to prevent feed flooding."
      />
      <Notice message={message} onDismiss={() => setMessage(null)} />

      {urgentCount > 0 && (
        <div style={{
          backgroundColor: 'rgba(220, 38, 38, 0.12)',
          border: '1px solid rgba(220, 38, 38, 0.4)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#FCA5A5'
        }}>
          <span style={{ fontSize: 20 }}>🚨</span>
          <div>
            <strong style={{ color: '#FFFFFF' }}>Action Required: {urgentCount} Critical Driver Alert{urgentCount > 1 ? 's' : ''}</strong>
            <div style={{ fontSize: 13, marginTop: 2, color: '#FECACA' }}>
              Multiple complaints have been received and merged for drivers on assigned routes. These issues are pinned to the top of the queue for immediate review.
            </div>
          </div>
        </div>
      )}

      {!issues ? (
        <LoadingState label="Loading issues..." />
      ) : issues.length === 0 ? (
        <EmptyState title="No issues reported" description="Passenger issue reports will appear here once submitted." />
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Issue Title</th>
                  <th>Category</th>
                  <th>Route</th>
                  <th>Assigned Driver</th>
                  <th>Complaints</th>
                  <th>Status</th>
                  <th>Latest</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id} style={issue.priority === 'URGENT' ? { backgroundColor: 'rgba(220, 38, 38, 0.05)' } : {}}>
                    {/* Priority Badge */}
                    <td>
                      {issue.priority === 'URGENT' ? (
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          backgroundColor: '#DC2626',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: 11,
                          letterSpacing: 0.5,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          🚨 URGENT
                        </span>
                      ) : issue.priority === 'HIGH' ? (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          backgroundColor: '#EA580C',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: 11,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          ⚠️ HIGH
                        </span>
                      ) : issue.priority === 'ELEVATED' ? (
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          backgroundColor: 'rgba(234, 88, 12, 0.15)',
                          color: '#F97316',
                          fontWeight: 700,
                          fontSize: 11
                        }}>
                          ELEVATED
                        </span>
                      ) : (
                        <span style={{ color: '#64748B', fontSize: 11, fontWeight: 600 }}>NORMAL</span>
                      )}
                    </td>

                    {/* Issue Title */}
                    <td>
                      <button type="button" className="text-button" onClick={() => openIssue(issue)} style={{ textAlign: 'left', fontWeight: issue.reportCount > 1 ? 700 : 500 }}>
                        {issue.title}
                      </button>
                    </td>

                    {/* Category */}
                    <td>
                      <span className="cell-subtitle" style={{ fontWeight: 600 }}>
                        {issue.category.replaceAll('_', ' ')}
                      </span>
                    </td>

                    {/* Route */}
                    <td>
                      {issue.routeService?.routeNo ? (
                        <div>
                          <strong style={{ color: '#F97316' }}>Route {issue.routeService.routeNo}</strong>
                          {issue.routeService.name && (
                            <div className="cell-subtitle" style={{ fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {issue.routeService.name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="cell-subtitle">—</span>
                      )}
                    </td>

                    {/* Assigned Driver */}
                    <td>
                      {issue.driverName || issue.routeService?.driver?.name ? (
                        <div>
                          <strong>{issue.driverName || issue.routeService?.driver?.name}</strong>
                          {(issue.driverPhone || issue.routeService?.driver?.phone) && (
                            <div className="cell-subtitle" style={{ fontSize: 11 }}>
                              📞 {issue.driverPhone || issue.routeService?.driver?.phone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="cell-subtitle">—</span>
                      )}
                    </td>

                    {/* Reports Count */}
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: 14, color: issue.reportCount > 1 ? '#F97316' : 'inherit' }}>
                          {issue.reportCount}
                        </strong>
                        {issue.reportCount > 1 && (
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, backgroundColor: 'rgba(234, 88, 12, 0.2)', color: '#F97316', fontWeight: 700 }}>
                            MERGED
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td><StatusBadge value={issue.status} /></td>

                    {/* Latest */}
                    <td>
                      <span className="cell-subtitle">
                        {new Date(issue.latestReportAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </td>

                    {/* Actions */}
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
        </section>
      )}

      {/* Issue Modal Details */}
      {selectedIssue && (
        <Modal title={`Issue: ${selectedIssue.title}`} description={`${selectedIssue.reportCount} linked passenger complaint${selectedIssue.reportCount > 1 ? 's' : ''}`} onClose={() => setSelectedIssue(null)} wide>
          <div className="modal-body" style={{ padding: 20 }}>
            {selectedIssue.priority === 'URGENT' && (
              <div style={{
                backgroundColor: 'rgba(220, 38, 38, 0.15)',
                border: '1px solid #DC2626',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                color: '#FECACA',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span>🚨</span>
                <span>URGENT DRIVER ALERT: Multiple passengers have reported issues regarding this driver on Route {selectedIssue.routeService?.routeNo || '—'}. Immediate supervisor review advised.</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20, backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: 16, borderRadius: 8 }}>
              <div>
                <span className="cell-subtitle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>Category</span>
                <strong>{selectedIssue.category.replaceAll('_', ' ')}</strong>
              </div>

              <div>
                <span className="cell-subtitle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>Route</span>
                <strong style={{ color: '#F97316' }}>
                  {selectedIssue.routeService?.routeNo ? `Route ${selectedIssue.routeService.routeNo}` : '—'}
                </strong>
                {selectedIssue.routeService?.name && (
                  <div className="cell-subtitle" style={{ fontSize: 11 }}>{selectedIssue.routeService.name}</div>
                )}
              </div>

              <div>
                <span className="cell-subtitle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>Assigned Driver</span>
                <strong>{selectedIssue.driverName || selectedIssue.routeService?.driver?.name || 'Assigned'}</strong>
                {(selectedIssue.driverPhone || selectedIssue.routeService?.driver?.phone) && (
                  <div className="cell-subtitle" style={{ fontSize: 11 }}>📞 {selectedIssue.driverPhone || selectedIssue.routeService?.driver?.phone}</div>
                )}
              </div>

              <div>
                <span className="cell-subtitle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>Complaints Merged</span>
                <strong style={{ color: selectedIssue.reportCount > 1 ? '#F97316' : 'inherit' }}>
                  {selectedIssue.reportCount} complaint{selectedIssue.reportCount > 1 ? 's' : ''}
                </strong>
              </div>

              <div>
                <span className="cell-subtitle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>Status</span>
                <StatusBadge value={selectedIssue.status} />
              </div>

              <div>
                <span className="cell-subtitle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>First Reported</span>
                <span style={{ fontSize: 13 }}>{new Date(selectedIssue.firstReportAt).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {selectedIssue.representativeText && (
              <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.02)', borderLeft: '3px solid #EA580C' }}>
                <span className="cell-subtitle" style={{ fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Primary Complaint Summary</span>
                <i style={{ color: '#E2E8F0' }}>"{selectedIssue.representativeText}"</i>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <button className="button button-secondary" onClick={async () => {
                const targetId = prompt('Enter the ID of the issue you want to merge this into:');
                if (targetId) {
                  try {
                    await api.post(`/issues/${selectedIssue.id}/merge`, { targetIssueId: targetId });
                    setIssues(prev => prev.filter(i => i.id !== selectedIssue.id));
                    setSelectedIssue(null);
                    setMessage({ type: 'success', text: 'Issue merged successfully.' });
                  } catch(err) {
                    setMessage({ type: 'error', text: errorMessage(err, 'Merge failed.') });
                  }
                }
              }}>Merge into another issue manually</button>
            </div>

            <h3 style={{ marginBottom: 12, fontSize: 16 }}>All Linked Passenger Complaints ({reports.length})</h3>
            {reports.length === 0 ? (
              <p className="cell-subtitle">No linked reports found.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {reports.map((report, idx) => (
                  <div key={report.id} className="panel" style={{ padding: 14, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
                          #{idx + 1}
                        </span>
                        <StatusBadge value={report.status} />
                      </div>
                      <span className="cell-subtitle">{new Date(report.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{report.description}</p>
                    {report.additionalInfo && (
                      <p className="cell-subtitle" style={{ margin: '8px 0 0', color: '#94A3B8', fontSize: 12 }}>
                        📍 {report.additionalInfo}
                      </p>
                    )}
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
