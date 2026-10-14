import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import api, { errorMessage } from '../api';
import { EmptyState, Field, LoadingState, Notice, PageHeader } from '../components';

// Authentic Google Maps SVG pin generator
function googleMapPin(color = '#ea4335', text = '', isEditing = false) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:46px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));cursor:pointer;${
        isEditing ? 'transform:scale(1.2);transform-origin:bottom center;' : ''
      }">
        <svg viewBox="0 0 384 512" width="34" height="46" fill="${color}">
          <path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
        </svg>
        <div style="position:absolute;top:9px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;background:#ffffff;display:flex;align-items:center;justify-content:center;color:${color};font-weight:800;font-size:10px;box-shadow:inset 0 1px 2px rgba(0,0,0,0.3);">
          ${text || '●'}
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

const blankForm = { name: '', latitude: 0, longitude: 0 };

function MapClickHandler({ onMapClick, isEditing }) {
  useMapEvents({
    click(e) {
      if (isEditing) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

function MapFlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target && target[0] && target[1]) {
      map.flyTo(target, 15, { duration: 0.8 });
    }
  }, [target, map]);
  return null;
}

export default function StopsScreen() {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [activeLayer, setActiveLayer] = useState('roadmap');
  const [flyTarget, setFlyTarget] = useState(null);

  const markerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/stops', { params: { limit: 500 } });
      setStops(data.items);
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Stops could not be loaded.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    const center = stops.length > 0 ? [stops[0].latitude, stops[0].longitude] : [17.4474, 78.3762];
    setEditing({ id: null });
    setForm({
      name: '',
      latitude: Number(center[0].toFixed(5)),
      longitude: Number(center[1].toFixed(5)),
    });
    setFlyTarget(center);
  }

  function openEdit(stop) {
    setEditing(stop);
    setForm({
      name: stop.name,
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
    });
    setFlyTarget([stop.latitude, stop.longitude]);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(blankForm);
  }

  function handleMapClick(latlng) {
    setForm((prev) => ({
      ...prev,
      latitude: Number(latlng.lat.toFixed(5)),
      longitude: Number(latlng.lng.toFixed(5)),
    }));
  }

  const handleMarkerDrag = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          setForm((prev) => ({
            ...prev,
            latitude: Number(latlng.lat.toFixed(5)),
            longitude: Number(latlng.lng.toFixed(5)),
          }));
        }
      },
    }),
    []
  );

  async function save(event) {
    if (event) event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      };

      if (editing?.id) {
        const originalStop = stops.find((s) => s.id === editing.id);
        if (originalStop.name !== payload.name) {
          await api.put(`/stops/${editing.id}`, { name: payload.name });
        }
        if (originalStop.latitude !== payload.latitude || originalStop.longitude !== payload.longitude) {
          const coordRes = await api.put(`/stops/${editing.id}/coordinates`, {
            latitude: payload.latitude,
            longitude: payload.longitude,
          });
          if (coordRes.data && coordRes.data.regeneratedSchedules > 0) {
            setMessage({
              type: 'success',
              text: `Stop updated. ${coordRes.data.regeneratedSchedules} schedules were automatically regenerated.`,
            });
          } else {
            setMessage({ type: 'success', text: 'Stop updated.' });
          }
        } else {
          setMessage({ type: 'success', text: 'Stop updated.' });
        }
      } else {
        await api.post('/stops', payload);
        setMessage({ type: 'success', text: 'Stop created successfully.' });
      }
      setEditing(null);
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Stop could not be saved.') });
    } finally {
      setSaving(false);
    }
  }

  async function remove(stop) {
    if (!window.confirm(`Delete stop ${stop.name}? Existing schedules will prevent deletion.`)) return;
    try {
      await api.delete(`/stops/${stop.id}`);
      setMessage({ type: 'success', text: `Stop ${stop.name} deleted.` });
      if (editing?.id === stop.id) setEditing(null);
      load();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Stop could not be deleted.') });
    }
  }

  const filteredStops = useMemo(() => {
    if (!search.trim()) return stops;
    const q = search.toLowerCase();
    return stops.filter((s) => s.name.toLowerCase().includes(q));
  }, [stops, search]);

  const defaultCenter = stops.length > 0 ? [stops[0].latitude, stops[0].longitude] : [17.4474, 78.3762];

  const layer = MAP_LAYERS[activeLayer] || MAP_LAYERS.roadmap;

  return (
    <>
      <PageHeader
        eyebrow="Network configuration"
        title="Stops & Map"
        description="Manage precise GPS coordinates for all stops. Powered by Google Maps."
        actions={
          <button className="button button-primary" onClick={openCreate} disabled={editing !== null}>
            + Add stop
          </button>
        }
      />

      <Notice message={message} onDismiss={() => setMessage(null)} />

      <div style={{ display: 'grid', gridTemplateColumns: '430px 1fr', gap: '20px', height: 'calc(100vh - 195px)' }}>
        {/* Left Pane: Stop Editor or Stops Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {/* Active Stop Editor Card */}
          {editing !== null ? (
            <div
              className="panel"
              style={{
                padding: '20px',
                border: '2px solid var(--brand-primary, #0284c7)',
                background: 'var(--surface, #1e293b)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--navy, #fff)', fontWeight: 700 }}>
                    {editing.id ? '✏️ Edit Stop' : '📍 Add New Stop'}
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Click map or drag the blue pin to adjust coordinates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '18px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                  title="Close editor"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Field label="Stop Name">
                  <input
                    value={form.name}
                    placeholder="e.g. Uppal Depot, Ghatkesar"
                    maxLength={100}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    autoFocus
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="Latitude">
                    <input
                      type="number"
                      step="any"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </Field>
                  <Field label="Longitude">
                    <input
                      type="number"
                      step="any"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </Field>
                </div>

                <div
                  style={{
                    background: 'rgba(2, 132, 199, 0.12)',
                    border: '1px dashed #0284c7',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '11px',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🎯</span>
                  <span>Interactive Map Mode: Click anywhere on Google Maps to instantly update coordinates.</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button type="button" className="button button-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                  <button type="submit" className="button button-primary" disabled={saving}>
                    {saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Create Stop'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {/* Stops List */}
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line, #334155)', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="🔍 Search stops..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #475569)',
                  background: 'var(--canvas, #0f172a)',
                  color: 'var(--text, #fff)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <LoadingState label="Loading stops..." />
              ) : filteredStops.length === 0 ? (
                <EmptyState title="No stops found" description="Click 'Add stop' to create the first stop." />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Stop</th>
                      <th>Coordinates</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStops.map((stop) => {
                      const isSelected = editing?.id === stop.id;
                      return (
                        <tr
                          key={stop.id}
                          style={{
                            backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.18)' : 'transparent',
                            cursor: 'pointer',
                          }}
                          onClick={() => setFlyTarget([stop.latitude, stop.longitude])}
                        >
                          <td>
                            <div className="cell-title" style={{ fontWeight: 600 }}>
                              {stop.name}
                            </div>
                          </td>
                          <td>
                            <span className="cell-subtitle" style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                              <button
                                className="text-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(stop);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="text-button text-button-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  remove(stop);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: Google Maps View */}
        <div className="panel" style={{ overflow: 'hidden', position: 'relative' }}>
          {/* Map Layer Switcher Toolbar */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 1000,
              display: 'flex',
              gap: '6px',
              background: 'rgba(15, 23, 42, 0.88)',
              padding: '4px',
              borderRadius: '8px',
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
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeLayer === key ? '#1a73e8' : 'transparent',
                  color: '#fff',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.name}
              </button>
            ))}
          </div>

          {loading ? (
            <LoadingState label="Loading map..." />
          ) : (
            <MapContainer
              center={defaultCenter}
              zoom={13}
              style={{ width: '100%', height: '100%', minHeight: '500px' }}
            >
              <TileLayer
                key={layer.url}
                url={layer.url}
                subdomains={layer.subdomains}
                maxZoom={layer.maxZoom}
                attribution={layer.attribution}
              />
              <MapClickHandler onMapClick={handleMapClick} isEditing={editing !== null} />
              {flyTarget && <MapFlyTo target={flyTarget} />}

              {/* All Saved Stops (Red Google Pins) */}
              {stops.map((stop) => {
                const isCurrentEdit = editing?.id === stop.id;
                // If this stop is currently being edited, hide its static marker so the active draggable one is shown
                if (isCurrentEdit) return null;

                return (
                  <Marker
                    key={stop.id}
                    position={[stop.latitude, stop.longitude]}
                    icon={googleMapPin('#ea4335')}
                  >
                    <Popup>
                      <div style={{ padding: '2px 4px' }}>
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>{stop.name}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Lat: {stop.latitude.toFixed(5)}, Lng: {stop.longitude.toFixed(5)}
                        </div>
                        <button
                          className="text-button"
                          onClick={() => openEdit(stop)}
                          style={{
                            padding: '4px 0',
                            marginTop: '6px',
                            color: '#1a73e8',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: 'none',
                            background: 'none',
                          }}
                        >
                          ✏️ Edit this stop
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Active / Editing Stop (Blue Draggable Pin) */}
              {editing && form.latitude !== 0 && (
                <Marker
                  ref={markerRef}
                  draggable={true}
                  eventHandlers={handleMarkerDrag}
                  position={[form.latitude, form.longitude]}
                  icon={googleMapPin('#1a73e8', '★', true)}
                >
                  <Popup>
                    <div style={{ padding: '2px 4px' }}>
                      <strong style={{ color: '#1a73e8', fontSize: '13px' }}>
                        {form.name || 'Positioning Stop'}
                      </strong>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Drag pin or click map to move
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          )}

          {/* Active Mode Banner */}
          {editing !== null && (
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                background: 'rgba(15, 23, 42, 0.92)',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: '24px',
                fontSize: '12px',
                fontWeight: 600,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                border: '1px solid #1a73e8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                pointerEvents: 'none',
              }}
            >
              <span style={{ fontSize: '14px' }}>📍</span>
              <span>Click anywhere on Google Maps or drag the blue marker to update coordinates</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
