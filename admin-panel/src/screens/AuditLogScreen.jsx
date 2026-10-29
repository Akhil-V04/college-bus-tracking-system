import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { EmptyState, LoadingState, Notice, PageHeader } from '../components';

const emptyFilters = { action: '', entityType: '', from: '', to: '' };

// Human-friendly headline generator for audit changes
function getAuditHeadline(entry) {
  const action = (entry.action || '').toUpperCase();
  const data = entry.afterSummary || entry.beforeSummary || {};
  const before = entry.beforeSummary || {};
  const after = entry.afterSummary || {};

  // Schedule Stops
  if (action === 'SCHEDULE_STOP_ADDED' || (entry.entityType === 'ScheduleStop' && action.includes('CREATE'))) {
    const time = data.scheduledTime ? `at ${data.scheduledTime}` : '';
    const seq = data.sequenceOrder !== undefined && data.sequenceOrder !== null ? `(Stop #${data.sequenceOrder})` : '';
    return `Added stop to schedule ${time} ${seq}`.trim();
  }
  if (action === 'SCHEDULE_STOP_DELETED' || (entry.entityType === 'ScheduleStop' && action.includes('DELETE'))) {
    return 'Removed stop from schedule';
  }
  if (action === 'SCHEDULE_STOP_UPDATED' || (entry.entityType === 'ScheduleStop' && action.includes('UPDATE'))) {
    if (before.scheduledTime && after.scheduledTime && before.scheduledTime !== after.scheduledTime) {
      return `Changed stop timing from ${before.scheduledTime} to ${after.scheduledTime}`;
    }
    return 'Updated stop schedule timings';
  }

  // Schedules
  if (action === 'SCHEDULE_CREATED' || (entry.entityType === 'ScheduleVersion' && action.includes('CREATE'))) {
    const name = data.name ? `"${data.name}"` : 'schedule';
    const dir = data.direction ? `(${data.direction.toLowerCase()} route)` : '';
    return `Created draft schedule ${name} ${dir}`.trim();
  }
  if (action === 'SCHEDULE_PUBLISHED') {
    const name = data.name ? `"${data.name}"` : 'schedule';
    return `Published schedule ${name} live to passengers`;
  }
  if (action === 'SCHEDULE_UPDATED') {
    const name = data.name ? `"${data.name}"` : 'schedule';
    return `Updated schedule timetable ${name}`.trim();
  }
  if (action === 'SCHEDULE_DELETED' || action === 'SCHEDULE_ARCHIVED') {
    const name = data.name ? `"${data.name}"` : 'schedule';
    return `Deleted schedule timetable ${name}`.trim();
  }
  if (action === 'ROUTE_GEOMETRY_REGENERATED_AFTER_STOP_EDIT') {
    return 'Auto-regenerated route path geometry after bus stop edit';
  }

  // Admin Sessions
  if (action === 'ADMIN_SESSION_CREATED') {
    if (data.expiresAt) {
      const exp = new Date(data.expiresAt);
      const timeStr = !isNaN(exp.getTime()) ? exp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
      return `Administrator signed in (Session valid until ${timeStr})`;
    }
    return 'Administrator signed in';
  }
  if (action === 'ADMIN_SESSION_LOGOUT') {
    return 'Administrator signed out';
  }
  if (action === 'ADMIN_SESSION_REVOKED') {
    return 'Administrator session expired or revoked';
  }
  if (action === 'ADMIN_SESSIONS_REVOKED') {
    const count = data.revokedSessions ? `(${data.revokedSessions} sessions)` : '';
    return `Revoked all active administrator sessions ${count}`.trim();
  }

  // Drivers
  if (action === 'DRIVER_CREATED') {
    const name = data.name ? `"${data.name}"` : 'driver';
    const code = data.driverCode ? `(Code: ${data.driverCode})` : '';
    return `Registered driver ${name} ${code}`.trim();
  }
  if (action === 'DRIVER_UPDATED') {
    const name = data.name ? `"${data.name}"` : 'driver';
    return `Updated driver ${name} record`.trim();
  }
  if (action === 'DRIVER_DEACTIVATED') {
    const name = data.name ? `"${data.name}"` : 'driver';
    return `Deactivated driver account ${name}`.trim();
  }
  if (action === 'DRIVER_DELETED') {
    const name = data.name ? `"${data.name}"` : 'driver';
    return `Deleted driver record ${name}`.trim();
  }

  // Routes
  if (action === 'ROUTE_CREATED' || action === 'ROUTE_SERVICE_CREATED') {
    const no = data.routeNo ? `Route ${data.routeNo}` : 'route';
    const name = data.name ? `— ${data.name}` : '';
    return `Created new ${no} ${name}`.trim();
  }
  if (action === 'ROUTE_UPDATED' || action === 'ROUTE_SERVICE_UPDATED') {
    const no = data.routeNo ? `Route ${data.routeNo}` : 'route';
    const name = data.name ? `— ${data.name}` : '';
    return `Updated details for ${no} ${name}`.trim();
  }
  if (action === 'ROUTE_DELETED' || action === 'ROUTE_SERVICE_DELETED') {
    const no = data.routeNo ? `Route ${data.routeNo}` : 'route';
    return `Deleted ${no}`.trim();
  }

  // Stops
  if (action === 'STOP_COORDINATES_UPDATED') {
    const name = data.name ? `"${data.name}"` : 'stop';
    return `Updated GPS coordinates for stop landmark ${name}`.trim();
  }
  if (action === 'STOP_UPDATED') {
    const name = data.name ? `"${data.name}"` : 'stop';
    return `Updated stop landmark details for ${name}`.trim();
  }

  // Rosters
  if (action === 'ROSTER_UPLOADED' || action === 'ROSTER_IMPORT' || action === 'ROSTER_CREATED') {
    const year = data.academicYear ? `for ${data.academicYear}` : '';
    return `Imported passenger roster spreadsheet ${year}`.trim();
  }
  if (action === 'ROSTER_PUBLISHED') {
    const year = data.academicYear ? `for ${data.academicYear}` : '';
    return `Published official passenger roster ${year}`.trim();
  }
  if (action === 'ROSTER_DELETED') {
    const year = data.academicYear ? `for ${data.academicYear}` : '';
    const name = data.name ? `"${data.name}"` : 'roster';
    return `Deleted passenger roster ${name} ${year}`.trim();
  }

  // Class Advisors
  if (action === 'CLASS_ADVISOR_CREATED') {
    const details = [data.year ? `Year ${data.year}` : '', data.department, data.section ? `Sec ${data.section}` : ''].filter(Boolean).join(' ');
    return `Assigned class advisor ${details ? `(${details})` : ''}`.trim();
  }

  // Event Overrides
  if (action.includes('OVERRIDE')) {
    const name = data.name ? `"${data.name}"` : 'event shift';
    return `Created temporary event schedule shift ${name}`.trim();
  }

  // Clean fallback headline
  const friendlyAction = action
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return `${friendlyAction} on ${formatEntityName(entry.entityType)}`;
}

