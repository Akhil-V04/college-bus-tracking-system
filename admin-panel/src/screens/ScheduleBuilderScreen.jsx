import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import api, { errorMessage } from '../api';
import { LoadingState, Notice } from '../components';

// Fix leaflet default icon
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ iconUrl, shadowUrl: iconShadow, iconAnchor: [12, 41], popupAnchor: [1, -34] });
L.Marker.prototype.options.icon = DefaultIcon;

const MAP_LAYERS = {
  roadmap: {
    name: 'Google Maps',
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
  satellite: {
    name: 'Google Satellite',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps Satellite',
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  },
};

function googleNumberedPin(n, color = '#EA580C', isEnd = false) {
  const text = isEnd ? '★' : String(n);
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:46px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));cursor:pointer;">
        <svg viewBox="0 0 384 512" width="34" height="46" fill="${color}">
          <path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
        </svg>
        <div style="position:absolute;top:9px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;background:#ffffff;display:flex;align-items:center;justify-content:center;color:${color};font-weight:800;font-size:${isEnd ? '11px' : '10px'};box-shadow:inset 0 1px 2px rgba(0,0,0,0.3);">
          ${text}
        </div>
      </div>
    `,
    iconSize: [34, 46],
    iconAnchor: [17, 46],
    popupAnchor: [0, -46],
  });
}

function decodePolyline(str, precision = 5) {
  if (!str) return [];
  let index = 0, lat = 0, lng = 0, coordinates = [], factor = Math.pow(10, precision);
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = 0; result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(mins) {
  const normalized = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatMinutesDifference(diffMinutes) {
  const sign = diffMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(diffMinutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours > 0 && mins > 0) return `${sign}${hours}h ${mins}m`;
  if (hours > 0) return `${sign}${hours}h`;
  return `${sign}${mins}m`;
}

export default function ScheduleBuilderScreen() {
  const [routes, setRoutes] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [baseSchedule, setBaseSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeLayer, setActiveLayer] = useState('roadmap');

  // Override Form state
  const [isCreatingOverride, setIsCreatingOverride] = useState(false);
  const [overrideName, setOverrideName] = useState('');
  const [durationOption, setDurationOption] = useState('1'); // '1' | '2' | '3' | '7' | 'custom'
  const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customEndDate, setCustomEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [newFirstStopTime, setNewFirstStopTime] = useState('15:00'); // default to 3:00 PM for events
  const [shiftedStops, setShiftedStops] = useState([]);
  const [roadPolyline, setRoadPolyline] = useState([]);

  // Load all routes & active overrides
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [routeRes, overrideRes] = await Promise.all([
        api.get('/route-services/admin', { params: { limit: 200 } }),
        api.get('/schedules/overrides'),
      ]);
      const fetchedRoutes = routeRes.data.items || [];
      setRoutes(fetchedRoutes);
      setOverrides(overrideRes.data || []);

      if (fetchedRoutes.length > 0 && !selectedRouteId) {
        setSelectedRouteId(String(fetchedRoutes[0].id));
      }
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'Could not load data') });
    } finally {
      setLoading(false);
    }
  }, [selectedRouteId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load selected route's base published schedule
  const loadBaseRouteSchedule = useCallback(async (routeId) => {
    if (!routeId) return;
    try {
      const { data } = await api.get(`/schedules/route/${routeId}/detail`);
      setBaseSchedule(data);

      if (data?.geometryPolyline) {
        setRoadPolyline(decodePolyline(data.geometryPolyline));
      } else {
        setRoadPolyline([]);
      }
    } catch (err) {
      setBaseSchedule(null);
      setRoadPolyline([]);
    }
  }, []);

  useEffect(() => {
    if (selectedRouteId) {
      loadBaseRouteSchedule(selectedRouteId);
    }
  }, [selectedRouteId, loadBaseRouteSchedule]);

  // Selected route object
  const selectedRoute = useMemo(() => {
    return routes.find((r) => String(r.id) === String(selectedRouteId)) || null;
  }, [routes, selectedRouteId]);

  // Active overrides specifically for the selected route
  const selectedRouteOverrides = useMemo(() => {
    return overrides.filter((ov) => String(ov.routeServiceId) === String(selectedRouteId));
  }, [overrides, selectedRouteId]);

  // Baseline start time from original schedule
  const baseFirstStopTime = useMemo(() => {
    if (!baseSchedule?.stops || baseSchedule.stops.length === 0) return '07:55';
    return baseSchedule.stops[0].scheduledTime || '07:55';
  }, [baseSchedule]);

  // Calculate dynamic delta offset between base first stop and new first stop
  const deltaMinutes = useMemo(() => {
    const baseMins = timeToMinutes(baseFirstStopTime);
    const newMins = timeToMinutes(newFirstStopTime);
    return newMins - baseMins;
  }, [baseFirstStopTime, newFirstStopTime]);

  // When opening creator, populate shiftedStops dynamically
  function handleStartCreateOverride() {
    if (!baseSchedule || !baseSchedule.stops || baseSchedule.stops.length < 2) {
      setMessage({
        type: 'warning',
        text: 'This route does not have a published schedule yet. Please save & publish stops in "Stops & Map" first.',
      });
      return;
    }

    setOverrideName(`Route ${selectedRoute.routeNo} Event Schedule`);
    setNewFirstStopTime('15:00'); // 3:00 PM event start
    setDurationOption('1'); // today only

    // Compute shifted timings for every stop based on exact time delta
    const baseMins = timeToMinutes(baseSchedule.stops[0]?.scheduledTime || '07:55');
    const newMins = timeToMinutes('15:00');
    const delta = newMins - baseMins;

    const initialShifted = baseSchedule.stops.map((entry, idx) => {
      const origMins = timeToMinutes(entry.scheduledTime);
      const computedMins = origMins + delta;
      return {
        stopId: entry.stopId || entry.stop.id,
        name: entry.stop.name,
        latitude: entry.stop.latitude,
        longitude: entry.stop.longitude,
        originalTime: entry.scheduledTime,
        scheduledTime: minutesToTime(computedMins),
        offsetMinutes: origMins - baseMins,
        isEndpoint: idx === baseSchedule.stops.length - 1,
      };
    });

    setShiftedStops(initialShifted);
    setIsCreatingOverride(true);
  }

  // Handle first stop time change: dynamically recompute all subsequent stop times
  function handleFirstStopTimeChange(newTime) {
    setNewFirstStopTime(newTime);
    const newStartMins = timeToMinutes(newTime);

    setShiftedStops((prev) =>
      prev.map((stop, idx) => {
        if (idx === 0) {
          return { ...stop, scheduledTime: newTime };
        }
        // Use relative offset from first stop to preserve exact road travel time difference
        const computedMins = newStartMins + (stop.offsetMinutes || 0);
        return {
          ...stop,
          scheduledTime: minutesToTime(computedMins),
        };
      })
    );
  }

  // Allow manual fine-tuning of any specific stop arrival time
  function handleIndividualStopTimeChange(index, value) {
    setShiftedStops((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], scheduledTime: value };
      return copy;
    });
  }

  // Publish event override schedule
  async function handlePublishOverride() {
    if (!selectedRouteId) return;
    setSaving(true);
    setMessage(null);

    let effectiveFromDate = new Date();
    let effectiveToDate = new Date();

    if (durationOption === 'custom') {
      effectiveFromDate = new Date(customStartDate + 'T00:00:00');
      effectiveToDate = new Date(customEndDate + 'T23:59:59');
    } else {
      const days = Number(durationOption);
      effectiveFromDate = new Date();
      effectiveToDate = new Date();
      effectiveToDate.setDate(effectiveToDate.getDate() + days - 1);
      effectiveToDate.setHours(23, 59, 59, 999);
    }

    try {
      await api.post(`/schedules/route/${selectedRouteId}/create-override`, {
        name: overrideName.trim() || `Route ${selectedRoute.routeNo} Event Schedule`,
        durationDays: Number(durationOption) || 1,
        effectiveFrom: effectiveFromDate.toISOString(),
        effectiveTo: effectiveToDate.toISOString(),
        firstStopTime: newFirstStopTime,
        stops: shiftedStops.map((s, idx) => ({
          stopId: s.stopId,
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          scheduledTime: s.scheduledTime,
          sequenceOrder: idx + 1,
        })),
      });

      setMessage({
        type: 'success',
        text: `🚀 Event Schedule Published! Regular schedule for Route ${selectedRoute.routeNo} is now overridden and will automatically restore when the period ends.`,
      });
      setIsCreatingOverride(false);
      await loadInitialData();
      await loadBaseRouteSchedule(selectedRouteId);
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'Failed to publish event schedule override') });
    } finally {
      setSaving(false);
    }
  }

  // Deactivate an active override early
  async function handleDeactivateOverride(overrideId) {
    if (!window.confirm('Revert back to standard regular schedule immediately?')) return;
    try {
      await api.post(`/schedules/override/${overrideId}/deactivate`);
      setMessage({
        type: 'info',
        text: 'Event schedule deactivated. Route is now following its regular published timetable.',
      });
      await loadInitialData();
      await loadBaseRouteSchedule(selectedRouteId);
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'Could not deactivate override') });
    }
  }

  const mapCenter = useMemo(() => {
    if (shiftedStops.length > 0) return [shiftedStops[0].latitude, shiftedStops[0].longitude];
    if (baseSchedule?.stops && baseSchedule.stops.length > 0) {
      return [baseSchedule.stops[0].stop.latitude, baseSchedule.stops[0].stop.longitude];
    }
    return [17.4474, 78.3762];
  }, [shiftedStops, baseSchedule]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>⚡</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
              Event & Custom Schedule Overrides
            </h1>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted, #94a3b8)', maxWidth: 800, lineHeight: 1.5 }}>
            Create temporary schedule shifts for college fests, evening sessions, symposiums, or exam days.
            Enter only the new first stop arrival time — subsequent stops automatically shift by their exact time delta without hardcoding!
          </p>
        </div>

        {/* Route Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)' }}>Select Route:</label>
          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              background: 'var(--card-bg, #1e293b)',
              color: 'var(--text-primary, #ffffff)',
              border: '1px solid var(--border-color, #334155)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              minWidth: 220,
            }}
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                Route {r.routeNo} — {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Notice message={message} onDismiss={() => setMessage(null)} />

      {loading ? (
        <LoadingState label="Loading routes and schedule overrides…" />
      ) : (
        <>
          {/* Active Overrides Status Banner */}
          {selectedRouteOverrides.length > 0 && (
            <div
              style={{
                background: 'rgba(234, 88, 12, 0.1)',
                border: '1px solid rgba(234, 88, 12, 0.4)',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🚨</span>
                  <div>
                    <div style={{ fontWeight: 800, color: '#EA580C', fontSize: 14 }}>
                      Active Event Override in Effect for Route {selectedRoute?.routeNo}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                      The standard regular schedule is currently hidden. Passenger apps and drivers are automatically using the event timetable.
                    </div>
                  </div>
                </div>
              </div>

              {/* Overrides Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedRouteOverrides.map((ov) => (
                  <div
                    key={ov.id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, color: '#ffffff', fontSize: 13 }}>{ov.name}</span>
                      <span style={{ marginLeft: 10, fontSize: 12, color: '#38BDF8', fontWeight: 600 }}>
                        {ov.firstStopName} ({ov.firstStopTime}) &rarr; {ov.lastStopName} ({ov.lastStopTime})
                      </span>
                      <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                        Valid: {new Date(ov.effectiveFrom).toLocaleDateString()} to {new Date(ov.effectiveTo).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeactivateOverride(ov.id)}
                      className="button"
                      style={{
                        padding: '6px 12px',
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        cursor: 'pointer',
                        borderRadius: 6,
                      }}
                    >
                      ✕ End Override & Revert to Regular
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Route Overview & Trigger Override Card */}
          <div
            style={{
              background: 'var(--card-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
                  Route {selectedRoute?.routeNo} &mdash; {selectedRoute?.name}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)', marginTop: 4 }}>
                  Base Regular Timetable: Starts at <strong>{baseFirstStopTime} AM</strong> &bull; Total Stops:{' '}
                  <strong>{baseSchedule?.stops?.length || 0} stops</strong> ending at <strong>VBIT College</strong>
                </div>
              </div>

              {!isCreatingOverride && (
                <button
                  type="button"
                  onClick={handleStartCreateOverride}
                  className="button button-primary"
                  style={{
                    padding: '9px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>⚡ Create Event / Custom Timing Override</span>
                </button>
              )}
            </div>

            {/* Event Schedule Override Builder Form */}
            {isCreatingOverride && (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(234, 88, 12, 0.4)',
                  borderRadius: 10,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  marginTop: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#EA580C' }}>
                    Configure Event Timing & Override Window
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsCreatingOverride(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--muted, #94a3b8)', cursor: 'pointer', fontSize: 13 }}
                  >
                    ✕ Cancel
                  </button>
                </div>

                {/* Form Controls */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                  {/* Event Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: 6 }}>
                      Event / Occasion Name:
                    </label>
                    <input
                      type="text"
                      value={overrideName}
                      onChange={(e) => setOverrideName(e.target.value)}
                      placeholder="e.g. Annual Fest Evening Session"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color, #334155)',
                        background: 'var(--bg-dark, #0f172a)',
                        color: '#ffffff',
                        fontSize: 13,
                      }}
                    />
                  </div>

                  {/* New First Stop Start Time */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#EA580C', marginBottom: 6 }}>
                      First Stop Departure Time ({shiftedStops[0]?.name || 'Stop 1'}):
                    </label>
                    <input
                      type="time"
                      value={newFirstStopTime}
                      onChange={(e) => handleFirstStopTimeChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '2px solid #EA580C',
                        background: 'var(--bg-dark, #0f172a)',
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    />
                    <div style={{ fontSize: 11, color: '#FDBA74', marginTop: 4, fontWeight: 600 }}>
                      ⚡ Shift offset: {formatMinutesDifference(deltaMinutes)} from regular start ({baseFirstStopTime} AM).
                      All other stops automatically adjust by this exact difference!
                    </div>
                  </div>

                  {/* Override Duration Selector */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: 8 }}>
                      Override Duration (Hides regular schedule for this period):
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {[
                        { id: '1', label: 'Only Today (1 Day)' },
                        { id: '2', label: '2 Days' },
                        { id: '3', label: '3 Days' },
                        { id: '7', label: '7 Days (1 Week)' },
                        { id: 'custom', label: 'Custom Date Range…' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDurationOption(opt.id)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: durationOption === opt.id ? '2px solid #EA580C' : '1px solid var(--border-color, #334155)',
                            background: durationOption === opt.id ? 'rgba(234, 88, 12, 0.25)' : 'rgba(255,255,255,0.05)',
                            color: durationOption === opt.id ? '#FF8A4C' : 'var(--text-secondary, #cbd5e1)',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {durationOption === 'custom' && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', display: 'block' }}>From:</span>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', display: 'block' }}>To:</span>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Split View: Dynamic Timetable & Leaflet Map */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 16, marginTop: 8 }}>
                  {/* Dynamic Shifted Stop Timetable */}
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      padding: 12,
                      maxHeight: 520,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 750, color: '#38BDF8', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      📋 Dynamically Calculated Event Timetable:
                    </div>

                    {shiftedStops.map((stop, idx) => {
                      const isFirst = idx === 0;
                      const isEnd = stop.isEndpoint || stop.name.toUpperCase().includes('VBIT');
                      return (
                        <div
                          key={stop.stopId || idx}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: isFirst ? 'rgba(234, 88, 12, 0.12)' : isEnd ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isFirst ? 'rgba(234, 88, 12, 0.3)' : isEnd ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.07)'}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: isFirst ? '#EA580C' : isEnd ? '#16A34A' : '#334155',
                                color: '#ffffff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {isEnd ? '★' : idx + 1}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {stop.name}
                              </div>
                              <div style={{ fontSize: 10.5, color: 'var(--muted, #94a3b8)' }}>
                                Regular: {stop.originalTime} ({formatMinutesDifference(stop.offsetMinutes || 0)})
                              </div>
                            </div>
                          </div>

                          {/* Editable time field for fine tuning */}
                          <input
                            type="time"
                            value={stop.scheduledTime}
                            onChange={(e) => handleIndividualStopTimeChange(idx, e.target.value)}
                            style={{
                              padding: '4px 6px',
                              borderRadius: 4,
                              border: '1px solid rgba(255,255,255,0.2)',
                              background: '#0f172a',
                              color: isFirst ? '#FF8A4C' : isEnd ? '#4ADE80' : '#ffffff',
                              fontSize: 12,
                              fontWeight: 750,
                              width: 82,
                              textAlign: 'center',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Leaflet Map Preview */}
                  <div style={{ height: 520, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', position: 'relative' }}>
                    <MapContainer
                      center={mapCenter}
                      zoom={12}
                      style={{ width: '100%', height: '100%' }}
                      scrollWheelZoom={true}
                    >
                      <TileLayer
                        url={MAP_LAYERS[activeLayer].url}
                        subdomains={MAP_LAYERS[activeLayer].subdomains}
                        attribution={MAP_LAYERS[activeLayer].attribution}
                        maxZoom={20}
                      />

                      {/* Road Route Path */}
                      {roadPolyline && roadPolyline.length > 1 && (
                        <>
                          <Polyline
                            positions={roadPolyline}
                            interactive={false}
                            pathOptions={{
                              color: '#EA580C',
                              weight: 6,
                              opacity: 0.95,
                              lineJoin: 'round',
                            }}
                          />
                          <Polyline
                            positions={roadPolyline}
                            interactive={false}
                            pathOptions={{
                              color: 'rgba(234, 88, 12, 0.3)',
                              weight: 12,
                              opacity: 0.5,
                              lineJoin: 'round',
                            }}
                          />
                        </>
                      )}

                      {/* Numbered Pins */}
                      {shiftedStops.map((stop, idx) => {
                        const isEnd = idx === shiftedStops.length - 1;
                        const isFirst = idx === 0;
                        const pinColor = isFirst ? '#EA580C' : isEnd ? '#16A34A' : '#0284c7';
                        return (
                          <Marker
                            key={stop.stopId || idx}
                            position={[stop.latitude, stop.longitude]}
                            icon={googleNumberedPin(idx + 1, pinColor, isEnd)}
                          >
                            <Popup>
                              <div style={{ minWidth: 150 }}>
                                <strong style={{ color: pinColor }}>{stop.name}</strong>
                                <div style={{ fontSize: 11, marginTop: 4 }}>
                                  Event Time: <strong>{stop.scheduledTime}</strong>
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>
                                  Regular Time: {stop.originalTime}
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        );
                      })}
                    </MapContainer>

                    {/* Layer Switcher */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 14,
                        right: 14,
                        zIndex: 1000,
                        display: 'flex',
                        background: 'rgba(15, 23, 42, 0.9)',
                        padding: '4px 6px',
                        borderRadius: 8,
                        gap: 4,
                      }}
                    >
                      {Object.entries(MAP_LAYERS).map(([key, layer]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveLayer(key)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            border: 'none',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: activeLayer === key ? '#EA580C' : 'transparent',
                            color: activeLayer === key ? '#ffffff' : '#94a3b8',
                          }}
                        >
                          {layer.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Publish Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setIsCreatingOverride(false)}
                    className="button button-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishOverride}
                    disabled={saving}
                    className="button button-primary"
                    style={{ padding: '10px 24px', fontSize: 13, fontWeight: 800 }}
                  >
                    {saving ? 'Publishing Event Override…' : `🚀 Publish Event Override (${durationOption === 'custom' ? 'Custom Range' : durationOption + ' Day(s)'})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
