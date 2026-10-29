import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';

import api, { errorMessage } from '../api';
import { LoadingState, Notice, PageHeader } from '../components';
import { decodePolyline } from '../lib/polyline';

// Custom Map Controller to allow flying/zooming programmatically
function MapController({ center, zoom, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2 && Number.isFinite(center[0])) {
      map.flyTo(center, zoom || 14, { duration: 1.2 });
    } else if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [center, zoom, bounds, map]);
  return null;
}

// Stop pin custom marker
function createStopPin(sequenceOrder, isPassed, isCurrent) {
  const color = isCurrent ? '#EA580C' : isPassed ? '#10B981' : '#64748B';
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
        <div style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-weight:800;font-size:11px;">
          ${sequenceOrder}
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// Live Bus Pin custom marker with animated radar halo
function createLiveBusPin(routeNo, speedKmh) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(234, 88, 12, 0.35);animation:busRadarPulse 2s infinite ease-out;"></div>
        <div style="width:40px;height:40px;border-radius:50%;background:#EA580C;border:3px solid #FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(234, 88, 12, 0.7);z-index:2;">
          <span style="font-size:20px;">🚌</span>
        </div>
        ${
          speedKmh != null
            ? `<div style="position:absolute;bottom:-6px;background:#0F172A;color:#FFFFFF;border:1px solid #EA580C;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:800;white-space:nowrap;z-index:3;box-shadow:0 2px 4px rgba(0,0,0,0.4);">${speedKmh} km/h</div>`
            : ''
        }
      </div>
    `,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
    popupAnchor: [0, -26],
  });
}

export default function LiveTrackingScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoute = searchParams.get('route') || '';

  const [allRoutes, setAllRoutes] = useState([]);
  const [activeTrips, setActiveTrips] = useState([]);
  const [selectedRouteNo, setSelectedRouteNo] = useState(initialRoute);
  const [direction, setDirection] = useState('MORNING');
  const [routeDetail, setRouteDetail] = useState(null);
  const [liveLocation, setLiveLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [mapTarget, setMapTarget] = useState(null); // [lat, lng] or null

  const socketRef = useRef(null);

  // Inject keyframe animation for radar pulse
  useEffect(() => {
    const styleId = 'bus-radar-animation';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @keyframes busRadarPulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Fetch list of all routes and active running trips
  const fetchFleetStatus = async () => {
    try {
      const [routesRes, activeTripsRes] = await Promise.all([
        api.get('/passenger/routes'),
        api.get('/trips/active').catch(() => ({ data: [] })),
      ]);

      const routes = Array.isArray(routesRes.data) ? routesRes.data : routesRes.data?.items || [];
      const running = Array.isArray(activeTripsRes.data) ? activeTripsRes.data : [];

      setAllRoutes(routes);
      setActiveTrips(running);

      // Auto-select route if not selected
      if (!selectedRouteNo && routes.length > 0) {
        // Prefer first active route
        const activeRoute = routes.find((r) => r.hasActiveTrip || running.some((t) => t.route?.routeNo === r.routeNo));
        const chosen = activeRoute ? activeRoute.routeNo : routes[0].routeNo;
        setSelectedRouteNo(chosen);
        setSearchParams({ route: chosen });
      }
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'Could not load route services.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleetStatus();
    const timer = setInterval(fetchFleetStatus, 20_000);
    return () => clearInterval(timer);
  }, []);

  // Fetch detail for the selected route
  const fetchRouteDetail = async (routeNo, dir) => {
    if (!routeNo) return;
    try {
      const res = await api.get(`/passenger/routes/${encodeURIComponent(routeNo)}?direction=${dir}`);
      setRouteDetail(res.data);

      if (res.data?.activeTrip?.latitude != null && res.data?.activeTrip?.longitude != null) {
        setLiveLocation({
          latitude: res.data.activeTrip.latitude,
          longitude: res.data.activeTrip.longitude,
          speedKmh: res.data.activeTrip.speedKmh,
          currentStopIndex: res.data.activeTrip.currentStopIndex,
          timestamp: res.data.activeTrip.lastLocationAt,
        });
      } else {
        setLiveLocation(null);
      }
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, `Could not load details for Route ${routeNo}.`) });
    }
  };

  useEffect(() => {
    if (selectedRouteNo) {
      fetchRouteDetail(selectedRouteNo, direction);
      setSearchParams({ route: selectedRouteNo });
    }
  }, [selectedRouteNo, direction]);

  // Connect Socket.IO for real-time live location updates of the selected route
  useEffect(() => {
    if (!routeDetail?.id) return;
    const socket = io(window.location.origin, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:trip', { tripId: routeDetail.activeTrip?.id });
    });

    socket.on('bus:update', (update) => {
      if (update.routeServiceId === routeDetail.id || update.tripId === routeDetail.activeTrip?.id) {
        setLiveLocation({
          latitude: update.latitude,
          longitude: update.longitude,
          speedKmh: update.deviceSpeedKmh,
          currentStopIndex: update.currentStopIndex,
          timestamp: update.timestamp,
        });
      }
    });

    socket.on('trip:ended', (payload) => {
      if (payload.tripId === routeDetail.activeTrip?.id) {
        setLiveLocation(null);
        fetchRouteDetail(selectedRouteNo, direction);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [routeDetail?.id, routeDetail?.activeTrip?.id]);

  // Stops list
  const stops = useMemo(() => routeDetail?.schedule?.stops || [], [routeDetail?.schedule?.stops]);

  // Polyline points decoded for Leaflet: array of [lat, lng]
  const polylinePoints = useMemo(() => {
    if (!routeDetail?.schedule) return [];
    if (routeDetail.schedule.geometryPolyline) {
      const decoded = decodePolyline(routeDetail.schedule.geometryPolyline);
      if (decoded.length > 0) return decoded;
    }
    return stops.map((s) => [s.stop.latitude, s.stop.longitude]);
  }, [routeDetail?.schedule, stops]);

  // Map bounding box
  const mapBounds = useMemo(() => {
    if (polylinePoints.length > 0) return polylinePoints;
    if (stops.length > 0) return stops.map((s) => [s.stop.latitude, s.stop.longitude]);
    return [
      [17.4334, 78.6837],
      [17.4705, 78.7255],
    ];
  }, [polylinePoints, stops]);

  const isLive = Boolean(routeDetail?.activeTrip && liveLocation);
  const currentStopIndex = liveLocation?.currentStopIndex ?? routeDetail?.activeTrip?.currentStopIndex ?? 0;

  const handleSelectRoute = (routeNo) => {
    setSelectedRouteNo(routeNo);
    setLiveLocation(null);
    setMapTarget(null);
  };

  const centerOnBus = () => {
    if (liveLocation?.latitude != null && liveLocation?.longitude != null) {
      setMapTarget([liveLocation.latitude, liveLocation.longitude]);
    }
  };

  const focusOnStop = (stop) => {
    setMapTarget([stop.latitude, stop.longitude]);
  };

  return (
    <>
      <PageHeader
        eyebrow="Fleet Telemetry"
        title="Live Route Bus Tracking"
        description="Select any individual campus bus route to view its exact live location, speed, current stop progression, and schedule timeline."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isLive && (
              <button
                type="button"
                onClick={centerOnBus}
                className="button button-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>🎯</span> Center on Bus
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                fetchFleetStatus();
                if (selectedRouteNo) fetchRouteDetail(selectedRouteNo, direction);
              }}
              className="button button-secondary"
            >
              ↻ Refresh
            </button>
          </div>
        }
      />

      <Notice message={message} onDismiss={() => setMessage(null)} />

      {loading ? (
        <LoadingState label="Loading fleet routes and live positions…" />
      ) : (
        <>
          {/* ─── Route Selection & Control Bar ─── */}
          <div
            className="panel"
            style={{
              padding: '14px 20px',
              marginBottom: 18,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <label htmlFor="routeSelect" style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                SELECT ROUTE TO TRACK:
              </label>
              <select
                id="routeSelect"
                value={selectedRouteNo}
                onChange={(e) => handleSelectRoute(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  border: '1.5px solid var(--color-accent, #EA580C)',
                  minWidth: 260,
                  cursor: 'pointer',
                }}
              >
                {allRoutes.map((r) => {
                  const hasActive = activeTrips.some((t) => t.route?.routeNo === r.routeNo) || r.hasActiveTrip;
                  return (
                    <option key={r.id || r.routeNo} value={r.routeNo}>
                      Route {r.routeNo} – {r.name} {hasActive ? '🟢 [LIVE IN SERVICE]' : '⚪ [OFF TRIP]'}
                    </option>
                  );
                })}
              </select>

              {/* Direction Selector */}
              <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setDirection('MORNING')}
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: direction === 'MORNING' ? '#EA580C' : 'transparent',
                    color: direction === 'MORNING' ? '#FFFFFF' : 'var(--color-text-secondary)',
                  }}
                >
                  🌅 Morning Inbound
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('EVENING')}
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: direction === 'EVENING' ? '#EA580C' : 'transparent',
                    color: direction === 'EVENING' ? '#FFFFFF' : 'var(--color-text-secondary)',
                  }}
                >
                  🌆 Evening Return
                </button>
              </div>
            </div>

            {/* Current Route Status Pill */}
            <div>
              {isLive ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    borderRadius: 20,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid #10B981',
                    color: '#10B981',
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981' }} />
                  LIVE ON ROUTE {routeDetail?.routeNo}
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    borderRadius: 20,
                    backgroundColor: 'rgba(100, 116, 139, 0.15)',
                    border: '1px solid #64748B',
                    color: '#94A3B8',
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#64748B' }} />
                  ROUTE {selectedRouteNo} IS OFF-TRIP
                </div>
              )}
            </div>
          </div>

          {/* ─── Main Map & Telemetry Dashboard Grid ─── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1fr)',
              gap: 18,
              minHeight: 560,
            }}
          >
            {/* Map Column */}
            <div
              className="panel"
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 12,
                minHeight: 560,
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <MapContainer
                bounds={mapBounds}
                style={{ width: '100%', height: '100%', minHeight: 560 }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapController center={mapTarget} zoom={15} bounds={mapTarget ? null : mapBounds} />

                {/* Route Polyline */}
                {polylinePoints.length > 0 && (
                  <Polyline
                    positions={polylinePoints}
                    color="#EA580C"
                    weight={5}
                    opacity={0.85}
                  />
                )}

                {/* Stops Markers */}
                {stops.map((entry) => {
                  const isPassed = currentStopIndex > entry.sequenceOrder;
                  const isCurrent = currentStopIndex === entry.sequenceOrder && currentStopIndex > 0;

                  return (
                    <Marker
                      key={`admin-stop-${entry.stop.id}-${entry.sequenceOrder}`}
                      position={[entry.stop.latitude, entry.stop.longitude]}
                      icon={createStopPin(entry.sequenceOrder, isPassed, isCurrent)}
                    >
                      <Popup>
                        <div style={{ fontSize: 13 }}>
                          <strong>Stop {entry.sequenceOrder}: {entry.stop.name}</strong>
                          <div style={{ color: '#64748B', marginTop: 4 }}>
                            Scheduled Time: <strong>{entry.scheduledTime}</strong>
                          </div>
                          <div style={{ marginTop: 4 }}>
                            Status:{' '}
                            <strong style={{ color: isPassed ? '#10B981' : isCurrent ? '#EA580C' : '#64748B' }}>
                              {isPassed ? 'Bus Left' : isCurrent ? 'At Stop' : 'Upcoming'}
                            </strong>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Live Bus Marker */}
                {isLive && liveLocation?.latitude != null && (
                  <Marker
                    position={[liveLocation.latitude, liveLocation.longitude]}
                    icon={createLiveBusPin(routeDetail.routeNo, liveLocation.speedKmh)}
                  >
                    <Popup>
                      <div style={{ fontSize: 13, minWidth: 160 }}>
                        <div style={{ fontWeight: 800, color: '#EA580C', fontSize: 14 }}>
                          🚌 Route {routeDetail.routeNo} Live Bus
                        </div>
                        <div style={{ marginTop: 4 }}>
                          Driver: <strong>{routeDetail.driver?.name || 'Assigned Driver'}</strong>
                        </div>
                        {liveLocation.speedKmh != null && (
                          <div style={{ marginTop: 2 }}>
                            Speed: <strong>{liveLocation.speedKmh} km/h</strong>
                          </div>
                        )}
                        <div style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>
                          Last update: {new Date(liveLocation.timestamp || Date.now()).toLocaleTimeString()}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>

              {/* Live Overlay Pill inside Map */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  zIndex: 1000,
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  color: '#FFFFFF',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  pointerEvents: 'none',
                }}
              >
                {isLive ? `⚡ Live GPS: Lat ${liveLocation.latitude.toFixed(4)}, Lng ${liveLocation.longitude.toFixed(4)}` : `⚪ Route ${selectedRouteNo} Off-Trip`}
              </div>
            </div>

            {/* Right Telemetry & Stop Timeline Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Telemetry Card */}
              <div className="panel" style={{ padding: 18, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#EA580C', textTransform: 'uppercase' }}>
                      Route Service Telemetry
                    </span>
                    <h3 style={{ margin: '4px 0 2px 0', fontSize: 18, fontWeight: 800 }}>
                      Route {routeDetail?.routeNo} – {routeDetail?.name}
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {routeDetail?.areaCovered}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>ASSIGNED DRIVER</div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{routeDetail?.driver?.name || 'None Assigned'}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>BUS CAPACITY</div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{routeDetail?.capacity || 52} seats</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>TRIP PROGRESS</div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2, color: isLive ? '#EA580C' : 'inherit' }}>
                      {isLive ? `${currentStopIndex} of ${stops.length} stops reached` : 'Not Started'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>CURRENT SPEED</div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                      {isLive && liveLocation?.speedKmh != null ? `${liveLocation.speedKmh} km/h` : '0 km/h (Stationary)'}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {stops.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(100, 116, 139, 0.2)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (currentStopIndex / (stops.length || 1)) * 100)}%`,
                          backgroundColor: '#EA580C',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Stop-by-Stop Timeline */}
              <div className="panel" style={{ padding: 18, flex: 1, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Stop Schedule Timeline</h4>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    {stops.length} Stops Total
                  </span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 360, paddingRight: 6 }}>
                  {stops.map((entry, idx) => {
                    const isPassed = currentStopIndex > entry.sequenceOrder;
                    const isCurrent = currentStopIndex === entry.sequenceOrder && currentStopIndex > 0;
                    const isLast = idx === stops.length - 1;

                    return (
                      <div
                        key={entry.stop.id || idx}
                        onClick={() => focusOnStop(entry.stop)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          padding: '6px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          backgroundColor: isCurrent ? 'rgba(234, 88, 12, 0.12)' : 'transparent',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {/* Node column */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, marginRight: 10 }}>
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: isPassed ? '#10B981' : isCurrent ? '#EA580C' : '#64748B',
                              boxShadow: isCurrent ? '0 0 8px #EA580C' : 'none',
                              marginTop: 4,
                            }}
                          />
                          {!isLast && (
                            <div
                              style={{
                                width: 2,
                                height: 26,
                                backgroundColor: isPassed ? '#10B981' : 'var(--color-border)',
                                margin: '2px 0',
                              }}
                            />
                          )}
                        </div>

                        {/* Details */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: isCurrent ? '#EA580C' : 'var(--color-text)' }}>
                            {entry.stop.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                            Scheduled: <strong>{entry.scheduledTime}</strong>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isPassed ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: 4 }}>
                              Passed
                            </span>
                          ) : isCurrent ? (
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#EA580C', background: 'rgba(234, 88, 12, 0.15)', padding: '2px 6px', borderRadius: 4 }}>
                              At Stop
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B', background: 'rgba(100, 116, 139, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                              Upcoming
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