// Converts property keys to friendly readable English titles
function formatAuditKey(key) {
  const custom = {
    stopId: 'Stop ID',
    scheduledTime: 'Scheduled Time',
    sequenceOrder: 'Sequence Order',
    scheduleVersionId: 'Schedule Version ID',
    routeServiceId: 'Route Service ID',
    routeNo: 'Route No',
    direction: 'Direction',
    version: 'Version',
    status: 'Status',
    expiresAt: 'Expires At',
    currentSession: 'Current Session',
    revokedSessions: 'Revoked Sessions',
    revoked: 'Revoked',
    academicYear: 'Academic Year',
    copiedPassengers: 'Copied Passengers',
    copiedFromRosterId: 'Copied From Roster',
    driverId: 'Driver ID',
    driverCode: 'Driver Code',
    licenseNo: 'License No',
    phone: 'Phone',
    name: 'Name',
    capacity: 'Capacity',
    areaCovered: 'Area Covered',
    sessionVersion: 'Session Version',
    assignedRouteId: 'Assigned Route ID',
    year: 'Academic Year',
    section: 'Section',
    department: 'Department',
    latitude: 'Latitude',
    longitude: 'Longitude',
    provider: 'Map Provider',
    fingerprint: 'Path Fingerprint',
    changedStopId: 'Changed Stop ID',
    regeneratedSchedules: 'Regenerated Timetables',
    changedFields: 'Changed Fields',
    isEndpoint: 'Endpoint Landmark',
  };
  if (custom[key]) return custom[key];
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Formats property values clearly without code quotes or unreadable strings
function formatAuditValue(key, val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';

  if (Array.isArray(val)) {
    if (val.length === 0) return 'None';
    return val.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  }

  if (typeof val === 'object') {
    return Object.entries(val)
      .map(([k, v]) => `${formatAuditKey(k)}: ${v}`)
      .join(', ');
  }

  // Format ISO timestamps into clean readable date + time
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
  }

  if (key === 'direction') {
    if (val === 'MORNING') return 'Morning (to college)';
    if (val === 'EVENING') return 'Evening (from college)';
  }
  if (key === 'version') return `v${val}`;
  if (key === 'capacity') return `${val} seats`;
  if (key === 'latitude' || key === 'longitude') {
    return typeof val === 'number' ? val.toFixed(5) : String(val);
  }

  return String(val);
}

