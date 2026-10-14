import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import api, { errorMessage } from '../api';
import { EmptyState, Field, LoadingState, Modal, Notice, PageHeader } from '../components';

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

// Google Maps teardrop marker pin with number
function googleNumberedPin(n, color = '#1a73e8') {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:46px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));cursor:pointer;">
        <svg viewBox="0 0 384 512" width="34" height="46" fill="${color}">
          <path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
        </svg>
        <div style="position:absolute;top:9px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;background:#ffffff;display:flex;align-items:center;justify-content:center;color:${color};font-weight:800;font-size:11px;box-shadow:inset 0 1px 2px rgba(0,0,0,0.3);">
          ${n}
        </div>
      </div>
    `,
    iconSize: [34, 46],
    iconAnchor: [17, 46],
    popupAnchor: [0, -46],
  });
}

function numberedIcon(n, color = '#1a73e8') { return googleNumberedPin(n, color); }
function pendingIcon(n) { return googleNumberedPin(n, '#ea580c'); }

// Component to auto-fit bounds when markers change
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [positions, map]);
  return null;
}

// Map click handler
function MapClickHandler({ onClick }) {
  useMapEvents({ click(e) { onClick(e.latlng); } });
  return null;
}

// ─── Main Component ───
export default function ScheduleBuilderScreen() {
  const [routes, setRoutes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [allStops, setAllStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  // Currently selected schedule to build
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [activeSchedule, setActiveSchedule] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Pending new stops placed on the map (not yet saved)
  const [pendingStops, setPendingStops] = useState([]);

  // Step: 'place' = placing pins on map, 'details' = entering names/times
  const [step, setStep] = useState('place');
  const [activeLayer, setActiveLayer] = useState('roadmap');
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [newScheduleForm, setNewScheduleForm] = useState({
    routeServiceId: '',
    name: '',
    direction: 'MORNING',
    includeVbit: true,
  });

  async function createScheduleAndOpenBuilder(event) {
    if (event) event.preventDefault();
    setSaving(true);
    try {
      const { data: created } = await api.post('/schedules', {
        routeServiceId: Number(newScheduleForm.routeServiceId),
        name: newScheduleForm.name.trim(),
        direction: newScheduleForm.direction.trim().toUpperCase(),
      });

      if (newScheduleForm.includeVbit) {
        let vbitStop = allStops.find((s) => (s.name || '').toUpperCase().includes('VBIT'));
        if (!vbitStop) {
          const { data: newStop } = await api.post('/stops', {
            name: 'VBIT',
            latitude: 17.47062,
            longitude: 78.72558,
          });
          vbitStop = newStop;
        }
        await api.post(`/schedules/${created.id}/stops`, {
          stopId: vbitStop.id,
          sequenceOrder: 1,
          scheduledTime: newScheduleForm.direction === 'EVENING' ? '16:30' : '09:30',
        });
      }

      setCreatingSchedule(false);
      setMessage({ type: 'success', text: 'Schedule created with VBIT College endpoint. Now add route stops on the map.' });
      await load();
      await loadScheduleDetail(created.id);
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Could not create schedule.') });
    } finally {
      setSaving(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduleRes, routeRes, stopRes] = await Promise.all([
        api.get('/schedules'),
        api.get('/route-services/admin', { params: { limit: 200 } }),
        api.get('/stops', { params: { limit: 500 } }),
      ]);
      setSchedules(scheduleRes.data);
      setRoutes(routeRes.data.items);
      setAllStops(stopRes.data.items);
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Could not load data.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load a specific schedule detail
  async function loadScheduleDetail(scheduleId) {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/schedules/${scheduleId}`);
      setActiveSchedule(data);
      setActiveScheduleId(scheduleId);
      setPendingStops([]);
      setStep('place');
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Schedule could not be loaded.') });
    } finally {
      setDetailLoading(false);
    }
  }

  // Check if a latlng is close to an existing stop (within ~50m)
  function findNearbyStop(latlng) {
    const threshold = 0.0005; // ~55m
    return allStops.find(s =>
      Math.abs(s.latitude - latlng.lat) < threshold &&
      Math.abs(s.longitude - latlng.lng) < threshold
    );
  }

  // Handle map click — add a new pin
  function handleMapClick(latlng) {
    if (step !== 'place') return;
    if (!activeSchedule || activeSchedule.status !== 'DRAFT') return;

    const nearby = findNearbyStop(latlng);
    const nextOrder = (activeSchedule?.stops?.length || 0) + pendingStops.length;

    setPendingStops(prev => [...prev, {
      tempId: Date.now(),
      latitude: latlng.lat,
      longitude: latlng.lng,
      name: nearby ? nearby.name : `Stop ${nextOrder + 1}`,
      existingStopId: nearby ? nearby.id : null,
      scheduledTime: '07:00',
      sequenceOrder: nextOrder,
    }]);
  }

  // Remove a pending stop
  function removePendingStop(tempId) {
    setPendingStops(prev => {
      const filtered = prev.filter(s => s.tempId !== tempId);
      // Reindex sequence orders
      return filtered.map((s, i) => ({
        ...s,
        sequenceOrder: (activeSchedule?.stops?.length || 0) + i,
      }));
    });
  }

  // Check if VBIT is already in saved stops or pending stops
  const hasVBIT = useMemo(() => {
    const inSaved = (activeSchedule?.stops || []).some(s => (s.stop?.name || '').toUpperCase().includes('VBIT'));
    const inPending = pendingStops.some(s => (s.name || '').toUpperCase().includes('VBIT'));
    return inSaved || inPending;
  }, [activeSchedule, pendingStops]);

  // Quick action to add VBIT College as default ending stop
  function addVBITDestination() {
    const vbitStop = allStops.find(s => (s.name || '').toUpperCase().includes('VBIT'));
    const nextOrder = (activeSchedule?.stops?.length || 0) + pendingStops.length;
    const lat = vbitStop ? vbitStop.latitude : 17.47062;
    const lng = vbitStop ? vbitStop.longitude : 78.72558;

    setPendingStops(prev => [...prev, {
      tempId: Date.now(),
      latitude: lat,
      longitude: lng,
      name: vbitStop ? vbitStop.name : 'VBIT',
      existingStopId: vbitStop ? vbitStop.id : null,
      scheduledTime: activeSchedule?.direction === 'EVENING' ? '16:30' : '09:30',
      sequenceOrder: nextOrder,
    }]);
    setMessage({ type: 'success', text: 'Added VBIT College as fixed destination stop.' });
  }

  // Move to the details step
  function proceedToDetails() {
    if (pendingStops.length === 0 && (activeSchedule?.stops?.length || 0) === 0) {
      setMessage({ type: 'error', text: 'Place at least one stop on the map first.' });
      return;
    }
    setStep('details');
  }

  // Update a pending stop field
  function updatePendingStop(tempId, field, value) {
    setPendingStops(prev => prev.map(s =>
      s.tempId === tempId ? { ...s, [field]: value } : s
    ));
  }

  // Save all pending stops to the schedule
  async function saveAllStops() {
    setSaving(true);
    try {
      for (const ps of pendingStops) {
        let stopId = ps.existingStopId;

        // Create the Stop record if it doesn't already exist
        if (!stopId) {
          const { data } = await api.post('/stops', {
            name: ps.name.trim(),
            latitude: ps.latitude,
            longitude: ps.longitude,
          });
          stopId = data.id;
        }

        // Add stop to the schedule
        await api.post(`/schedules/${activeScheduleId}/stops`, {
          stopId,
          sequenceOrder: ps.sequenceOrder,
          scheduledTime: ps.scheduledTime,
        });
      }

      setMessage({ type: 'success', text: `${pendingStops.length} stop(s) added to the schedule.` });
      setPendingStops([]);
      setStep('place');
      await loadScheduleDetail(activeScheduleId);
      await load(); // refresh allStops list
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Stops could not be saved.') });
    } finally {
      setSaving(false);
    }
  }

  // Remove a saved stop from the schedule
  async function removeSavedStop(entry) {
    if (!window.confirm(`Remove ${entry.stop.name} from this schedule?`)) return;
    try {
      await api.delete(`/schedules/${activeScheduleId}/stops/${entry.id}`);
      setMessage({ type: 'success', text: 'Stop removed from schedule.' });
      await loadScheduleDetail(activeScheduleId);
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Stop could not be removed.') });
    }
  }

  // Validate
  async function validateSchedule() {
    try {
      const { data } = await api.post(`/schedules/${activeScheduleId}/validate`);
      setMessage(data.valid
        ? { type: 'success', text: 'Schedule is valid and ready to publish!' }
        : { type: 'error', text: data.errors.join(' · ') });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Validation failed.') });
    }
  }

  // Publish
  async function publishSchedule() {
    if (!window.confirm('Publish this schedule? The current published version will be archived.')) return;
    try {
      await api.post(`/schedules/${activeScheduleId}/publish`);
      setMessage({ type: 'success', text: 'Schedule published! Passengers now see this version.' });
      setActiveSchedule(null);
      setActiveScheduleId(null);
      await load();
    } catch (error) {
      const details = error.response?.data?.errors?.join(' · ');
      setMessage({ type: 'error', text: details || errorMessage(error, 'Could not publish.') });
    }
  }

  // Delete Schedule
  async function deleteSchedule(scheduleToDelete) {
    const target = scheduleToDelete || activeSchedule;
    if (!target) return;
    const name = target.name || 'this schedule';
    const isPublished = target.status === 'PUBLISHED';
    const confirmMessage = isPublished
      ? `Are you sure you want to remove "${name}"? This schedule is currently PUBLISHED. Removing it will archive it from active operations.`
      : `Are you sure you want to delete "${name}"? This will permanently remove the schedule and its stops.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const { data } = await api.delete(`/schedules/${target.id}`);
      setActiveSchedule(null);
      setActiveScheduleId(null);
      setPendingStops([]);
      setStep('place');
      setMessage({
        type: 'success',
        text: data?.archived
          ? `Schedule "${name}" has historical trips and was archived.`
          : `Schedule "${name}" deleted successfully.`,
      });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, `Schedule "${name}" could not be deleted.`) });
    }
  }

  // All markers (saved + pending)
  const savedPositions = (activeSchedule?.stops || []).map(s => [s.stop.latitude, s.stop.longitude]);
  const pendingPositions = pendingStops.map(s => [s.latitude, s.longitude]);
  const allPositions = [...savedPositions, ...pendingPositions];

  // Default center
  const defaultCenter = allPositions.length > 0 ? allPositions[0] : [17.4474, 78.3762];

  // ─── No active schedule — show list ───
  if (!activeScheduleId) {
    const draftSchedules = schedules.filter(s => s.status === 'DRAFT');
    return (
      <>
        <PageHeader
          eyebrow="Visual route builder"
          title="Schedule Map Builder"
          description="Select a draft schedule to visually add stops by clicking on the map, or create a new draft schedule."
          actions={
            <button className="button button-primary" onClick={() => setCreatingSchedule(true)}>
              + New draft schedule
            </button>
          }
        />
        <Notice message={message} onDismiss={() => setMessage(null)} />
        {loading ? (
          <LoadingState label="Loading schedules…" />
        ) : draftSchedules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <EmptyState
              title="No draft schedules"
              description="Create a new draft schedule to start placing stops and build route geometry on Google Maps."
            />
            <button
              className="button button-primary"
              style={{ marginTop: 16 }}
              onClick={() => setCreatingSchedule(true)}
            >
              🎓 Create draft schedule with VBIT College
            </button>
          </div>
        ) : (
          <div className="panel table-wrap">
            <table className="data-table">
              <thead><tr><th>Route</th><th>Schedule</th><th>Direction</th><th>Version</th><th>Stops</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>{draftSchedules.map(s => (
                <tr key={s.id}>
                  <td><div className="cell-title">Route {s.routeService.routeNo}</div><div className="cell-subtitle">{s.routeService.name}</div></td>
                  <td>{s.name}</td>
                  <td>{s.direction}</td>
                  <td>v{s.version}</td>
                  <td>{s._count.stops}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button className="button button-primary" onClick={() => loadScheduleDetail(s.id)}>Open Map Builder</button>
                      <button className="text-button text-button-danger" onClick={() => deleteSchedule(s)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {creatingSchedule && (
          <Modal
            title="Create draft schedule"
            description="The schedule will open immediately in the Map Builder so you can place stops."
            onClose={() => setCreatingSchedule(false)}
          >
            <form className="modal-body" onSubmit={createScheduleAndOpenBuilder}>
              <div className="form-grid">
                <div className="form-span">
                  <Field label="Route">
                    <select
                      value={newScheduleForm.routeServiceId}
                      onChange={(e) => setNewScheduleForm({ ...newScheduleForm, routeServiceId: e.target.value })}
                      required
                    >
                      <option value="">Select route</option>
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          Route {r.routeNo} — {r.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="form-span">
                  <Field label="Schedule name">
                    <input
                      value={newScheduleForm.name}
                      maxLength={150}
                      placeholder="e.g. Morning Regular Timetable"
                      onChange={(e) => setNewScheduleForm({ ...newScheduleForm, name: e.target.value })}
                      required
                    />
                  </Field>
                </div>
                <Field label="Direction">
                  <select
                    value={newScheduleForm.direction}
                    onChange={(e) => setNewScheduleForm({ ...newScheduleForm, direction: e.target.value })}
                  >
                    <option value="MORNING">Morning / to college</option>
                    <option value="EVENING">Evening / from college</option>
                  </select>
                </Field>
              </div>

              <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(26, 115, 232, 0.08)', borderRadius: 8, border: '1px solid rgba(26, 115, 232, 0.25)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--navy)' }}>
                  <input
                    type="checkbox"
                    checked={newScheduleForm.includeVbit}
                    onChange={(e) => setNewScheduleForm({ ...newScheduleForm, includeVbit: e.target.checked })}
                  />
                  <span>🎓 Include <strong>VBIT College</strong> as default destination endpoint (at 09:30 AM)</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setCreatingSchedule(false)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create & open Map Builder'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </>
    );
  }

  // ─── Active schedule — Map Builder ───
  return (
    <>
      <PageHeader
        eyebrow={`Route ${activeSchedule?.routeService?.routeNo || '...'} · ${activeSchedule?.direction || ''}`}
        title={activeSchedule?.name || 'Loading schedule…'}
        description={step === 'place'
          ? 'Click on the map to place stops in order. Then click "Next: Add Details" to name them and set times.'
          : 'Enter stop names and scheduled arrival times below, then save.'
        }
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button button-secondary" onClick={() => { setActiveScheduleId(null); setActiveSchedule(null); setPendingStops([]); setStep('place'); }}>← Back to list</button>
            {activeSchedule?.status === 'DRAFT' && (
              <>
                <button className="button button-secondary" onClick={validateSchedule}>Validate</button>
                <button className="button button-primary" onClick={publishSchedule}>Publish</button>
              </>
            )}
            <button className="button button-danger" onClick={() => deleteSchedule(activeSchedule)}>Delete Schedule</button>
          </div>
        }
      />
      <Notice message={message} onDismiss={() => setMessage(null)} />

      {detailLoading ? <LoadingState label="Loading schedule…" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16, height: 'calc(100vh - 190px)' }}>

          {/* ─── Left: Map ─── */}
          <div className="panel" style={{ overflow: 'hidden', position: 'relative' }}>
            {/* Map Layer Switcher Toolbar */}
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 1000,
              display: 'flex', gap: 6, background: 'rgba(15, 23, 42, 0.88)', padding: 4,
              borderRadius: 8, backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              {Object.entries(MAP_LAYERS).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveLayer(key)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: activeLayer === key ? '#1a73e8' : 'transparent',
                    color: '#fff', transition: 'all 0.15s ease',
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>

            <MapContainer center={defaultCenter} zoom={12} style={{ width: '100%', height: '100%', minHeight: 500 }}>
              <TileLayer
                key={MAP_LAYERS[activeLayer]?.url || MAP_LAYERS.roadmap.url}
                url={MAP_LAYERS[activeLayer]?.url || MAP_LAYERS.roadmap.url}
                subdomains={MAP_LAYERS[activeLayer]?.subdomains || MAP_LAYERS.roadmap.subdomains}
                maxZoom={MAP_LAYERS[activeLayer]?.maxZoom || MAP_LAYERS.roadmap.maxZoom}
                attribution={MAP_LAYERS[activeLayer]?.attribution || MAP_LAYERS.roadmap.attribution}
              />
              {step === 'place' && activeSchedule?.status === 'DRAFT' && (
                <MapClickHandler onClick={handleMapClick} />
              )}
              {allPositions.length > 0 && <FitBounds positions={allPositions} />}

              {/* Saved stops (blue) */}
              {(activeSchedule?.stops || []).map((entry, i) => (
                <Marker key={`saved-${entry.id}`} position={[entry.stop.latitude, entry.stop.longitude]} icon={numberedIcon(i + 1)}>
                  <Popup>
                    <strong>Stop {i + 1}: {entry.stop.name}</strong><br />
                    <span style={{ color: '#666' }}>Time: {entry.scheduledTime}</span><br />
                    {activeSchedule.status === 'DRAFT' && (
                      <button onClick={() => removeSavedStop(entry)} style={{ marginTop: 6, color: '#dc2626', cursor: 'pointer', border: 'none', background: 'none', fontWeight: 600 }}>
                        Remove from schedule
                      </button>
                    )}
                  </Popup>
                </Marker>
              ))}

              {/* Pending stops (orange) */}
              {pendingStops.map((ps, i) => (
                <Marker key={`pending-${ps.tempId}`} position={[ps.latitude, ps.longitude]}
                  icon={pendingIcon((activeSchedule?.stops?.length || 0) + i + 1)}>
                  <Popup>
                    <strong>New Stop {(activeSchedule?.stops?.length || 0) + i + 1}</strong><br />
                    <span style={{ color: '#666' }}>{ps.name}</span><br />
                    <button onClick={() => removePendingStop(ps.tempId)} style={{ marginTop: 6, color: '#dc2626', cursor: 'pointer', border: 'none', background: 'none', fontWeight: 600 }}>
                      Remove
                    </button>
                  </Popup>
                </Marker>
              ))}

              {/* Polyline connecting all stops */}
              {allPositions.length >= 2 && (
                <Polyline positions={allPositions} pathOptions={{ color: '#1d4ed8', weight: 3, dashArray: '8 6', opacity: 0.7 }} />
              )}
            </MapContainer>

            {/* Map overlay instruction */}
            {step === 'place' && activeSchedule?.status === 'DRAFT' && (
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
                background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '10px 20px', borderRadius: 8,
                fontSize: 13, fontWeight: 600, pointerEvents: 'none',
              }}>
                🖱️ Click on the map to place stop #{(activeSchedule?.stops?.length || 0) + pendingStops.length + 1}
              </div>
            )}
          </div>

          {/* ─── Right: Sidebar ─── */}
          <div className="panel" style={{ overflow: 'auto', padding: 20 }}>

            {/* VBIT College Destination Banner */}
            {activeSchedule?.status === 'DRAFT' && (
              <div style={{
                background: 'rgba(26, 115, 232, 0.08)',
                border: '1px solid rgba(26, 115, 232, 0.35)',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>
                      🎓 Fixed Destination: VBIT
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {hasVBIT ? '✓ VBIT campus is included' : 'Default college endpoint for all morning routes'}
                    </div>
                  </div>
                  {!hasVBIT && (
                    <button
                      type="button"
                      className="button button-primary"
                      style={{ fontSize: 11, padding: '5px 10px', whiteSpace: 'nowrap' }}
                      onClick={addVBITDestination}
                    >
                      + Add VBIT Stop
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Saved stops summary */}
            {(activeSchedule?.stops?.length || 0) > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 8, letterSpacing: 0.5 }}>
                  SAVED STOPS ({activeSchedule.stops.length})
                </h3>
                {activeSchedule.stops.map((entry, i) => (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    borderRadius: 8, marginBottom: 4,
                    background: 'var(--surface, #f9fafb)', border: '1px solid var(--border, #e5e7eb)',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', background: '#1d4ed8',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 12, flexShrink: 0,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.stop.name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{entry.scheduledTime}</div>
                    </div>
                    {activeSchedule.status === 'DRAFT' && (
                      <button className="text-button text-button-danger" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => removeSavedStop(entry)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Step: Place pins */}
            {step === 'place' && (
              <>
                {pendingStops.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#ea580c', marginBottom: 8, letterSpacing: 0.5 }}>
                      NEW PINS ({pendingStops.length})
                    </h3>
                    {pendingStops.map((ps, i) => (
                      <div key={ps.tempId} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderRadius: 8, marginBottom: 4,
                        background: '#fff7ed', border: '1px solid #fed7aa',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', background: '#ea580c',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 12, flexShrink: 0,
                        }}>{(activeSchedule?.stops?.length || 0) + i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ps.name}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>
                            {ps.latitude.toFixed(5)}, {ps.longitude.toFixed(5)}
                            {ps.existingStopId && <span style={{ color: '#16a34a', marginLeft: 4 }}>✓ existing</span>}
                          </div>
                        </div>
                        <button className="text-button text-button-danger" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => removePendingStop(ps.tempId)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {pendingStops.length === 0 && (activeSchedule?.stops?.length || 0) === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Click the map to place stops</div>
                    <div style={{ fontSize: 13 }}>Each click adds a new stop in sequence order</div>
                  </div>
                )}

                {activeSchedule?.status === 'DRAFT' && pendingStops.length > 0 && (
                  <button className="button button-primary" style={{ width: '100%', marginTop: 8 }} onClick={proceedToDetails}>
                    Next: Add Details →
                  </button>
                )}
              </>
            )}

            {/* Step: Enter details */}
            {step === 'details' && (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#ea580c', marginBottom: 12, letterSpacing: 0.5 }}>
                  ENTER STOP DETAILS
                </h3>
                {pendingStops.map((ps, i) => (
                  <div key={ps.tempId} style={{
                    padding: 14, borderRadius: 10, marginBottom: 12,
                    background: '#fff7ed', border: '1px solid #fed7aa',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: '#ea580c',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 12, flexShrink: 0,
                      }}>{(activeSchedule?.stops?.length || 0) + i + 1}</div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>Stop #{(activeSchedule?.stops?.length || 0) + i + 1}</span>
                      {ps.existingStopId && <span style={{ color: '#16a34a', fontSize: 11 }}>✓ using existing stop</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <Field label="Stop name">
                          <input value={ps.name} maxLength={100}
                            onChange={(e) => updatePendingStop(ps.tempId, 'name', e.target.value)}
                            disabled={!!ps.existingStopId} required />
                        </Field>
                      </div>
                      <Field label="Scheduled time">
                        <input type="time" value={ps.scheduledTime}
                          onChange={(e) => updatePendingStop(ps.tempId, 'scheduledTime', e.target.value)} required />
                      </Field>
                      <Field label="Sequence">
                        <input type="number" value={ps.sequenceOrder} min="0"
                          onChange={(e) => updatePendingStop(ps.tempId, 'sequenceOrder', Number(e.target.value))} required />
                      </Field>
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="button button-secondary" style={{ flex: 1 }} onClick={() => setStep('place')}>
                    ← Back to map
                  </button>
                  <button className="button button-primary" style={{ flex: 1 }} onClick={saveAllStops} disabled={saving}>
                    {saving ? 'Saving…' : `Save ${pendingStops.length} stop(s)`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
