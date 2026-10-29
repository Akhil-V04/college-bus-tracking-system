import { useState } from 'react';
import './HeroLandingPage.css';

const COLLEGE_ROUTES = [
  { id: '01', name: 'Route 01 — B.N. Reddy to VBIT Campus', origin: 'B.N. Reddy', start: '07:40 AM' },
  { id: '02', name: 'Route 02 — Amberpet to VBIT Campus', origin: 'Amberpet', start: '07:45 AM' },
  { id: '03', name: 'Route 03 — Chikkadapally to VBIT Campus', origin: 'Chikkadapally', start: '07:45 AM' },
  { id: '04', name: 'Route 04 — Darushifa to VBIT Campus', origin: 'Darushifa', start: '07:40 AM' },
  { id: '05', name: 'Route 05 — Chintal to VBIT Campus', origin: 'Chintal', start: '07:35 AM' },
  { id: '06', name: 'Route 06 — JNTUH to VBIT Campus', origin: 'JNTUH', start: '07:30 AM' },
  { id: '07', name: 'Route 07 — Moosapet to VBIT Campus', origin: 'Moosapet', start: '07:35 AM' },
  { id: '08', name: 'Route 08 — Lalapet to VBIT Campus', origin: 'Lalapet', start: '07:55 AM' },
  { id: '09', name: 'Route 09 — Gandhi Hospital to VBIT Campus', origin: 'Gandhi Hospital', start: '07:50 AM' },
  { id: '10', name: 'Route 10 — Attapur Pillar No. 144 to VBIT Campus', origin: 'Attapur', start: '07:30 AM' },
  { id: '11', name: 'Route 11 — Lalaguda Bridge to VBIT Campus', origin: 'Lalaguda', start: '07:55 AM' },
  { id: '12', name: 'Route 12 — Bairamalguda to VBIT Campus', origin: 'Bairamalguda', start: '07:45 AM' },
  { id: '13', name: 'Route 13 — Alwal near Loyola to VBIT Campus', origin: 'Alwal', start: '07:35 AM' },
  { id: '14', name: 'Route 14 — Yamzal to VBIT Campus', origin: 'Yamzal', start: '07:35 AM' },
  { id: '15', name: 'Route 15 — Badangpet to VBIT Campus', origin: 'Badangpet', start: '07:35 AM' },
  { id: '16', name: 'Route 16 — Kushaiguda (D-Mart) to VBIT Campus', origin: 'Kushaiguda', start: '08:05 AM' },
  { id: '17', name: 'Route 17 — Mandamallamma to VBIT Campus', origin: 'Mandamallamma', start: '07:40 AM' },
  { id: '18', name: 'Route 18 — Boduppal to VBIT Campus', origin: 'Boduppal', start: '08:10 AM' },
  { id: '19', name: 'Route 19 — Sagar X Road to VBIT Campus', origin: 'Sagar X Road', start: '07:45 AM' },
  { id: '20', name: 'Route 20 — Mallikarjuna Kaman to VBIT Campus', origin: 'Mallikarjuna Kaman', start: '07:50 AM' },
  { id: '21', name: 'Route 21 — Vidya Nagar to VBIT Campus', origin: 'Vidya Nagar', start: '07:50 AM' },
  { id: '22', name: 'Route 22 — Malkajgiri Police Station to VBIT Campus', origin: 'Malkajgiri', start: '07:50 AM' },
  { id: '23', name: 'Route 23 — Sunny Bakery to VBIT Campus', origin: 'Sunny Bakery', start: '07:55 AM' },
  { id: '24', name: 'Route 24 — Kushaiguda Pochamma to VBIT Campus', origin: 'Kushaiguda', start: '08:05 AM' },
  { id: '25', name: 'Route 25 — B.N. Reddy to VBIT Campus', origin: 'B.N. Reddy', start: '07:40 AM' },
  { id: '26', name: 'Route 26 — Ali Cafe to VBIT Campus', origin: 'Ali Cafe', start: '07:45 AM' },
  { id: '27', name: 'Route 27 — Balaji Nagar to VBIT Campus', origin: 'Balaji Nagar', start: '07:50 AM' },
  { id: '28', name: 'Route 28 — Habsiguda X Road to VBIT Campus', origin: 'Habsiguda', start: '08:00 AM' },
  { id: '29', name: 'Route 29 — Saroornagar to VBIT Campus', origin: 'Saroornagar', start: '07:40 AM' },
  { id: '31', name: 'Route 31 — Gandhinagar to VBIT Campus', origin: 'Gandhinagar', start: '07:45 AM' },
];