// Extracts ALL properties completely from the change summary without omitting anything
function getAllSummaryItems(entry) {
  const before = entry.beforeSummary || null;
  const after = entry.afterSummary || null;
  const items = [];

  // When both before and after exist (e.g. record update), compare and display all fields
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    for (const key of allKeys) {
      if (key === 'changedFields') continue; // Highlight the actual changed values directly
      const valBefore = before[key];
      const valAfter = after[key];
      const label = formatAuditKey(key);

      if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
        items.push({
          key,
          label,
          isChanged: true,
          oldValue: formatAuditValue(key, valBefore),
          newValue: formatAuditValue(key, valAfter),
        });
      } else {
        items.push({
          key,
          label,
          isChanged: false,
          value: formatAuditValue(key, valAfter !== undefined ? valAfter : valBefore),
        });
      }
    }
    // Changed fields appear first
    return items.sort((a, b) => (b.isChanged ? 1 : 0) - (a.isChanged ? 1 : 0));
  }

  // When only afterSummary or beforeSummary exists, show every single field completely
  const source = after || before || {};
  if (typeof source === 'object') {
    for (const [key, val] of Object.entries(source)) {
      if (key === 'changedFields' && Array.isArray(val) && val.length === 0) continue;
      items.push({
        key,
        label: formatAuditKey(key),
        isChanged: false,
        value: formatAuditValue(key, val),
      });
    }
  }

  return items;
}

function formatEntityName(entityType) {
  if (!entityType) return '—';
  const map = {
    ScheduleStop: 'Schedule Stop',
    ScheduleVersion: 'Schedule Timetable',
    AdminSession: 'Admin Session',
    Driver: 'Driver Record',
    RouteService: 'Transport Route',
    TransportRoster: 'Passenger Roster',
    ClassAdvisor: 'Class Advisor',
    Stop: 'Bus Stop Landmark',
  };
  return map[entityType] || entityType.replace(/([A-Z])/g, ' $1').trim();
}

function formatEntityId(entityId) {
  if (!entityId) return '—';
  const str = String(entityId);
  if (str.length > 14) {
    return `#${str.slice(0, 8)}…`;
  }
  return `#${str}`;
}

function ActionBadge({ action }) {
  const act = String(action || '').toUpperCase();
  let bg = 'rgba(56, 189, 248, 0.12)';
  let color = '#38BDF8';
  let border = 'rgba(56, 189, 248, 0.3)';

  if (act.includes('DELETE') || act.includes('REVOKE') || act.includes('ARCHIVE') || act.includes('FAIL') || act.includes('DEACTIVATED')) {
    bg = 'rgba(244, 63, 94, 0.12)';
    color = '#F43F5E';
    border = 'rgba(244, 63, 94, 0.3)';
  } else if (act.includes('PUBLISH') || act.includes('ADD') || act.includes('CREATE') || act.includes('SUCCESS')) {
    bg = 'rgba(34, 197, 94, 0.12)';
    color = '#22C55E';
    border = 'rgba(34, 197, 94, 0.3)';
  } else if (act.includes('UPDATE') || act.includes('SHIFT') || act.includes('OVERRIDE') || act.includes('REGENERATED')) {
    bg = 'rgba(245, 158, 11, 0.12)';
    color = '#F59E0B';
    border = 'rgba(245, 158, 11, 0.3)';
  }

  const cleanLabel = act
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 7px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 750,
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        lineHeight: 1.35,
        textAlign: 'left',
      }}
    >
      {cleanLabel}
    </span>
  );
}

