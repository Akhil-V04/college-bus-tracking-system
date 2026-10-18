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

// Google Maps style teardrop pin
function createNumberedPin(n, color = '#1a73e8', isEnd = false) {
  const label = isEnd ? '★' : String(n);
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:46px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));cursor:pointer;">
        <svg viewBox="0 0 384 512" width="34" height="46" fill="${color}">
          <path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
        </svg>
        <div style="position:absolute;top:9px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;background:#ffffff;display:flex;align-items:center;justify-content:center;color:${color};font-weight:850;font-size:${isEnd ? '11px' : '10px'};box-shadow:inset 0 1px 2px rgba(0,0,0,0.3);">
          ${label}
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

// Automatically recalculates Leaflet tile boundaries on mount, resize, and window dimension changes
function ResizeMapHandler() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 450);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
}

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      const target = e.originalEvent?.target;
      // Never trigger map click if the user clicked on a popup, button, control, marker, or link
      if (
        target &&
        target.closest(
          '.leaflet-popup, .leaflet-popup-content, .leaflet-popup-content-wrapper, .leaflet-popup-close-button, .leaflet-control, .leaflet-marker-icon, button, select, input, a'
        )
      ) {
        return;
      }
      onClick(e.latlng);
    },
  });
  return null;
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      map.fitBounds(positions, { padding: [40, 40], maxZoom: 15 });
    }
  }, [positions, map]);
  return null;
}

