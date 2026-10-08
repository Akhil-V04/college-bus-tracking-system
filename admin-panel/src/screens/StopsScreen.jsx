import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api, { errorMessage } from '../api';
import { EmptyState, Field, LoadingState, Modal, Notice, PageHeader } from '../components';

// Fix leaflet icon paths
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

const blankForm = { name: '', latitude: 0, longitude: 0 };

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    }
  });
  return null;
}

export default function StopsScreen() {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing({ id: null });
    setForm(blankForm);
  }

  function openEdit(stop) {
    setEditing(stop);
    setForm({
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
    });
  }

  function handleMapClick(latlng) {
    if (editing) {
      setForm({ ...form, latitude: latlng.lat, longitude: latlng.lng });
    }
  }

  async function save(event) {
    if (event) event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      };
      
      if (editing.id) {
        // We have to use two calls since PUT /stops/:id updates name, PUT /stops/:id/coordinates updates coords
        const originalStop = stops.find(s => s.id === editing.id);
        if (originalStop.name !== payload.name) {
          await api.put(`/stops/${editing.id}`, { name: payload.name });
        }
        if (originalStop.latitude !== payload.latitude || originalStop.longitude !== payload.longitude) {
          const coordRes = await api.put(`/stops/${editing.id}/coordinates`, { latitude: payload.latitude, longitude: payload.longitude });
          if (coordRes.data && coordRes.data.regeneratedSchedules > 0) {
            setMessage({ type: 'success', text: `Stop updated. ${coordRes.data.regeneratedSchedules} schedules were automatically regenerated.` });
          } else {
            setMessage({ type: 'success', text: 'Stop updated.' });
          }
        } else {
          setMessage({ type: 'success', text: 'Stop updated.' });
        }
      } else {
        await api.post('/stops', payload);
        setMessage({ type: 'success', text: 'Stop created.' });
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
      load();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Stop could not be deleted.') });
    }
  }

  // Find a good center based on existing stops, otherwise default
  const defaultCenter = stops.length > 0 ? [stops[0].latitude, stops[0].longitude] : [17.4474, 78.3762];

  return (
    <>
      <PageHeader eyebrow="Network configuration" title="Stops & Map"
        description="Manage precise GPS coordinates for all stops. Click on the map to place or update a stop."
        actions={<button className="button button-primary" onClick={openCreate}>+ Add stop</button>} />
      
      <Notice message={message} onDismiss={() => setMessage(null)} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', height: 'calc(100vh - 200px)' }}>
        
        {/* Left pane: List of stops */}
        <div className="panel" style={{ overflow: 'auto' }}>
          {loading ? <LoadingState label="Loading stops..." /> : stops.length === 0 ? (
            <EmptyState title="No stops found" description="Click 'Add stop' to create the first stop." />
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Coordinates</th><th /></tr></thead>
              <tbody>{stops.map((stop) => (
                <tr key={stop.id} style={{ backgroundColor: editing?.id === stop.id ? 'var(--teal-soft)' : 'transparent' }}>
                  <td><div className="cell-title">{stop.name}</div></td>
                  <td>
                    <span className="cell-subtitle">Lat: {stop.latitude.toFixed(5)}</span><br/>
                    <span className="cell-subtitle">Lng: {stop.longitude.toFixed(5)}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="text-button" onClick={() => openEdit(stop)}>Edit</button>
                      <button className="text-button text-button-danger" onClick={() => remove(stop)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {/* Right pane: Map */}
        <div className="panel" style={{ overflow: 'hidden' }}>
          {loading ? <LoadingState label="Loading map..." /> : (
          <MapContainer center={defaultCenter} zoom={12} style={{ width: '100%', height: '100%', minHeight: '400px' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />
            
            {stops.map((stop) => (
              <Marker key={stop.id} position={[stop.latitude, stop.longitude]}>
                <Popup>
                  <strong>{stop.name}</strong><br/>
                  <button className="text-button" onClick={() => openEdit(stop)} style={{ padding: 0, marginTop: '8px' }}>Edit this stop</button>
                </Popup>
              </Marker>
            ))}

            {editing && form.latitude !== 0 && (
              <Marker position={[form.latitude, form.longitude]} opacity={0.5}>
                <Popup><em>Editing position...</em></Popup>
              </Marker>
            )}
          </MapContainer>
          )}
        </div>
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit stop' : 'Create stop'}
          description="Click on the map to set coordinates automatically." onClose={() => setEditing(null)}>
          <form className="modal-body" onSubmit={save}>
            <div className="form-grid">
              <div className="form-span">
                <Field label="Stop name">
                  <input value={form.name} maxLength={100} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                </Field>
              </div>
              <Field label="Latitude">
                <input type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} required />
              </Field>
              <Field label="Longitude">
                <input type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} required />
              </Field>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving...' : 'Save stop'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