// Modal for deep inspection of an audit log entry
function AuditDetailModal({ entry, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!entry) return null;

  const summaryItems = getAllSummaryItems(entry);
  const headline = getAuditHeadline(entry);
  const jsonPayload = JSON.stringify(
    {
      id: entry.id,
      timestamp: entry.createdAt,
      admin: entry.adminIdentifier,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      beforeSummary: entry.beforeSummary,
      afterSummary: entry.afterSummary,
      correlationId: entry.correlationId,
      recordHash: entry.recordHash,
    },
    null,
    2
  );

  const copyJson = () => {
    navigator.clipboard.writeText(jsonPayload).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-card modal-wide"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 760, width: '95%' }}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <ActionBadge action={entry.action} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {new Date(entry.createdAt).toLocaleString('en-IN')}
              </span>
            </div>
            <h2>{headline}</h2>
            <p>
              Target: <strong>{formatEntityName(entry.entityType)}</strong> · ID: <code>{entry.entityId || 'None'}</code> · Administrator: <strong>{entry.adminIdentifier || 'admin'}</strong>
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Complete Summary Badges */}
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--navy)' }}>Complete Change Summary Data</h4>
            {summaryItems.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12 }}>No attribute values recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {summaryItems.map((item, idx) => (
                  <div
                    key={item.key || idx}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      fontSize: 12,
                      background: item.isChanged ? 'rgba(234, 88, 12, 0.12)' : 'var(--surface-hover)',
                      border: item.isChanged ? '1px solid rgba(234, 88, 12, 0.4)' : '1px solid var(--line)',
                      color: 'var(--ink)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ color: 'var(--muted)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' }}>
                      {item.label}
                    </span>
                    {item.isChanged ? (
                      <div>
                        <span style={{ textDecoration: 'line-through', opacity: 0.65, marginRight: 6 }}>
                          {item.oldValue}
                        </span>
                        <strong style={{ color: '#EA580C', fontWeight: 800 }}>&rarr; {item.newValue}</strong>
                      </div>
                    ) : (
                      <strong style={{ fontWeight: 750, color: 'var(--ink)' }}>{item.value}</strong>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cryptographic hash chain & correlation */}
          <div
            style={{
              padding: 10,
              background: 'var(--canvas)',
              borderRadius: 8,
              border: '1px solid var(--line)',
              fontSize: 11,
              display: 'grid',
              gap: 4,
            }}
          >
            <div>
              <span style={{ color: 'var(--muted)' }}>Audit Log Record ID:</span> <strong>#{entry.id}</strong>
            </div>
            {entry.correlationId && (
              <div>
                <span style={{ color: 'var(--muted)' }}>Request Correlation ID:</span> <code style={{ fontSize: 10.5 }}>{entry.correlationId}</code>
              </div>
            )}
            {entry.recordHash && (
              <div>
                <span style={{ color: 'var(--muted)' }}>Hash Chain Proof:</span> <code style={{ fontSize: 10, wordBreak: 'break-all' }}>{entry.recordHash}</code>
              </div>
            )}
          </div>

          {/* Formatted JSON payload view */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Full Audit Record (JSON)</span>
              <button
                className="button button-secondary"
                type="button"
                onClick={copyJson}
                style={{ padding: '3px 8px', fontSize: 11 }}
              >
                {copied ? '✓ Copied' : 'Copy JSON'}
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                maxHeight: 180,
                overflowY: 'auto',
                background: 'var(--canvas)',
                padding: 10,
                borderRadius: 8,
                border: '1px solid var(--line)',
                fontSize: 11,
                lineHeight: 1.45,
                color: 'var(--ink)',
                fontFamily: 'Consolas, Monaco, monospace',
              }}
            >
              {jsonPayload}
            </pre>
          </div>
        </div>

        <div className="modal-actions">
          <button className="button button-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function TripHistoryView() {
  const [tripsData, setTripsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routesList, setRoutesList] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDirection, setSelectedDirection] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [expandedTrips, setExpandedTrips] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(null);

  // Load routes for filter dropdown
  useEffect(() => {
    api.get('/route-services')
      .then((res) => {
        const list = res.data?.items || res.data || [];
        setRoutesList(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  // Fetch trip execution history
  const fetchTrips = (pageNum = 1) => {
    setLoading(true);
    const params = {
      page: pageNum,
      limit: 30,
    };
    if (selectedRoute !== 'ALL') params.routeNo = selectedRoute;
    if (selectedStatus !== 'ALL') params.status = selectedStatus;
    if (selectedDirection !== 'ALL') params.direction = selectedDirection;
    if (selectedDate) params.date = selectedDate;
    if (searchTerm.trim()) params.search = searchTerm.trim();

    api.get('/trips/history', { params })
      .then((res) => {
        setTripsData(res.data);
        setPage(pageNum);
      })
      .catch((err) => {
        setMessage({ type: 'error', text: errorMessage(err, 'Failed to load trip history.') });
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTrips(1);
  }, [selectedRoute, selectedStatus, selectedDirection, selectedDate]);

  const toggleExpand = (tripId) => {
    setExpandedTrips((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = {
        format: 'csv',
      };
      if (selectedRoute !== 'ALL') params.routeNo = selectedRoute;
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (selectedDirection !== 'ALL') params.direction = selectedDirection;
      if (selectedDate) params.date = selectedDate;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await api.get('/trips/history', {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `campus_bus_trip_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export trips to CSV: ' + errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const handleSetToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setSelectedDate(today);
  };

  const trips = tripsData?.trips || [];
  const total = tripsData?.total || 0;
  const runningCount = trips.filter((t) => t.status === 'RUNNING').length;
  const completedCount = trips.filter((t) => t.status === 'COMPLETED').length;

  return (
    <div>
      <Notice message={message} onDismiss={() => setMessage(null)} />

      {/* Top Action & Export Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--navy)' }}>Organized Trip Execution Log</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Real-time & historic log of when trips started, when the bus reached which stop, and arrival times.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => fetchTrips(page)}
            disabled={loading}
          >
            <span>🔄</span> Refresh
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={handleExportCsv}
            disabled={exporting || total === 0}
            style={{ backgroundColor: '#10B981', borderColor: '#059669' }}
          >
            <span>📥</span> {exporting ? 'Generating Excel...' : 'Export to Excel (CSV)'}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="panel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Trips Recorded</span>
          <strong style={{ fontSize: 22, color: 'var(--navy)' }}>{total}</strong>
        </div>
        <div className="panel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Completed Trips</span>
          <strong style={{ fontSize: 22, color: '#10B981' }}>{completedCount}</strong>
        </div>
        <div className="panel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Live Running Trips</span>
          <strong style={{ fontSize: 22, color: '#EA580C' }}>{runningCount}</strong>
        </div>
        <div className="panel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Available Routes</span>
          <strong style={{ fontSize: 22, color: 'var(--ink)' }}>{routesList.length}</strong>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="panel filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--ink)', minWidth: 150 }}>
          Route
          <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}>
            <option value="ALL">All Routes</option>
            {routesList.map((r) => (
              <option key={r.id || r.routeNo} value={r.routeNo}>
                Route {r.routeNo} - {r.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--ink)', minWidth: 130 }}>
          Status
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="RUNNING">Running Live</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--ink)', minWidth: 140 }}>
          Direction
          <select value={selectedDirection} onChange={(e) => setSelectedDirection(e.target.value)}>
            <option value="ALL">All Directions</option>
            <option value="TO_COLLEGE">Morning (To Campus)</option>
            <option value="FROM_COLLEGE">Evening (Return Drops)</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
          Date
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--canvas)', color: 'var(--ink)' }}
            />
            <button
              type="button"
              className="button button-ghost"
              onClick={handleSetToday}
              style={{ padding: '6px 10px', fontSize: 11 }}
            >
              Today
            </button>
            {selectedDate && (
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setSelectedDate('')}
                style={{ padding: '6px 10px', fontSize: 11 }}
              >
                Clear
              </button>
            )}
          </div>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--ink)', flex: '1 1 180px' }}>
          Search Driver or Route
          <input
            type="text"
            placeholder="Driver name, code, or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchTrips(1); }}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--canvas)', color: 'var(--ink)' }}
          />
        </label>

        <button
          type="button"
          className="button button-secondary"
          onClick={() => fetchTrips(1)}
          style={{ height: 38 }}
        >
          Apply Filters
        </button>
      </div>

      {/* Trips Execution Table / Cards */}
      {loading ? (
        <LoadingState label="Loading organized trip execution logs..." />
      ) : trips.length === 0 ? (
        <EmptyState
          title="No trips found"
          message="No bus trips match the selected filters. Change filters or run a trip from the driver app."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {trips.map((trip) => {
            const isExpanded = expandedTrips.has(trip.id);
            const isRunning = trip.status === 'RUNNING';
            const isCompleted = trip.status === 'COMPLETED';
            const isReturn = trip.direction === 'FROM_COLLEGE';

            return (
              <div
                key={trip.id}
                className="panel"
                style={{
                  padding: '16px 20px',
                  borderRadius: 14,
                  border: isRunning ? '2px solid #EA580C' : '1px solid var(--line)',
                  background: 'var(--surface)',
                  boxShadow: isRunning ? '0 4px 18px rgba(234, 88, 12, 0.12)' : 'none',
                }}
              >
                {/* Trip Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        fontWeight: 800,
                        fontSize: 13,
                        backgroundColor: 'rgba(234, 88, 12, 0.15)',
                        color: '#EA580C',
                        border: '1px solid rgba(234, 88, 12, 0.3)',
                      }}
                    >
                      Route {trip.routeNo}
                    </span>
                    <strong style={{ fontSize: 16, color: 'var(--navy)' }}>{trip.routeName}</strong>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: isReturn ? 'rgba(168, 85, 247, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                        color: isReturn ? '#A855F7' : '#3B82F6',
                        border: `1px solid ${isReturn ? 'rgba(168, 85, 247, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                      }}
                    >
                      {isReturn ? '🌆 Evening Return' : '🌅 Morning To Campus'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 800,
                        backgroundColor: isRunning ? 'rgba(234, 88, 12, 0.15)' : isCompleted ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: isRunning ? '#EA580C' : isCompleted ? '#10B981' : '#EF4444',
                        border: `1px solid ${isRunning ? '#EA580C' : isCompleted ? '#10B981' : '#EF4444'}`,
                      }}
                    >
                      {isRunning && <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EA580C', display: 'inline-block' }} />}
                      {trip.status}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Trip #{trip.id}</span>
                  </div>
                </div>

                {/* Trip Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, margin: '14px 0' }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Driver</span>
                    <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{trip.driverName}</strong>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Code: {trip.driverCode || '—'} {trip.driverPhone ? `• ${trip.driverPhone}` : ''}</div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Trip Date</span>
                    <strong style={{ fontSize: 13, color: 'var(--ink)' }}>
                      {trip.date ? new Date(trip.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Start Time</span>
                    <strong style={{ fontSize: 13, color: 'var(--ink)' }}>
                      {trip.startTime ? new Date(trip.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Not started'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>End Time</span>
                    <strong style={{ fontSize: 13, color: 'var(--ink)' }}>
                      {trip.endTime ? new Date(trip.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : isRunning ? '⚡ In Progress' : '—'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Duration</span>
                    <strong style={{ fontSize: 13, color: 'var(--ink)' }}>
                      {trip.durationMinutes != null ? `${Math.floor(trip.durationMinutes / 60)}h ${trip.durationMinutes % 60}m (${trip.durationMinutes} mins)` : '—'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Stops Progress</span>
                    <strong style={{ fontSize: 13, color: isCompleted ? '#10B981' : '#EA580C' }}>
                      {trip.reachedStopsCount} of {trip.totalStops} Reached
                    </strong>
                  </div>
                </div>

                {/* Timeline Accordion Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => toggleExpand(trip.id)}
                    style={{ fontSize: 12, fontWeight: 700, color: '#EA580C', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>{isExpanded ? '▲ Hide Stop Timeline' : '▼ View Reached Stops Timeline (' + (trip.timeline?.length || trip.totalStops) + ' stops)'}</span>
                  </button>

                  {trip.actualDelayMinutes != null && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: trip.actualDelayMinutes > 0 ? '#EF4444' : '#10B981' }}>
                      {trip.actualDelayMinutes > 0 ? `Late by +${trip.actualDelayMinutes}m` : `Arrived on time / early (${Math.abs(trip.actualDelayMinutes)}m)`}
                    </span>
                  )}
                </div>

                {/* Stop Timeline Details Table */}
                {isExpanded && (
                  <div style={{ marginTop: 14, background: 'var(--canvas)', borderRadius: 10, padding: 12, border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Sequential Stop Arrival Logs</strong>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Detailed timestamps captured via bus GPS geofence</span>
                    </div>

                    {trip.timeline?.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No intermediate stop data captured for this trip.</p>
                    ) : (
                      <div className="table-container" style={{ maxHeight: 320, overflowY: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                              <th style={{ padding: '6px 8px' }}>#</th>
                              <th style={{ padding: '6px 8px' }}>Stop Name</th>
                              <th style={{ padding: '6px 8px' }}>Scheduled Time</th>
                              <th style={{ padding: '6px 8px' }}>Actual Reached Timestamp</th>
                              <th style={{ padding: '6px 8px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trip.timeline.map((st, idx) => {
                              const isReached = st.status === 'REACHED' || Boolean(st.reachedAt);
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                                  <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--muted)' }}>{st.sequenceOrder}</td>
                                  <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--ink)' }}>{st.stopName}</td>
                                  <td style={{ padding: '6px 8px', color: 'var(--muted)', fontFamily: 'monospace' }}>{st.scheduledTime}</td>
                                  <td style={{ padding: '6px 8px', fontWeight: 600, color: st.reachedAt ? '#10B981' : 'var(--muted)', fontFamily: 'monospace' }}>
                                    {st.reachedAt ? new Date(st.reachedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (isCompleted ? 'Completed with trip' : 'Pending')}
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <span
                                      style={{
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 800,
                                        backgroundColor: isReached ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-hover)',
                                        color: isReached ? '#10B981' : 'var(--muted)',
                                      }}
                                    >
                                      {isReached ? '✓ REACHED' : 'PENDING'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AuditLogScreen() {
  const [activeTab, setActiveTab] = useState('trips');
  const [filters, setFilters] = useState(emptyFilters);
  const [query, setQuery] = useState({ ...emptyFilters, page: 1 });
  const [data, setData] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    const params = { page: query.page, limit: 50 };
    for (const key of ['action', 'entityType']) {
      if (query[key]) params[key] = query[key];
    }
    if (query.from) params.from = new Date(query.from + 'T00:00:00').toISOString();
    if (query.to) params.to = new Date(query.to + 'T23:59:59.999').toISOString();

    api
      .get('/admin-audit-logs', { params })
      .then(({ data: response }) => {
        if (active) setData(response);
      })
      .catch((error) => {
        if (active) setMessage({ type: 'error', text: errorMessage(error, 'Audit history could not be loaded.') });
      });

    return () => {
      active = false;
    };
  }, [query]);

  const submit = (event) => {
    event.preventDefault();
    setQuery({ ...filters, page: 1 });
  };

  return (
    <>
      <PageHeader
        eyebrow="Accountability & Logs"
        title="Trip Execution Logs & Audit Trail"
        description="Review organized bus trip timelines, stop arrival events, driver execution history, and administrative audit changes."
      />

      {/* Main Tab Switcher */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
        <button
          type="button"
          className={`button ${activeTab === 'trips' ? 'button-primary' : 'button-secondary'}`}
          onClick={() => setActiveTab('trips')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, padding: '10px 18px' }}
        >
          <span>🚌</span>
          <span>Trip History & Stop Timelines</span>
        </button>
        <button
          type="button"
          className={`button ${activeTab === 'admin' ? 'button-primary' : 'button-secondary'}`}
          onClick={() => setActiveTab('admin')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, padding: '10px 18px' }}
        >
          <span>⚙️</span>
          <span>System Security Audit</span>
        </button>
      </div>

      {activeTab === 'trips' ? (
        <TripHistoryView />
      ) : (
        <>
          <Notice message={message} onDismiss={() => setMessage(null)} />

          {/* Exact Original Filter View */}
      <form className="panel filter-bar" onSubmit={submit} aria-label="Audit log filters">
        <label>
          Action
          <input
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            placeholder="e.g. ROSTER_PUBLISHED"
          />
        </label>
        <label>
          Entity type
          <input
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            placeholder="e.g. TransportRoster"
          />
        </label>
        <label>
          From
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </label>
        <button className="button button-primary" type="submit">
          Apply filters
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => {
            setFilters(emptyFilters);
            setQuery({ ...emptyFilters, page: 1 });
          }}
        >
          Clear
        </button>
      </form>

      {/* Main Table */}
      {!data ? (
        <LoadingState label="Loading audit history…" />
      ) : data.items.length === 0 ? (
        <EmptyState title="No matching audit records" description="Change the filters or perform an administrator action." />
      ) : (
        <section className="panel" style={{ overflow: 'hidden' }}>
          <div className="table-wrap" style={{ width: '100%' }}>
            <table
              className="data-table"
              style={{
                width: '100%',
                tableLayout: 'fixed',
              }}
            >
              <colgroup>
                <col style={{ width: 110 }} />
                <col style={{ width: 135 }} />
                <col style={{ width: 125 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 'auto' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ padding: '11px 12px' }}>Time</th>
                  <th style={{ padding: '11px 12px' }}>Action</th>
                  <th style={{ padding: '11px 12px' }}>Entity</th>
                  <th style={{ padding: '11px 12px' }}>Admin</th>
                  <th style={{ padding: '11px 12px' }}>Change summary</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => {
                  const headline = getAuditHeadline(entry);
                  const summaryItems = getAllSummaryItems(entry);

                  return (
                    <tr
                      key={entry.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedEntry(entry)}
                      title="Click row to inspect full audit event record"
                    >
                      {/* Time */}
                      <td style={{ verticalAlign: 'top', padding: '11px 12px' }}>
                        <div className="cell-title" style={{ fontSize: 12, lineHeight: 1.3 }}>
                          {new Date(entry.createdAt).toLocaleDateString('en-IN')}
                        </div>
                        <div className="cell-subtitle" style={{ fontSize: 11, marginTop: 2 }}>
                          {new Date(entry.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ verticalAlign: 'top', padding: '11px 12px' }}>
                        <ActionBadge action={entry.action} />
                      </td>

                      {/* Entity */}
                      <td style={{ verticalAlign: 'top', padding: '11px 12px' }}>
                        <div className="cell-title" style={{ fontSize: 12.5, lineHeight: 1.3, wordBreak: 'break-word' }}>
                          {formatEntityName(entry.entityType)}
                        </div>
                        <div
                          className="cell-subtitle"
                          title={entry.entityId ? `ID: ${entry.entityId}` : ''}
                          style={{ fontFamily: 'monospace', fontSize: 11, marginTop: 2 }}
                        >
                          {formatEntityId(entry.entityId)}
                        </div>
                      </td>

                      {/* Administrator */}
                      <td style={{ verticalAlign: 'top', padding: '11px 12px' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 7px',
                            borderRadius: 6,
                            background: 'var(--surface-hover)',
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: 'var(--ink)',
                          }}
                        >
                          <span style={{ fontSize: 10.5, opacity: 0.8 }}>👤</span>
                          <span>{entry.adminIdentifier || 'admin'}</span>
                        </div>
                      </td>

                      {/* Change summary: Clean English headline & ALL complete data fields visible without clipping */}
                      <td style={{ verticalAlign: 'top', padding: '11px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 750,
                              fontSize: 13,
                              color: 'var(--navy)',
                              lineHeight: 1.4,
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                            }}
                          >
                            {headline}
                          </div>

                          {/* Complete Data Badges: Every single property completely shown, wrapping nicely */}
                          {summaryItems.length > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 6,
                                alignItems: 'center',
                                minWidth: 0,
                              }}
                            >
                              {summaryItems.map((item, idx) => (
                                <span
                                  key={item.key || idx}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'baseline',
                                    flexWrap: 'wrap',
                                    gap: 4,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    background: item.isChanged ? 'rgba(234, 88, 12, 0.12)' : 'var(--surface-hover)',
                                    border: item.isChanged ? '1px solid rgba(234, 88, 12, 0.4)' : '1px solid var(--line)',
                                    color: 'var(--ink)',
                                    lineHeight: 1.45,
                                    maxWidth: '100%',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{item.label}:</span>
                                  {item.isChanged ? (
                                    <span style={{ wordBreak: 'break-word' }}>
                                      <span style={{ textDecoration: 'line-through', opacity: 0.65, marginRight: 4 }}>
                                        {item.oldValue}
                                      </span>
                                      <span style={{ color: '#EA580C', fontWeight: 800 }}>&rarr; {item.newValue}</span>
                                    </span>
                                  ) : (
                                    <strong style={{ fontWeight: 750, color: 'var(--ink)', wordBreak: 'break-word' }}>
                                      {item.value}
                                    </strong>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination-bar">
            <span>
              Page {data.pagination.page} of {Math.max(1, data.pagination.totalPages)} · {data.pagination.total} records
            </span>
            <div>
              <button
                className="button button-secondary"
                disabled={query.page <= 1}
                onClick={() => setQuery({ ...query, page: query.page - 1 })}
              >
                Previous
              </button>
              <button
                className="button button-secondary"
                disabled={query.page >= data.pagination.totalPages}
                onClick={() => setQuery({ ...query, page: query.page + 1 })}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Inspect Detail Modal */}
      {selectedEntry && (
        <AuditDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
        </>
      )}
    </>
  );
}