export default function ScheduleBuilderScreen() {
  const ignoreMapClickUntilRef = useRef(0);
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'overrides'
  const [routes, setRoutes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [activeLayer, setActiveLayer] = useState('roadmap');

  // ══════════════════════════════════════════════════
  // TAB 1: VISUAL MAP BUILDER STATE
  // ══════════════════════════════════════════════════
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [activeSchedule, setActiveSchedule] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingStops, setPendingStops] = useState([]);
  const [step, setStep] = useState('place'); // 'place' | 'details'
  const [saving, setSaving] = useState(false);
  const [existingStops, setExistingStops] = useState([]);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [newScheduleForm, setNewScheduleForm] = useState({
    routeServiceId: '',
    name: '',
    direction: 'MORNING',
    includeVbit: true,
  });

  // ══════════════════════════════════════════════════
  // TAB 2: COLLEGE EVENT TIMING OVERRIDES STATE
  // ══════════════════════════════════════════════════
  const [overrides, setOverrides] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [baseSchedule, setBaseSchedule] = useState(null);
  const [isCreatingOverride, setIsCreatingOverride] = useState(false);
  const [overrideName, setOverrideName] = useState('');
  const [durationOption, setDurationOption] = useState('1'); // '1' | '2' | '3' | '7' | 'custom'
  const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customEndDate, setCustomEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [newFirstStopTime, setNewFirstStopTime] = useState('15:00');
  const [shiftedStops, setShiftedStops] = useState([]);
  const [overridePolyline, setOverridePolyline] = useState([]);

  // Load all initial data (routes, schedules, existing stops, overrides)
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [routeRes, schedRes, stopRes, overrideRes] = await Promise.all([
        api.get('/route-services/admin', { params: { limit: 200 } }),
        api.get('/schedules'),
        api.get('/stops', { params: { limit: 500 } }),
        api.get('/schedules/overrides'),
      ]);
      const fetchedRoutes = routeRes.data.items || [];
      setRoutes(fetchedRoutes);
      setSchedules(schedRes.data || []);
      setExistingStops(stopRes.data.items || []);
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

  // Load active schedule detail for visual builder
  const loadScheduleDetail = useCallback(async (id) => {
    if (!id) return;
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/schedules/${id}`);
      setActiveSchedule(data);
      setActiveScheduleId(id);
      setPendingStops([]);
      setStep('place');
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Could not load schedule details.') });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Visual Map Builder: Map click to place stop
  function handleMapClick(latlng) {
    if (Date.now() < ignoreMapClickUntilRef.current) return;
    if (step !== 'place') return;
    if (activeSchedule?.status !== 'DRAFT') return;

    const lat = latlng.lat;
    const lng = latlng.lng;

    // Check proximity to existing stops (within ~50m)
    const nearby = existingStops.find((s) => {
      const dLat = Math.abs(Number(s.latitude) - lat);
      const dLng = Math.abs(Number(s.longitude) - lng);
      return dLat < 0.0005 && dLng < 0.0005;
    });

    const nextSeq = (activeSchedule?.stops?.length || 0) + pendingStops.length + 1;
    const isMorning = activeSchedule?.direction === 'MORNING';

    // Auto-calculate progressive default time
    const lastTime =
      pendingStops.length > 0
        ? pendingStops[pendingStops.length - 1].scheduledTime
        : (activeSchedule?.stops || []).length > 0
          ? activeSchedule.stops[activeSchedule.stops.length - 1].scheduledTime
          : isMorning
            ? '07:30'
            : '16:30';

    const lastMins = timeToMinutes(lastTime);
    const nextTime = minutesToTime(lastMins + 5);

    const newStop = {
      tempId: Date.now() + Math.random(),
      name: nearby ? nearby.name : `Stop ${nextSeq}`,
      latitude: nearby ? Number(nearby.latitude) : lat,
      longitude: nearby ? Number(nearby.longitude) : lng,
      scheduledTime: nextTime,
      sequenceOrder: nextSeq,
      existingStopId: nearby ? nearby.id : null,
    };

    setPendingStops((prev) => [...prev, newStop]);
  }

  function removePendingStop(tempId, e) {
    if (e) {
      e.stopPropagation?.();
      e.preventDefault?.();
    }
    ignoreMapClickUntilRef.current = Date.now() + 600;
    setPendingStops((prev) => prev.filter((s) => s.tempId !== tempId));
  }

  function updatePendingStop(tempId, field, value) {
    setPendingStops((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, [field]: value } : s)));
  }

  function proceedToDetails() {
    if (pendingStops.length === 0) {
      setMessage({ type: 'warning', text: 'Place at least one stop on the map first.' });
      return;
    }
    setStep('details');
  }

  // Save all pending stops
  async function saveAllStops() {
    setSaving(true);
    try {
      for (const ps of pendingStops) {
        let stopId = ps.existingStopId;
        if (!stopId) {
          const { data: newStop } = await api.post('/stops', {
            name: ps.name.trim(),
            latitude: ps.latitude,
            longitude: ps.longitude,
          });
          stopId = newStop.id;
        }

        await api.post(`/schedules/${activeScheduleId}/stops`, {
          stopId,
          sequenceOrder: Number(ps.sequenceOrder),
          scheduledTime: ps.scheduledTime,
        });
      }

      setMessage({ type: 'success', text: `Added ${pendingStops.length} stop(s) successfully.` });
      setPendingStops([]);
      setStep('place');
      await loadScheduleDetail(activeScheduleId);
      const { data: refreshedStops } = await api.get('/stops', { params: { limit: 500 } });
      setExistingStops(refreshedStops.items || []);
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Could not save stops.') });
    } finally {
      setSaving(false);
    }
  }

  // Add VBIT destination to draft schedule
  async function addVBITDestination() {
    if (!activeScheduleId) return;
    try {
      let vbit = existingStops.find((s) => (s.name || '').toUpperCase().includes('VBIT'));
      if (!vbit) {
        const { data: newStop } = await api.post('/stops', {
          name: 'VBIT',
          latitude: 17.47062,
          longitude: 78.72558,
        });
        vbit = newStop;
      }

      const seq = (activeSchedule?.stops?.length || 0) + 1;
      const defaultTime = activeSchedule?.direction === 'EVENING' ? '16:30' : '09:30';

      await api.post(`/schedules/${activeScheduleId}/stops`, {
        stopId: vbit.id,
        sequenceOrder: seq,
        scheduledTime: defaultTime,
      });

      setMessage({ type: 'success', text: 'VBIT College destination added.' });
      await loadScheduleDetail(activeScheduleId);
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Could not add VBIT stop.') });
    }
  }

  // Remove saved stop
  async function removeSavedStop(entry, e) {
    if (e) {
      e.stopPropagation?.();
      e.preventDefault?.();
    }
    ignoreMapClickUntilRef.current = Date.now() + 600;
    if (!window.confirm(`Remove ${entry.stop.name} from this schedule?`)) return;
    try {
      await api.delete(`/schedules/${activeScheduleId}/stops/${entry.id}`);
      setMessage({ type: 'success', text: 'Stop removed from schedule.' });
      await loadScheduleDetail(activeScheduleId);
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Stop could not be removed.') });
    }
  }

  // Validate schedule
  async function validateSchedule() {
    try {
      const { data } = await api.post(`/schedules/${activeScheduleId}/validate`);
      setMessage(
        data.valid
          ? { type: 'success', text: 'Schedule is valid and ready to publish!' }
          : { type: 'error', text: data.errors.join(' · ') }
      );
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Validation failed.') });
    }
  }

  // Publish schedule
  async function publishSchedule() {
    if (!window.confirm('Publish this schedule? The current published version will be archived.')) return;
    try {
      await api.post(`/schedules/${activeScheduleId}/publish`);
      setMessage({ type: 'success', text: 'Schedule published! Passengers and drivers now see this version.' });
      setActiveSchedule(null);
      setActiveScheduleId(null);
      await loadInitialData();
    } catch (error) {
      const details = error.response?.data?.errors?.join(' · ');
      setMessage({ type: 'error', text: details || errorMessage(error, 'Could not publish.') });
    }
  }

  // Delete schedule
  async function deleteSchedule(scheduleToDelete) {
    const target = scheduleToDelete || activeSchedule;
    if (!target) return;
    const name = target.name || 'this schedule';
    const isPublished = target.status === 'PUBLISHED';
    const confirmMessage = isPublished
      ? `Are you sure you want to remove "${name}"? This schedule is currently PUBLISHED. Removing it will archive it.`
      : `Are you sure you want to delete "${name}"? This will permanently remove the draft schedule and its stops.`;

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
      await loadInitialData();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, `Schedule "${name}" could not be deleted.`) });
    }
  }

  // Create new draft schedule and open directly in Visual Map Builder
  async function createScheduleAndOpenBuilder(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: created } = await api.post('/schedules', {
        routeServiceId: Number(newScheduleForm.routeServiceId),
        name: newScheduleForm.name.trim(),
        direction: newScheduleForm.direction.trim().toUpperCase(),
      });

      if (newScheduleForm.includeVbit) {
        let vbitStop = existingStops.find((s) => (s.name || '').toUpperCase().includes('VBIT'));
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
      setNewScheduleForm({ routeServiceId: '', name: '', direction: 'MORNING', includeVbit: true });
      setMessage({ type: 'success', text: 'Draft schedule created! Click on the map to place pickup stops.' });
      await loadScheduleDetail(created.id);
      await loadInitialData();
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error, 'Could not create schedule.') });
    } finally {
      setSaving(false);
    }
  }

  // Map coordinates for visual builder
  const savedPositions = (activeSchedule?.stops || []).map((s) => [s.stop.latitude, s.stop.longitude]);
  const pendingPositions = pendingStops.map((s) => [s.latitude, s.longitude]);
  const allPositions = [...savedPositions, ...pendingPositions];
  const visualMapCenter = allPositions.length > 0 ? allPositions[0] : [17.4474, 78.3762];
  const hasVBIT = (activeSchedule?.stops || []).some((s) => (s.stop.name || '').toUpperCase().includes('VBIT'));

  // ══════════════════════════════════════════════════
  // TAB 2: OVERRIDES LOGIC
  // ══════════════════════════════════════════════════
  const loadBaseRouteSchedule = useCallback(async (routeId) => {
    if (!routeId) return;
    try {
      const { data } = await api.get(`/schedules/route/${routeId}/detail`);
      setBaseSchedule(data);
      if (data?.geometryPolyline) {
        setOverridePolyline(decodePolyline(data.geometryPolyline));
      } else {
        setOverridePolyline([]);
      }
    } catch (err) {
      setBaseSchedule(null);
      setOverridePolyline([]);
    }
  }, []);

  useEffect(() => {
    if (selectedRouteId) {
      loadBaseRouteSchedule(selectedRouteId);
    }
  }, [selectedRouteId, loadBaseRouteSchedule]);

  const selectedRoute = useMemo(() => {
    return routes.find((r) => String(r.id) === String(selectedRouteId)) || null;
  }, [routes, selectedRouteId]);

  const selectedRouteOverrides = useMemo(() => {
    return overrides.filter((ov) => String(ov.routeServiceId) === String(selectedRouteId));
  }, [overrides, selectedRouteId]);

  const baseFirstStopTime = useMemo(() => {
    if (!baseSchedule?.stops || baseSchedule.stops.length === 0) return '07:55';
    return baseSchedule.stops[0].scheduledTime || '07:55';
  }, [baseSchedule]);

  const deltaMinutes = useMemo(() => {
    const baseMins = timeToMinutes(baseFirstStopTime);
    const newMins = timeToMinutes(newFirstStopTime);
    return newMins - baseMins;
  }, [baseFirstStopTime, newFirstStopTime]);

  function handleStartCreateOverride() {
    if (!baseSchedule || !baseSchedule.stops || baseSchedule.stops.length < 2) {
      setMessage({
        type: 'warning',
        text: 'This route does not have a published schedule yet. Please save & publish stops in "Stops & Map" or Visual Schedule Builder first.',
      });
      return;
    }

    setOverrideName(`Route ${selectedRoute.routeNo} Event Schedule`);
    setNewFirstStopTime('15:00');
    setDurationOption('1');

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

  function handleFirstStopTimeChange(newTime) {
    setNewFirstStopTime(newTime);
    const newStartMins = timeToMinutes(newTime);
    setShiftedStops((prev) =>
      prev.map((stop, idx) => {
        if (idx === 0) {
          return { ...stop, scheduledTime: newTime };
        }
        const computedMins = newStartMins + (stop.offsetMinutes || 0);
        return {
          ...stop,
          scheduledTime: minutesToTime(computedMins),
        };
      })
    );
  }

  function handleIndividualStopTimeChange(index, value) {
    setShiftedStops((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], scheduledTime: value };
      return copy;
    });
  }

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

  const overrideMapCenter = useMemo(() => {
    if (shiftedStops.length > 0) return [shiftedStops[0].latitude, shiftedStops[0].longitude];
    if (baseSchedule?.stops && baseSchedule.stops.length > 0) {
      return [baseSchedule.stops[0].stop.latitude, baseSchedule.stops[0].stop.longitude];
    }
    return [17.4474, 78.3762];
  }, [shiftedStops, baseSchedule]);

  // ══════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', paddingBottom: 40 }}>
      {/* Top Navigation & Mode Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="segmented-tabs" role="tablist" aria-label="Schedule Builder Modes">
          <button
            type="button"
            className={`segmented-tab ${activeTab === 'builder' ? 'segmented-tab-active' : ''}`}
            onClick={() => setActiveTab('builder')}
            role="tab"
            aria-selected={activeTab === 'builder'}
          >
            <span>🗺️</span>
            <span>Visual Schedule Map Builder</span>
          </button>
          <button
            type="button"
            className={`segmented-tab ${activeTab === 'overrides' ? 'segmented-tab-active' : ''}`}
            onClick={() => setActiveTab('overrides')}
            role="tab"
            aria-selected={activeTab === 'overrides'}
          >
            <span>⚡</span>
            <span>College Event Timing Overrides</span>
          </button>
        </div>

        {activeTab === 'overrides' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Route:</label>
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="inline-select"
              style={{ fontWeight: 700 }}
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  Route {r.routeNo} — {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Notice message={message} onDismiss={() => setMessage(null)} />

      {/* ────────────────────────────────────────────────
          TAB 1: VISUAL MAP BUILDER
      ──────────────────────────────────────────────── */}
      {activeTab === 'builder' && (
        <>
          {!activeScheduleId ? (
            /* Draft Schedules List */
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

              {loading ? (
                <LoadingState label="Loading schedules…" />
              ) : schedules.filter((s) => s.status === 'DRAFT').length === 0 ? (
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
                    <thead>
                      <tr>
                        <th>Route</th>
                        <th>Schedule</th>
                        <th>Direction</th>
                        <th>Version</th>
                        <th>Stops</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules
                        .filter((s) => s.status === 'DRAFT')
                        .map((s) => (
                          <tr key={s.id}>
                            <td>
                              <div className="cell-title">Route {s.routeService?.routeNo}</div>
                              <div className="cell-subtitle">{s.routeService?.name}</div>
                            </td>
                            <td>{s.name}</td>
                            <td>{s.direction}</td>
                            <td>v{s.version}</td>
                            <td>{s._count?.stops || s.stops?.length || 0}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                                <button className="button button-primary" onClick={() => loadScheduleDetail(s.id)}>
                                  Open Map Builder
                                </button>
                                <button className="text-button text-button-danger" onClick={() => deleteSchedule(s)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
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

                    <div
                      style={{
                        marginTop: 14,
                        padding: '10px 14px',
                        background: 'rgba(26, 115, 232, 0.08)',
                        borderRadius: 8,
                        border: '1px solid rgba(26, 115, 232, 0.25)',
                      }}
                    >
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
          ) : (
            /* Active Schedule Map Builder (Matches User's View) */
            <>
              <PageHeader
                eyebrow={`Route ${activeSchedule?.routeService?.routeNo || '...'} · ${activeSchedule?.direction || ''}`}
                title={activeSchedule?.name || 'Schedule Map'}
                description={
                  step === 'place'
                    ? 'Click on the map to place stops in order. Then click "Next: Add Details" to name them and set times.'
                    : 'Enter stop names and scheduled arrival times below, then save.'
                }
                actions={
                  <div>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => {
                        setActiveScheduleId(null);
                        setActiveSchedule(null);
                        setPendingStops([]);
                        setStep('place');
                      }}
                    >
                      ← Back to list
                    </button>
                    {activeSchedule?.status === 'DRAFT' && (
                      <>
                        <button type="button" className="button button-secondary" onClick={validateSchedule}>
                          Validate
                        </button>
                        <button type="button" className="button button-primary" onClick={publishSchedule}>
                          Publish
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="button button-danger"
                      onClick={() => deleteSchedule(activeSchedule)}
                    >
                      Delete Schedule
                    </button>
                  </div>
                }
              />

              {detailLoading ? (
                <LoadingState label="Loading schedule details…" />
              ) : (
                /* Dynamic Responsive Split Container */
                <div className="map-split-container">
                  {/* Left / Top Map Panel */}
                  <div className="panel map-viewport-panel">
                    {/* Layer Switcher Toolbar */}
                    <div className="map-layer-toolbar">
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
                            fontWeight: 650,
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

                    <MapContainer center={visualMapCenter} zoom={12} style={{ width: '100%', height: '100%' }}>
                      <ResizeMapHandler />
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

                      {/* Saved stops (blue numbered pins) */}
                      {(activeSchedule?.stops || []).map((entry, i) => (
                        <Marker
                          key={`saved-${entry.id}`}
                          position={[entry.stop.latitude, entry.stop.longitude]}
                          icon={createNumberedPin(i + 1, '#1d4ed8', (entry.stop.name || '').toUpperCase().includes('VBIT'))}
                        >
                          <Popup>
                            <strong>
                              Stop {i + 1}: {entry.stop.name}
                            </strong>
                            <br />
                            <span style={{ color: '#666' }}>Time: {entry.scheduledTime}</span>
                            <br />
                            {activeSchedule.status === 'DRAFT' && (
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  ignoreMapClickUntilRef.current = Date.now() + 600;
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  removeSavedStop(entry, e);
                                }}
                                style={{ marginTop: 6, color: '#dc2626', cursor: 'pointer', border: 'none', background: 'none', fontWeight: 650, fontSize: 11 }}
                              >
                                Remove from schedule
                              </button>
                            )}
                          </Popup>
                        </Marker>
                      ))}

                      {/* Pending stops (orange numbered pins) */}
                      {pendingStops.map((ps, i) => (
                        <Marker
                          key={`pending-${ps.tempId}`}
                          position={[ps.latitude, ps.longitude]}
                          icon={createNumberedPin((activeSchedule?.stops?.length || 0) + i + 1, '#ea580c')}
                        >
                          <Popup>
                            <strong>New Stop {(activeSchedule?.stops?.length || 0) + i + 1}</strong>
                            <br />
                            <span style={{ color: '#666' }}>{ps.name}</span>
                            <br />
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                ignoreMapClickUntilRef.current = Date.now() + 600;
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                removePendingStop(ps.tempId, e);
                              }}
                              style={{ marginTop: 6, color: '#dc2626', cursor: 'pointer', border: 'none', background: 'none', fontWeight: 650, fontSize: 11 }}
                            >
                              Remove
                            </button>
                          </Popup>
                        </Marker>
                      ))}

                      {/* Polyline connecting all stops */}
                      {allPositions.length >= 2 && (
                        <Polyline positions={allPositions} pathOptions={{ color: '#1d4ed8', weight: 3, dashArray: '8 6', opacity: 0.75 }} />
                      )}
                    </MapContainer>

                    {/* Dynamic Map Click Hint */}
                    {step === 'place' && activeSchedule?.status === 'DRAFT' && (
                      <div className="map-click-hint">
                        Click map to place stop #{(activeSchedule?.stops?.length || 0) + pendingStops.length + 1}
                      </div>
                    )}
                  </div>

                  {/* Right / Bottom Controls Panel */}
                  <div className="panel map-controls-panel" style={{ padding: 18 }}>
                    {/* Fixed Destination Banner */}
                    {activeSchedule?.status === 'DRAFT' && (
                      <div
                        style={{
                          background: 'rgba(26, 115, 232, 0.08)',
                          border: '1px solid rgba(26, 115, 232, 0.35)',
                          borderRadius: 8,
                          padding: '12px 14px',
                        }}
                      >
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
                      <div>
                        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', margin: '0 0 8px', letterSpacing: '0.04em' }}>
                          SAVED STOPS ({activeSchedule.stops.length})
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {activeSchedule.stops.map((entry, i) => (
                            <div
                              key={entry.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: 'var(--surface, #f9fafb)',
                                border: '1px solid var(--border, #e5e7eb)',
                              }}
                            >
                              <div
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: '50%',
                                  background: '#1d4ed8',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: 11,
                                  flexShrink: 0,
                                }}
                              >
                                {i + 1}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 12.5,
                                    color: 'var(--navy)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {entry.stop.name}
                                </div>
                                <div style={{ fontSize: 11, color: '#888' }}>{entry.scheduledTime}</div>
                              </div>
                              {activeSchedule.status === 'DRAFT' && (
                                <button
                                  type="button"
                                  className="text-button text-button-danger"
                                  style={{ fontSize: 12, padding: '2px 6px' }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    ignoreMapClickUntilRef.current = Date.now() + 600;
                                  }}
                                  onClick={(e) => removeSavedStop(entry, e)}
                                  title="Remove stop from schedule"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step: Place pins */}
                    {step === 'place' && (
                      <>
                        {pendingStops.length > 0 && (
                          <div>
                            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#ea580c', margin: '0 0 8px', letterSpacing: '0.04em' }}>
                              NEW PINS ({pendingStops.length})
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {pendingStops.map((ps, i) => (
                                <div
                                  key={ps.tempId}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    background: 'rgba(234, 88, 12, 0.08)',
                                    border: '1px solid rgba(234, 88, 12, 0.3)',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: '50%',
                                      background: '#ea580c',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 800,
                                      fontSize: 11,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {(activeSchedule?.stops?.length || 0) + i + 1}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontWeight: 700,
                                        fontSize: 12.5,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {ps.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#888' }}>
                                      {ps.latitude.toFixed(5)}, {ps.longitude.toFixed(5)}
                                      {ps.existingStopId && <span style={{ color: '#16a34a', marginLeft: 4 }}>✓ existing</span>}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-button text-button-danger"
                                    style={{ fontSize: 12, padding: '2px 6px' }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      ignoreMapClickUntilRef.current = Date.now() + 600;
                                    }}
                                    onClick={(e) => removePendingStop(ps.tempId, e)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {pendingStops.length === 0 && (activeSchedule?.stops?.length || 0) === 0 && (
                          <div style={{ textAlign: 'center', padding: '30px 10px', color: '#888' }}>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Click the map to place stops</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Each click adds a new stop in sequential order</div>
                          </div>
                        )}

                        {activeSchedule?.status === 'DRAFT' && pendingStops.length > 0 && (
                          <button
                            type="button"
                            className="button button-primary"
                            style={{ width: '100%', marginTop: 8 }}
                            onClick={proceedToDetails}
                          >
                            Next: Add Details →
                          </button>
                        )}
                      </>
                    )}

                    {/* Step: Enter details */}
                    {step === 'details' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 800, color: '#ea580c', margin: 0, letterSpacing: '0.04em' }}>
                          ENTER STOP DETAILS
                        </h3>
                        {pendingStops.map((ps, i) => (
                          <div
                            key={ps.tempId}
                            style={{
                              padding: 12,
                              borderRadius: 10,
                              background: 'rgba(234, 88, 12, 0.08)',
                              border: '1px solid rgba(234, 88, 12, 0.3)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <div
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  background: '#ea580c',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: 11,
                                  flexShrink: 0,
                                }}
                              >
                                {(activeSchedule?.stops?.length || 0) + i + 1}
                              </div>
                              <span style={{ fontWeight: 700, fontSize: 13 }}>
                                Stop #{(activeSchedule?.stops?.length || 0) + i + 1}
                              </span>
                              {ps.existingStopId && <span style={{ color: '#16a34a', fontSize: 11 }}>✓ existing</span>}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div style={{ gridColumn: '1 / -1' }}>
                                <Field label="Stop name">
                                  <input
                                    value={ps.name}
                                    maxLength={100}
                                    onChange={(e) => updatePendingStop(ps.tempId, 'name', e.target.value)}
                                    disabled={!!ps.existingStopId}
                                    required
                                  />
                                </Field>
                              </div>
                              <Field label="Scheduled time">
                                <input
                                  type="time"
                                  value={ps.scheduledTime}
                                  onChange={(e) => updatePendingStop(ps.tempId, 'scheduledTime', e.target.value)}
                                  required
                                />
                              </Field>
                              <Field label="Sequence">
                                <input
                                  type="number"
                                  value={ps.sequenceOrder}
                                  min="0"
                                  onChange={(e) => updatePendingStop(ps.tempId, 'sequenceOrder', Number(e.target.value))}
                                  required
                                />
                              </Field>
                            </div>
                          </div>
                        ))}

                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ flex: 1 }}
                            onClick={() => setStep('place')}
                          >
                            ← Back to map
                          </button>
                          <button
                            type="button"
                            className="button button-primary"
                            style={{ flex: 1 }}
                            onClick={saveAllStops}
                            disabled={saving}
                          >
                            {saving ? 'Saving…' : `Save ${pendingStops.length} stop(s)`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ────────────────────────────────────────────────
          TAB 2: COLLEGE EVENT TIMING OVERRIDES
      ──────────────────────────────────────────────── */}
      {activeTab === 'overrides' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>⚡</span>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>
                  Event & Custom Schedule Overrides
                </h1>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)', maxWidth: 780, lineHeight: 1.5 }}>
                Create temporary schedule shifts for college fests, evening symposiums, or exam days.
                Enter only the new first stop arrival time — subsequent stops automatically shift by their exact travel time difference!
              </p>
            </div>

            {selectedRoute && !isCreatingOverride && (
              <button
                type="button"
                className="button button-primary"
                onClick={handleStartCreateOverride}
              >
                + Create Event Schedule Shift
              </button>
            )}
          </div>

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
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      The standard regular schedule is temporarily replaced. Passengers and drivers see this event timetable.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedRouteOverrides.map((ov) => (
                  <div
                    key={ov.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
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
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{ov.name}</span>
                      <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--teal)', fontWeight: 600 }}>
                        {ov.firstStopName} ({ov.firstStopTime}) &rarr; {ov.lastStopName} ({ov.lastStopTime})
                      </span>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        Valid: {new Date(ov.effectiveFrom).toLocaleDateString()} to {new Date(ov.effectiveTo).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeactivateOverride(ov.id)}
                      className="button button-danger"
                      style={{ fontSize: 11, padding: '5px 10px' }}
                    >
                      Revert to Regular
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Creation Form & Preview */}
          {isCreatingOverride ? (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  Configure Event Schedule for Route {selectedRoute?.routeNo}
                </h3>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setIsCreatingOverride(false)}
                >
                  ✕ Cancel
                </button>
              </div>

              {/* Form Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 18 }}>
                <Field label="Event / Shift Name">
                  <input
                    value={overrideName}
                    onChange={(e) => setOverrideName(e.target.value)}
                    placeholder="e.g. Annual Fest Day 1 Evening"
                    required
                  />
                </Field>

                <Field label="Duration to Apply">
                  <select
                    value={durationOption}
                    onChange={(e) => setDurationOption(e.target.value)}
                  >
                    <option value="1">Today only (1 day)</option>
                    <option value="2">2 Days</option>
                    <option value="3">3 Days</option>
                    <option value="7">1 Week (7 Days)</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </Field>

                {durationOption === 'custom' && (
                  <>
                    <Field label="Start Date">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                    </Field>
                    <Field label="End Date">
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                      />
                    </Field>
                  </>
                )}

                <Field
                  label={`First Stop (${shiftedStops[0]?.name || 'Origin'}) Time`}
                  hint={`Normal: ${baseFirstStopTime} · Shift: ${formatMinutesDifference(deltaMinutes)}`}
                >
                  <input
                    type="time"
                    value={newFirstStopTime}
                    onChange={(e) => handleFirstStopTimeChange(e.target.value)}
                    required
                    style={{ fontWeight: 800, color: '#EA580C' }}
                  />
                </Field>
              </div>

              {/* Shift Delta Callout */}
              <div
                style={{
                  background: 'rgba(234, 88, 12, 0.08)',
                  border: '1px solid rgba(234, 88, 12, 0.3)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 20 }}>⚡</span>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <strong>Dynamic Time Shift in Effect:</strong> Regular start {baseFirstStopTime} &rarr; Event start {newFirstStopTime} (<strong>{formatMinutesDifference(deltaMinutes)}</strong>). All {shiftedStops.length} stops have shifted dynamically by their exact interval!
                </div>
              </div>

              {/* Split Map & Timetable Layout */}
              <div className="map-split-container">
                {/* Map Preview */}
                <div className="panel map-viewport-panel">
                  <MapContainer center={overrideMapCenter} zoom={12} style={{ width: '100%', height: '100%' }}>
                    <ResizeMapHandler />
                    <TileLayer
                      url={MAP_LAYERS[activeLayer].url}
                      subdomains={MAP_LAYERS[activeLayer].subdomains}
                      attribution={MAP_LAYERS[activeLayer].attribution}
                      maxZoom={20}
                    />
                    {overridePolyline.length > 0 && (
                      <Polyline positions={overridePolyline} pathOptions={{ color: '#EA580C', weight: 4, opacity: 0.85 }} />
                    )}
                    {shiftedStops.map((stop, idx) => (
                      <Marker
                        key={stop.stopId || idx}
                        position={[stop.latitude, stop.longitude]}
                        icon={createNumberedPin(idx + 1, stop.isEndpoint ? '#10B981' : '#EA580C', stop.isEndpoint)}
                      >
                        <Popup>
                          <strong>{stop.name}</strong>
                          <br />
                          <span>Event Time: <strong>{stop.scheduledTime}</strong></span>
                          <br />
                          <small style={{ color: '#64748b' }}>Normal: {stop.originalTime}</small>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>

                {/* Shifted Stops List */}
                <div className="panel map-controls-panel" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
                      Adjusted Stops Timetable ({shiftedStops.length})
                    </h4>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {shiftedStops.map((stop, idx) => (
                      <div
                        key={stop.stopId || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: 'var(--surface-hover)',
                          border: '1px solid var(--line)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: stop.isEndpoint ? '#10B981' : '#EA580C',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {stop.isEndpoint ? '★' : idx + 1}
                          </div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {stop.name}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                              Regular: {stop.originalTime}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <input
                            type="time"
                            value={stop.scheduledTime}
                            onChange={(e) => handleIndividualStopTimeChange(idx, e.target.value)}
                            style={{
                              padding: '4px 6px',
                              borderRadius: 6,
                              border: '1px solid var(--line)',
                              background: 'var(--canvas)',
                              color: 'var(--ink)',
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ flex: 1 }}
                      onClick={() => setIsCreatingOverride(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="button button-primary"
                      style={{ flex: 2 }}
                      disabled={saving || shiftedStops.length < 2}
                      onClick={handlePublishOverride}
                    >
                      {saving ? 'Publishing…' : '🚀 Publish Event Override'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Selected Route Info Card */
            <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🚌</div>
              <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>
                {selectedRoute ? `Route ${selectedRoute.routeNo} — ${selectedRoute.name}` : 'Select a Route'}
              </h3>
              <p style={{ margin: '0 auto 18px', maxWidth: 600, color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
                {baseSchedule?.stops && baseSchedule.stops.length > 0
                  ? `Base schedule contains ${baseSchedule.stops.length} stops from ${baseSchedule.stops[0].scheduledTime} to ${baseSchedule.stops[baseSchedule.stops.length - 1].scheduledTime}. You can create a temporary event shift with 1 click.`
                  : 'No active schedule is published for this route yet. Build one in the Visual Schedule Builder tab.'}
              </p>
              {baseSchedule?.stops && baseSchedule.stops.length > 0 && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleStartCreateOverride}
                >
                  ⚡ Configure Event Schedule Override
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
