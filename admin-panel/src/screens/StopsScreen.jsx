import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import api, { errorMessage } from '../api';
import { EmptyState, Field, LoadingState, Notice, PageHeader, StatusBadge } from '../components';

// Fix leaflet default marker icons
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ iconUrl, shadowUrl: iconShadow, iconAnchor: [12, 41], popupAnchor: [1, -34] });
L.Marker.prototype.options.icon = DefaultIcon;

// Fixed default college endpoint
const VBIT_ENDPOINT = {
  name: 'VBIT College',
  latitude: 17.4705,
  longitude: 78.7255,
  scheduledTime: '09:30',
  isEndpoint: true,
};

// Google Maps custom pin generator
function createMapPin(text, color = '#ea580c', isEnd = false) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:46px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));cursor:pointer;transition:transform 0.15s ease;">
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

// Polyline decoder for Google Maps geometry
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

function MapClickHandler({ onClick, enabled }) {
  useMapEvents({
    click(e) {
      if (enabled) onClick(e.latlng);
    },
  });
  return null;
}

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

export default function StopsScreen() {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [direction, setDirection] = useState('MORNING');
  const [routeStops, setRouteStops] = useState([]);
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeLayer, setActiveLayer] = useState('roadmap');
  const [searchQuery, setSearchQuery] = useState('');
  const [masterStops, setMasterStops] = useState([]);
  const [viewMode, setViewMode] = useState('route'); // 'route' | 'master'

  // Master stop creation form
  const [newMasterName, setNewMasterName] = useState('');

  // 1. Initial load: all routes and master stops
  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [routesRes, stopsRes] = await Promise.all([
        api.get('/route-services'),
        api.get('/stops', { params: { limit: 500 } }),
      ]);
      setRoutes(routesRes.data || []);
      setMasterStops(stopsRes.data?.items || []);

      // If routes exist, auto-select the first route
      if (routesRes.data?.length > 0 && !selectedRouteId) {
        setSelectedRouteId(String(routesRes.data[0].id));
      }
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Could not load transport routes.') });
    } finally {
      setLoading(false);
    }
  }, [selectedRouteId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // 2. Load stops for the selected route
  const loadRouteDetails = useCallback(async (routeId) => {
    if (!routeId) {
      setRouteStops([]);
      setScheduleInfo(null);
      return;
    }
    setRouteLoading(true);
    setMessage(null);
    try {
      const { data: schedule } = await api.get(`/schedules/route/${routeId}/detail`);
      setScheduleInfo(schedule);

      if (schedule.stops && schedule.stops.length > 0) {
        // Map existing stops
        const mapped = schedule.stops.map((s, idx) => ({
          id: s.id,
          stopId: s.stop.id,
          name: s.stop.name,
          latitude: Number(s.stop.latitude),
          longitude: Number(s.stop.longitude),
          scheduledTime: s.scheduledTime,
          isEndpoint: (s.stop.name || '').toUpperCase().includes('VBIT') || idx === schedule.stops.length - 1,
        }));

        // Ensure VBIT is present as the ending stop
        const hasVbit = mapped.some((s) => s.isEndpoint || s.name.toUpperCase().includes('VBIT'));
        if (!hasVbit) {
          mapped.push({ ...VBIT_ENDPOINT });
        }
        setRouteStops(mapped);
      } else {
        // Brand new route schedule: start with VBIT College as final stop
        setRouteStops([{ ...VBIT_ENDPOINT }]);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        // No schedule created yet for this route -> initialize with VBIT College
        setScheduleInfo(null);
        setRouteStops([{ ...VBIT_ENDPOINT }]);
      } else {
        setMessage({ type: 'error', text: errorMessage(error, 'Could not load route schedule.') });
      }
    } finally {
      setRouteLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRouteId) {
      loadRouteDetails(selectedRouteId);
    }
  }, [selectedRouteId, loadRouteDetails]);

  const selectedRoute = useMemo(() => {
    return routes.find((r) => String(r.id) === String(selectedRouteId)) || null;
  }, [routes, selectedRouteId]);

  // Parse known stops and timings from selectedRoute.areaCovered
  const routePresetStops = useMemo(() => {
    if (!selectedRoute?.areaCovered) return [];
    const parts = selectedRoute.areaCovered.split(';').map((p) => p.trim()).filter(Boolean);
    const presets = [];
    for (const part of parts) {
      const lastOpen = part.lastIndexOf('(');
      const lastClose = part.lastIndexOf(')');
      let name = part.replace(/\.\s*$/, '').trim();
      let scheduledTime = '';
      if (lastOpen !== -1 && lastClose > lastOpen) {
        name = part.slice(0, lastOpen).replace(/\.\s*$/, '').trim();
        const rawTime = part.slice(lastOpen + 1, lastClose).trim();
        const tm = rawTime.match(/(\d{1,2}):(\d{2})/);
        if (tm) scheduledTime = `${tm[1].padStart(2, '0')}:${tm[2]}`;
      }
      if (name && !name.toUpperCase().includes('VBIT')) {
        presets.push({ name, scheduledTime: scheduledTime || '08:30' });
      }
    }
    return presets;
  }, [selectedRoute]);

  // 3. Click map to add stops in order (before VBIT College)
  function handleMapClick(latlng) {
    if (!selectedRouteId) {
      setMessage({ type: 'warning', text: 'Please select a route from the dropdown first before adding stops.' });
      return;
    }

    const newLat = Number(latlng.lat.toFixed(5));
    const newLng = Number(latlng.lng.toFixed(5));

    setRouteStops((prev) => {
      // Find where VBIT endpoint is
      const vbitIndex = prev.findIndex((s) => s.isEndpoint || s.name.toUpperCase().includes('VBIT'));
      const intermediateCount = vbitIndex >= 0 ? vbitIndex : prev.length;
      const nextOrder = intermediateCount + 1;

      // Suggest the next stop from routePresetStops if available
      const suggestedPreset = routePresetStops[intermediateCount] || null;

      let defaultName = `Stop ${nextOrder}`;
      let defaultTime = '08:30';

      if (suggestedPreset) {
        defaultName = suggestedPreset.name;
        defaultTime = suggestedPreset.scheduledTime;
      } else {
        const startMinutes = 7 * 60 + 30;
        const totalMinutes = startMinutes + (nextOrder - 1) * 15;
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        defaultTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }

      const newStop = {
        tempId: 'new-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: defaultName,
        latitude: newLat,
        longitude: newLng,
        scheduledTime: defaultTime,
        isEndpoint: false,
      };

      if (vbitIndex >= 0) {
        const copy = [...prev];
        copy.splice(vbitIndex, 0, newStop);
        return copy;
      }

      return [...prev, newStop, { ...VBIT_ENDPOINT }];
    });
  }

  // 4. Update stop name or arrival time
  function updateStop(index, field, value) {
    setRouteStops((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  // 5. Reorder stops (move up or down)
  function moveStop(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= routeStops.length) return;
    if (routeStops[index].isEndpoint || routeStops[targetIndex].isEndpoint) return; // Do not move past VBIT

    setRouteStops((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  }

  // 6. Remove an intermediate stop
  function removeStop(index) {
    if (routeStops[index].isEndpoint) {
      setMessage({ type: 'warning', text: 'VBIT College is the fixed destination endpoint and cannot be removed.' });
      return;
    }
    setRouteStops((prev) => prev.filter((_, i) => i !== index));
  }

  // 7. Add an existing master stop into the route sequence
  function addExistingMasterStop(masterStop) {
    if (!selectedRouteId) return;
    const vbitIndex = routeStops.findIndex((s) => s.isEndpoint || s.name.toUpperCase().includes('VBIT'));
    const nextOrder = (vbitIndex >= 0 ? vbitIndex : routeStops.length) + 1;

    const startMinutes = 7 * 60 + 30;
    const totalMinutes = startMinutes + (nextOrder - 1) * 15;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const defaultTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    const newStop = {
      stopId: masterStop.id,
      name: masterStop.name,
      latitude: Number(masterStop.latitude),
      longitude: Number(masterStop.longitude),
      scheduledTime: defaultTime,
      isEndpoint: false,
    };

    setRouteStops((prev) => {
      if (vbitIndex >= 0) {
        const copy = [...prev];
        copy.splice(vbitIndex, 0, newStop);
        return copy;
      }
      return [...prev, newStop, { ...VBIT_ENDPOINT }];
    });
  }

  // 8. Save Route Stops and Timetable
  async function saveRouteStops(publish = false) {
    if (!selectedRouteId) return;

    if (routeStops.length < 2) {
      setMessage({
        type: 'error',
        text: 'A route must have at least 2 stops: click on the map to add your starting pickup point before VBIT College.',
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        name: `${selectedRoute?.routeNo || 'Route'} Timetable`,
        direction,
        stops: routeStops.map((s, idx) => ({
          stopId: s.stopId || undefined,
          name: s.name.trim() || `Stop ${idx + 1}`,
          latitude: s.latitude,
          longitude: s.longitude,
          scheduledTime: s.scheduledTime,
          sequenceOrder: idx + 1,
        })),
        publish,
      };

      const { data } = await api.post(`/schedules/route/${selectedRouteId}/save-stops`, payload);
      setScheduleInfo(data);

      setMessage({
        type: 'success',
        text: publish
          ? `Route ${selectedRoute?.routeNo} published live! Passengers can now track this route and its stops.`
          : `Route ${selectedRoute?.routeNo} stops and timetable saved successfully. You can now select the next route from the dropdown.`,
      });

      // Reload route details to sync ids
      await loadRouteDetails(selectedRouteId);
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Could not save route stops.') });
    } finally {
      setSaving(false);
    }
  }

  // All coordinates for map polyline and bounds
  const stopCoordinates = useMemo(() => {
    return routeStops.map((s) => [s.latitude, s.longitude]);
  }, [routeStops]);

  // Decode published road polyline if available
  const publishedPolyline = useMemo(() => {
    if (scheduleInfo?.geometryPolyline) {
      return decodePolyline(scheduleInfo.geometryPolyline);
    }
    return null;
  }, [scheduleInfo]);

  const mapCenter = useMemo(() => {
    if (stopCoordinates.length > 0) return stopCoordinates[0];
    return [17.4474, 78.3762];
  }, [stopCoordinates]);

  // Filter master stops for search
  const filteredMasterStops = useMemo(() => {
    if (!searchQuery.trim()) return masterStops;
    const q = searchQuery.toLowerCase();
    return masterStops.filter((s) => s.name.toLowerCase().includes(q));
  }, [masterStops, searchQuery]);

  return (
    <>
      <PageHeader
        eyebrow="Interactive Route Builder"
        title="Stops & Map"
        description="Select a route, click the map to add ordered stops (with VBIT College as the default final destination), set times, and view the colored route path."
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', background: 'var(--surface)', padding: 3, borderRadius: 8, border: '1px solid var(--line)' }}>
              <button
                type="button"
                className={`button ${viewMode === 'route' ? 'button-primary' : 'button-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setViewMode('route')}
              >
                🗺️ Route Path Builder
              </button>
              <button
                type="button"
                className={`button ${viewMode === 'master' ? 'button-primary' : 'button-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setViewMode('master')}
              >
                📍 Master Stop Catalog
              </button>
            </div>
          </div>
        }
      />

      <Notice message={message} onDismiss={() => setMessage(null)} />

      {/* ─── Route Selector Toolbar ─── */}
      <div className="panel" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <div style={{ minWidth: 260, flex: '1 1 300px' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 750, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Select Route To Map Stops
          </label>
          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--canvas)', color: 'var(--ink)', fontSize: 13, fontWeight: 650, outline: 'none' }}
          >
            <option value="">-- Choose a route --</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                Route {r.routeNo} — {r.name}
              </option>
            ))}
          </select>
        </div>

        {selectedRoute && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--surface-hover)', border: '1px solid var(--line)', fontSize: 12 }}>
                <span style={{ color: 'var(--muted)' }}>Capacity: </span>
                <strong>{selectedRoute.capacity} seats</strong>
              </div>
              <div style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--surface-hover)', border: '1px solid var(--line)', fontSize: 12 }}>
                <span style={{ color: 'var(--muted)' }}>Driver: </span>
                <strong>{selectedRoute.driver?.name || 'Unassigned'}</strong>
              </div>
              <div>
                <StatusBadge value={scheduleInfo?.status || 'NEW_ROUTE'} />
              </div>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="button button-secondary"
                disabled={saving || routeStops.length < 2}
                onClick={() => saveRouteStops(false)}
              >
                {saving ? 'Saving…' : '💾 Save Stops'}
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={saving || routeStops.length < 2}
                onClick={() => saveRouteStops(true)}
              >
                {saving ? 'Publishing…' : '🚀 Publish Live'}
              </button>
            </div>

            {/* Route Stops Reference Banner */}
            {selectedRoute.areaCovered && (
              <div
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(234, 88, 12, 0.08)',
                  border: '1px solid rgba(234, 88, 12, 0.25)',
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontWeight: 750, color: '#EA580C', marginBottom: 2 }}>
                  📋 Route {selectedRoute.routeNo} Scheduled Stops from Transport Document ({routePresetStops.length} stops):
                </div>
                <div style={{ color: 'var(--ink)', fontSize: 11.5, opacity: 0.9 }}>
                  {selectedRoute.areaCovered}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {loading ? (
        <LoadingState label="Loading transport routes and stops…" />
      ) : viewMode === 'master' ? (
        /* ─── Master Stop Catalog Mode ─── */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) 1fr', gap: 20 }}>
          <div className="panel" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Add Master Stop</h3>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: '0 0 16px' }}>
              Add a standalone landmark stop by clicking anywhere on the map.
            </p>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Stop Name">
                <input
                  type="text"
                  placeholder="e.g. Uppal Ring Road"
                  value={newMasterName}
                  onChange={(e) => setNewMasterName(e.target.value)}
                />
              </Field>
              <Field label="Search Catalog">
                <input
                  type="text"
                  placeholder="Filter existing stops..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </Field>
            </div>
            <div style={{ marginTop: 20, maxHeight: 380, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stop</th>
                    <th>Coords</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredMasterStops.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
                      <td><span className="cell-subtitle">{Number(s.latitude).toFixed(3)}, {Number(s.longitude).toFixed(3)}</span></td>
                      <td>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => addExistingMasterStop(s)}
                          title="Add to currently selected route"
                        >
                          + Add to route
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel" style={{ position: 'relative', overflow: 'hidden', minHeight: 600 }}>
            <MapContainer center={mapCenter} zoom={12} style={{ width: '100%', height: '100%', minHeight: 600 }}>
              <TileLayer
                url={MAP_LAYERS[activeLayer].url}
                subdomains={MAP_LAYERS[activeLayer].subdomains}
                attribution={MAP_LAYERS[activeLayer].attribution}
                maxZoom={20}
              />
              {masterStops.map((s) => (
                <Marker key={s.id} position={[s.latitude, s.longitude]} icon={createMapPin('●', '#0284c7')}>
                  <Popup>
                    <strong>{s.name}</strong><br />
                    <span>Lat: {s.latitude}, Lng: {s.longitude}</span><br />
                    {selectedRoute && (
                      <button
                        type="button"
                        className="button button-primary"
                        style={{ marginTop: 8, padding: '4px 8px', fontSize: 11 }}
                        onClick={() => addExistingMasterStop(s)}
                      >
                        + Add to Route {selectedRoute.routeNo}
                      </button>
                    )}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      ) : (
        /* ─── Route Path Builder Mode ─── */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 440px) 1fr', gap: 20, alignItems: 'start' }}>
          
          {/* ─── Left Panel: Organized Stops List ─── */}
          <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  {selectedRoute ? `Route ${selectedRoute.routeNo} Stops` : 'Route Stops'}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 650 }}>
                  {routeStops.length} Stop{routeStops.length === 1 ? '' : 's'}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
                Click on the map to add pickup stops in sequence. The first stop is where the bus begins; <strong>VBIT College</strong> is automatically the final destination.
              </p>
            </div>

            {routeLoading ? (
              <LoadingState label="Loading stops for route…" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(100vh - 360px)', overflowY: 'auto', paddingRight: 4 }}>
                {routeStops.map((stop, idx) => {
                  const isFirst = idx === 0 && !stop.isEndpoint;
                  const isEnd = stop.isEndpoint || (stop.name || '').toUpperCase().includes('VBIT');
                  return (
                    <article
                      key={stop.tempId || stop.id || `stop-${idx}`}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: isEnd ? 'rgba(234, 88, 12, 0.08)' : 'var(--canvas)',
                        border: isEnd ? '1px solid rgba(234, 88, 12, 0.35)' : '1px solid var(--line)',
                        display: 'grid',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: isEnd ? '#EA580C' : isFirst ? '#16A34A' : 'var(--surface-hover)',
                              color: isEnd || isFirst ? '#ffffff' : 'var(--ink)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 800,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }}
                          >
                            {isEnd ? '🎓' : idx + 1}
                          </span>
                          <strong>
                            {isEnd ? 'Final Destination' : isFirst ? '1 (Starting Pickup)' : `Stop ${idx + 1}`}
                          </strong>
                        </div>

                        {/* Reorder & Delete Actions */}
                        {!isEnd && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              className="button button-ghost"
                              disabled={idx === 0}
                              onClick={() => moveStop(idx, -1)}
                              style={{ padding: '2px 6px', fontSize: 10 }}
                              title="Move Stop Up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              className="button button-ghost"
                              disabled={idx === routeStops.length - 2}
                              onClick={() => moveStop(idx, 1)}
                              style={{ padding: '2px 6px', fontSize: 10 }}
                              title="Move Stop Down"
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              className="text-button text-button-danger"
                              onClick={() => removeStop(idx)}
                              style={{ padding: '2px 6px', fontSize: 12 }}
                              title="Remove this stop"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        {isEnd && (
                          <span style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            🔒 Fixed Endpoint
                          </span>
                        )}
                      </div>

                      {/* Stop Name & Scheduled Time Inputs with Route Preset Selector */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {!isEnd && routePresetStops.length > 0 && (
                          <div>
                            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--teal)', fontWeight: 750, marginBottom: 3 }}>
                              <span>📍 Select Stop Name from Route List:</span>
                              <span style={{ fontSize: 9, color: 'var(--muted)' }}>Select preset or edit text below</span>
                            </label>
                            <select
                              value=""
                              onChange={(e) => {
                                const chosenName = e.target.value;
                                if (!chosenName) return;
                                const chosen = routePresetStops.find((p) => p.name === chosenName);
                                updateStop(idx, 'name', chosenName);
                                if (chosen?.scheduledTime) {
                                  updateStop(idx, 'scheduledTime', chosen.scheduledTime);
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '7px 10px',
                                borderRadius: 8,
                                border: '1.5px solid var(--teal)',
                                background: 'rgba(20, 184, 166, 0.08)',
                                color: 'var(--ink)',
                                fontSize: 12,
                                fontWeight: 700,
                                outline: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">▼ Pick from Route {selectedRoute.routeNo} ({routePresetStops.length} stops available)...</option>
                              {routePresetStops.map((preset, pIdx) => (
                                <option key={preset.name + pIdx} value={preset.name}>
                                  {pIdx + 1}. {preset.name} {preset.scheduledTime ? `(${preset.scheduledTime})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginBottom: 3 }}>
                              Stop Name {isEnd ? '' : '(Editable, e.g. Lalapet 2)'}
                            </label>
                            <input
                              type="text"
                              value={stop.name}
                              disabled={isEnd}
                              onChange={(e) => updateStop(idx, 'name', e.target.value)}
                              placeholder="e.g. Lalapet, Lalapet 2..."
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: '1px solid var(--line)',
                                background: isEnd ? 'transparent' : 'var(--surface)',
                                color: 'var(--ink)',
                                fontSize: 12,
                                fontWeight: 600,
                                outline: 'none',
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginBottom: 3 }}>
                              Scheduled Arrival
                            </label>
                            <input
                              type="time"
                              value={stop.scheduledTime}
                              onChange={(e) => updateStop(idx, 'scheduledTime', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: '1px solid var(--line)',
                                background: 'var(--surface)',
                                color: 'var(--ink)',
                                fontSize: 12,
                                fontWeight: 600,
                                outline: 'none',
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}>
                        <span>GPS: {Number(stop.latitude).toFixed(4)}, {Number(stop.longitude).toFixed(4)}</span>
                        <span>{isEnd ? 'Terminates at College' : 'Passenger Boarding'}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Quick Action Buttons */}
            {selectedRoute && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={saving || routeStops.length < 2}
                  onClick={() => saveRouteStops(false)}
                >
                  {saving ? 'Saving…' : '💾 Save Draft'}
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={saving || routeStops.length < 2}
                  onClick={() => saveRouteStops(true)}
                >
                  {saving ? 'Publishing…' : '🚀 Publish Live'}
                </button>
              </div>
            )}
          </div>

          {/* ─── Right Panel: Interactive Route Map with Colored Path ─── */}
          <div className="panel" style={{ position: 'relative', overflow: 'hidden', height: 'calc(100vh - 230px)', minHeight: 600 }}>
            {/* Map Layer Switcher Toolbar */}
            <div
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                zIndex: 1000,
                display: 'flex',
                gap: 6,
                background: 'rgba(15, 23, 42, 0.85)',
                padding: 4,
                borderRadius: 8,
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {Object.entries(MAP_LAYERS).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveLayer(key)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: activeLayer === key ? '#EA580C' : 'transparent',
                    color: '#ffffff',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>

            {/* Route Summary Pill on Map */}
            {selectedRoute && (
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  left: 60,
                  zIndex: 1000,
                  background: 'rgba(15, 23, 42, 0.88)',
                  color: '#ffffff',
                  padding: '7px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ color: '#EA580C' }}>●</span>
                <span>Route {selectedRoute.routeNo} — {selectedRoute.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                  ({routeStops.length} stops ending at VBIT)
                </span>
              </div>
            )}

            <MapContainer
              center={mapCenter}
              zoom={12}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                key={MAP_LAYERS[activeLayer].url}
                url={MAP_LAYERS[activeLayer].url}
                subdomains={MAP_LAYERS[activeLayer].subdomains}
                attribution={MAP_LAYERS[activeLayer].attribution}
                maxZoom={20}
              />

              {/* Click to add new stops */}
              <MapClickHandler onClick={handleMapClick} enabled={Boolean(selectedRouteId)} />

              {/* Auto-fit map to show all stops */}
              {stopCoordinates.length > 0 && <FitBounds positions={stopCoordinates} />}

              {/* ─── COLORED ROUTE PATH FROM START TO END ─── */}
              {publishedPolyline && publishedPolyline.length > 1 ? (
                // High-resolution Google turn-by-turn road polyline
                <Polyline
                  positions={publishedPolyline}
                  pathOptions={{
                    color: '#EA580C',
                    weight: 6,
                    opacity: 0.95,
                    lineJoin: 'round',
                  }}
                />
              ) : stopCoordinates.length >= 2 ? (
                // Direct route segment polyline connecting stops
                <>
                  <Polyline
                    positions={stopCoordinates}
                    pathOptions={{
                      color: '#EA580C',
                      weight: 5,
                      opacity: 0.9,
                      dashArray: '8, 8',
                    }}
                  />
                  <Polyline
                    positions={stopCoordinates}
                    pathOptions={{
                      color: 'rgba(234, 88, 12, 0.25)',
                      weight: 12,
                      opacity: 0.5,
                    }}
                  />
                </>
              ) : null}

              {/* ─── PINS FOR EACH STOP IN SEQUENCE ─── */}
              {routeStops.map((stop, idx) => {
                const isFirst = idx === 0 && !stop.isEndpoint;
                const isEnd = stop.isEndpoint || (stop.name || '').toUpperCase().includes('VBIT');
                const pinColor = isEnd ? '#EA580C' : isFirst ? '#16A34A' : '#0284C7';
                const pinText = isEnd ? '🎓' : String(idx + 1);

                return (
                  <Marker
                    key={stop.tempId || stop.id || `marker-${idx}`}
                    position={[stop.latitude, stop.longitude]}
                    icon={createMapPin(pinText, pinColor, isEnd)}
                    draggable={!isEnd}
                    eventHandlers={{
                      dragend: (e) => {
                        const latlng = e.target.getLatLng();
                        updateStop(idx, 'latitude', Number(latlng.lat.toFixed(5)));
                        updateStop(idx, 'longitude', Number(latlng.lng.toFixed(5)));
                      },
                    }}
                  >
                    <Popup>
                      <div style={{ minWidth: 160, padding: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: pinColor }}>
                            {isEnd ? '🎓 Final Destination' : isFirst ? '🏁 Starting Stop' : `Stop ${idx + 1}`}
                          </span>
                        </div>
                        <strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{stop.name}</strong>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                          Scheduled: <strong>{stop.scheduledTime}</strong>
                        </div>

                        {!isEnd && routePresetStops.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <select
                              value=""
                              onChange={(e) => {
                                const chosenName = e.target.value;
                                if (!chosenName) return;
                                const chosen = routePresetStops.find((p) => p.name === chosenName);
                                updateStop(idx, 'name', chosenName);
                                if (chosen?.scheduledTime) {
                                  updateStop(idx, 'scheduledTime', chosen.scheduledTime);
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                fontSize: 11,
                                borderRadius: 6,
                                border: '1px solid #14b8a6',
                                background: '#f0fdfa',
                                color: '#0f766e',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">▼ Pick from Route {selectedRoute.routeNo}...</option>
                              {routePresetStops.map((preset, pIdx) => (
                                <option key={preset.name + pIdx} value={preset.name}>
                                  {pIdx + 1}. {preset.name} ({preset.scheduledTime})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {!isEnd && (
                          <button
                            type="button"
                            onClick={() => removeStop(idx)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: '#dc2626',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            ✕ Remove stop from route
                          </button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      )}
    </>
  );
}