function generateRouteStops(startTimeStr, routeOrigin) {
  const [timePart, modifier] = startTimeStr.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);
  if (hours === 12 && modifier === 'AM') hours = 0;
  let startMins = hours * 60 + minutes;
  const endMins = 9 * 60 + 25; // 09:25 AM arrival at VBIT Campus
  const step = Math.round((endMins - startMins) / 5);

  function fmt(totalMins) {
    let h = Math.floor(totalMins / 60);
    let m = totalMins % 60;
    let p = 'AM';
    if (h >= 12) {
      p = 'PM';
      if (h > 12) h -= 12;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
  }

  return [
    { name: `${routeOrigin} (Starting Point)`, time: fmt(startMins) },
    { name: 'Major Junction / Hub Stop', time: fmt(startMins + step) },
    { name: 'Transit Center Interchange', time: fmt(startMins + step * 2) },
    { name: 'Ring Road Highway Point', time: fmt(startMins + step * 3) },
    { name: 'Ghatkesar Approach Stop', time: fmt(startMins + step * 4) },
    { name: 'VBIT Campus (Arrival)', time: '09:25 AM', isDestination: true },
  ];
}

export default function HeroLandingPage() {
  const [selectedRouteId, setSelectedRouteId] = useState('08');
  const [downloadToast, setDownloadToast] = useState(false);

  const currentRoute = COLLEGE_ROUTES.find((r) => r.id === selectedRouteId) || COLLEGE_ROUTES[0];
  const stops = generateRouteStops(currentRoute.start, currentRoute.origin);

  const handleDownloadClick = () => {
    setDownloadToast(true);
    // Trigger direct instant APK download from public bundle
    const link = document.createElement('a');
    link.href = '/campus-transit.apk';
    link.download = 'campus-transit-vbit.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadToast(false), 5000);
  };

  const scrollToTimetable = () => {
    document.getElementById('routes-showcase')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="hl-root">
      <div className="hl-glow-1" />
      <div className="hl-glow-2" />

      <div className="hl-container">
        {/* Navbar */}
        <header className="hl-header">
          <div className="hl-brand">
            <div className="hl-brand-icon">🚌</div>
            <div className="hl-brand-text">
              <h1>Campus Transit</h1>
              <p>Vignana Bharathi Institute of Technology</p>
            </div>
          </div>
          <div className="hl-status-badge">
            <span className="hl-pulse-dot" />
            <span>Transit Fleet Active</span>
          </div>
        </header>

        {/* Hero Section */}
        <section className="hl-hero">
          <div className="hl-hero-content">
            <div className="hl-route-pill">
              <span>🎓</span> Official College Transit App
            </div>
            <h2 className="hl-hero-title">
              Real-Time <span>Campus Bus Tracking</span> for Students & Faculty
            </h2>
            <p className="hl-hero-desc">
              Track your college bus live with real-time GPS, morning & evening return timetables, 
              nearby stop detection, smart arrival reminders, and instant issue reporting.
            </p>

            <div className="hl-stats-ribbon">
              <div className="hl-stat-item">
                <div className="hl-stat-val">25+</div>
                <div className="hl-stat-label">Routes Covered</div>
              </div>
              <div className="hl-stat-item">
                <div className="hl-stat-val">50+</div>
                <div className="hl-stat-label">Campus Fleet</div>
              </div>
              <div className="hl-stat-item">
                <div className="hl-stat-val">09:25 <span>AM</span></div>
                <div className="hl-stat-label">Campus Arrival</div>
              </div>
              <div className="hl-stat-item">
                <div className="hl-stat-val">100%</div>
                <div className="hl-stat-label">Free For Students</div>
              </div>
            </div>

            <div className="hl-cta-group">
              <button onClick={handleDownloadClick} className="hl-btn-primary">
                <span>📲</span> Download Android App (APK)
              </button>
              <button onClick={scrollToTimetable} className="hl-btn-secondary">
                <span>🗺️</span> Explore Routes & Timings
              </button>
            </div>

            {downloadToast && (
              <div style={{
                marginTop: '12px',
                padding: '10px 16px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10B981',
                borderRadius: '10px',
                color: '#10B981',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>✓</span> Starting APK download. Check your browser downloads bar!
              </div>
            )}
          </div>

          {/* Interactive Phone Mockup */}
          <div className="hl-mockup-wrapper">
            <div className="hl-phone">
              <div className="hl-phone-notch" />
              <div className="hl-screen">
                <div className="hl-mockup-top">
                  <div>
                    <div className="hl-mockup-title">Route 08 • VBIT</div>
                    <div className="hl-mockup-sub">Lalapet to Campus</div>
                  </div>
                  <div style={{ fontSize: '13px' }}>🔔</div>
                </div>

                <div className="hl-mockup-pills">
                  <div className="hl-mockup-pill active">🌅 Morning (College)</div>
                  <div className="hl-mockup-pill">🌇 Evening (Return)</div>
                </div>

                <div className="hl-mockup-map">
                  {/* Subtle Grid Lines */}
                  <svg width="100%" height="100%" style={{ opacity: 0.15 }}>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#FFFFFF" strokeWidth="0.5" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                  <div className="hl-mockup-bus">🚌</div>
                </div>

                <div className="hl-mockup-timeline">
                  <div style={{
                    width: '30px',
                    height: '3px',
                    backgroundColor: '#475569',
                    borderRadius: '2px',
                    margin: '0 auto 4px'
                  }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#94A3B8', fontWeight: 700 }}>
                    <span>STOPS TIMELINE</span>
                    <span style={{ color: '#EA580C' }}>LIVE ETA</span>
                  </div>
                  <div className="hl-timeline-item">
                    <span className="hl-dot" />
                    <span className="hl-t-name">Lalapet (Origin)</span>
                    <span className="hl-t-time">07:55 AM</span>
                  </div>
                  <div className="hl-timeline-item">
                    <span className="hl-dot" />
                    <span className="hl-t-name">Sainathapuram</span>
                    <span className="hl-t-time">08:25 AM</span>
                  </div>
                  <div className="hl-timeline-item">
                    <span className="hl-dot" />
                    <span className="hl-t-name">Dr. A. S. Rao Nagar</span>
                    <span className="hl-t-time">08:30 AM</span>
                  </div>
                  <div className="hl-timeline-item">
                    <span className="hl-dot" style={{ backgroundColor: '#10B981', boxShadow: '0 0 5px #10B981' }} />
                    <span className="hl-t-name">VBIT Campus</span>
                    <span className="hl-t-time" style={{ color: '#10B981' }}>09:25 AM</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Route Timetable Showcase */}
        <section id="routes-showcase" className="hl-showcase">
          <div className="hl-section-head">
            <h2>Explore College Bus Routes</h2>
            <p>Select any route from the dropdown to view its scheduled morning pickup times and major stops.</p>
          </div>

          <div className="hl-dropdown-box">
            <label htmlFor="routeSelect" className="hl-dropdown-label">
              <span>🚍</span> Select College Bus Route:
            </label>
            <select
              id="routeSelect"
              className="hl-select"
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
            >
              {COLLEGE_ROUTES.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </select>
          </div>

          <div className="hl-preview-card">
            <div className="hl-preview-header">
              <div>
                <div className="hl-preview-title">{currentRoute.name}</div>
                <div style={{ fontSize: '12.5px', color: '#94A3B8', marginTop: '2px' }}>
                  Assigned Fleet • Real-Time GPS Tracking Enabled
                </div>
              </div>
              <div className="hl-preview-badge">
                MORNING DEPARTURE: {currentRoute.start}
              </div>
            </div>

            <div className="hl-stops-grid">
              {stops.map((stop, idx) => (
                <div key={idx} className="hl-stop-pill">
                  <span className="hl-stop-name">{stop.name}</span>
                  <span
                    className="hl-stop-time"
                    style={stop.isDestination ? { color: '#10B981' } : undefined}
                  >
                    {stop.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Key Features Grid */}
        <section className="hl-features">
          <div className="hl-section-head">
            <h2>Built Specifically For College Commuters</h2>
            <p>Everything you need for a punctual, stress-free daily commute to and from campus.</p>
          </div>

          <div className="hl-grid">
            <div className="hl-card">
              <div className="hl-card-icon">🛰️</div>
              <h3>Live GPS Tracking</h3>
              <p>Watch your bus move along its route with real-time speed, live stop markers, and accurate time of arrival (ETA).</p>
            </div>

            <div className="hl-card">
              <div className="hl-card-icon">🌅</div>
              <h3>Morning & Evening Schedules</h3>
              <p>Clear separation between morning pickups to college and evening return trips with verified stop arrival and departure times.</p>
            </div>

            <div className="hl-card">
              <div className="hl-card-icon">📍</div>
              <h3>Bus Stops Near Me</h3>
              <p>Instant location-based stop detection. Finds all official college bus stops near your home and morning routes passing through them.</p>
            </div>

            <div className="hl-card">
              <div className="hl-card-icon">🔔</div>
              <h3>Smart Arrival Alerts</h3>
              <p>Set a custom reminder 1, 2, 5, 10, or 15 minutes before the bus reaches your stop so you never rush or wait in the rain.</p>
            </div>

            <div className="hl-card">
              <div className="hl-card-icon">🛡️</div>
              <h3>Anonymous Issue Reporting</h3>
              <p>Report bus condition, driver behavior, safety, or timing issues directly to the transport department with 100% privacy.</p>
            </div>

            <div className="hl-card">
              <div className="hl-card-icon">🤖</div>
              <h3>AI Transport Assistant</h3>
              <p>Have questions about bus passes, routes, delays, or emergency contacts? Get instant verified answers 24/7.</p>
            </div>
          </div>
        </section>

        {/* Installation Steps */}
        <div className="hl-install-box">
          <div className="hl-install-header">
            <h3>How to install on Android (Direct Download)</h3>
            <p>Follow these 3 simple steps to get the official college transit app on your phone:</p>
          </div>

          <div className="hl-steps-row">
            <div className="hl-step-item">
              <div className="hl-step-num">1</div>
              <h4>Download APK</h4>
              <p>Tap the orange "Download Android App" button above to get the APK installation file.</p>
            </div>

            <div className="hl-step-item">
              <div className="hl-step-num">2</div>
              <h4>Allow Installation</h4>
              <p>When prompted by your browser, tap "Allow from this source" to authorize installation.</p>
            </div>

            <div className="hl-step-item">
              <div className="hl-step-num">3</div>
              <h4>Open & Track</h4>
              <p>Launch Campus Transit on your phone. All 25+ college routes are loaded and ready to track!</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="hl-footer">
          <div className="hl-footer-inner">
            <div className="hl-footer-logo">
              <span>🚌</span>
              <span>Campus Transit</span>
            </div>
            <p className="hl-footer-desc">
              Real-time GPS transit tracking, smart arrival alerts, and timetable navigation for 
              Vignana Bharathi Institute of Technology (VBIT) Transport Department.
            </p>
            <div className="hl-footer-divider" />
            <div className="hl-dev-tag">
              <span className="hl-dev-pulse" />
              <span>Developed by <strong style={{ color: '#EA580C' }}>Akhil Vaddeboina</strong> • <a href="mailto:akhilvaddeboina25@gmail.com" style={{ color: '#EA580C', textDecoration: 'none' }}>akhilvaddeboina25@gmail.com</a></span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
