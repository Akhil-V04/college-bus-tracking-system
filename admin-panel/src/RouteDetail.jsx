import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from './api';

export default function RouteDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [route, setRoute] = useState(null);
  const [stops, setStops] = useState([]);
  const [allStops, setAllStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // add form state
  const [addStopId, setAddStopId] = useState('');
  const [addTime, setAddTime] = useState('07:45');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: r }, { data: st }, { data: rs }] = await Promise.all([
        api.get(`/routes/${id}`).catch(() => ({ data: { id, name: `Route #${id}`, routeNo: '', areaCovered: '' } })),
        api.get('/stops', { params: { limit: 200 } }),
        api.get(`/route-stops/${id}`),
      ]);
      setRoute(r);
      setStops(rs);
      setAllStops(Array.isArray(st) ? st : st.items || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/route-stops', {
        routeId: Number(id),
        stopId: Number(addStopId),
        sequenceOrder: stops.length,
        scheduledTime: addTime,
      });
      setAddStopId('');
      setMessage({ type: 'success', text: 'Stop added' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Add failed' });
    } finally {
      setAdding(false);
    }
  }

  async function handleMove(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= stops.length) return;
    // swap sequenceOrder values
    const a = stops[index];
    const b = stops[target];
    try {
      await api.put(`/route-stops/${a.id}`, { sequenceOrder: b.sequenceOrder });
      await api.put(`/route-stops/${b.id}`, { sequenceOrder: a.sequenceOrder });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: 'Reorder failed: ' + (err.response?.data?.error || err.message) });
    }
  }

  async function handleDelete(rs) {
    if (!window.confirm('Remove this stop from the route?')) return;
    try {
      await api.delete(`/route-stops/${rs.id}`);
      setMessage({ type: 'success', text: 'Stop removed' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Delete failed' });
    }
  }

  if (loading) return <div className="py-10 text-center text-slate-500">Loading...</div>;

  return (
    <div>
      <button onClick={() => navigate('/routes')} className="mb-3 text-sm text-blue-600 hover:underline">
        &larr; Back to Routes
      </button>
      <h1 className="text-xl font-bold text-slate-800">
        Route {route?.routeNo || id}: {route?.name || ''}
      </h1>
      <p className="text-sm text-slate-500">{route?.areaCovered}</p>

      {message && (
        <div className={`mt-3 rounded px-3 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Stops in order</h2>
          {stops.length === 0 ? (
            <div className="rounded bg-white py-8 text-center text-slate-400">No stops added yet</div>
          ) : (
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Stop</th>
                    <th className="px-4 py-3 font-medium">Scheduled</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stops.map((rs, i) => (
                    <tr key={rs.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3">{rs.stop?.name || `Stop #${rs.stopId}`}</td>
                      <td className="px-4 py-3">{rs.scheduledTime}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        <button onClick={() => handleMove(i, -1)} disabled={i === 0} className="mr-1 text-slate-600 hover:underline disabled:opacity-30">↑</button>
                        <button onClick={() => handleMove(i, 1)} disabled={i === stops.length - 1} className="mr-2 text-slate-600 hover:underline disabled:opacity-30">↓</button>
                        <button onClick={() => handleDelete(rs)} className="text-red-600 hover:underline">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Add a stop</h2>
          <form onSubmit={handleAdd} className="space-y-4 rounded-lg bg-white p-5 shadow">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Stop</label>
              <select
                value={addStopId}
                onChange={(e) => setAddStopId(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2"
                required
              >
                <option value="">Select a stop...</option>
                {allStops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Scheduled time (HH:MM)</label>
              <input
                type="time"
                value={addTime}
                onChange={(e) => setAddTime(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2"
                required
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add Stop'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}