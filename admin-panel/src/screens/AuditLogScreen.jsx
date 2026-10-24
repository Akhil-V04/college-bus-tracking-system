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

export default function AuditLogScreen() {
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
        eyebrow="Accountability"
        title="Administrator audit history"
        description="Review privacy-safe records of administrator changes. Credentials, phone numbers and passenger identifiers are deliberately excluded."
      />
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
  );
}
