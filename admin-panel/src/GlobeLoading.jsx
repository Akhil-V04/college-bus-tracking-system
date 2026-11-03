import React from 'react';
import './GlobeLoading.css';

export function GlobeLoading({ label = 'Loading...', size = 'medium', fullScreen = false }) {
  return (
    <div className={`cw-globe-loading-wrapper ${fullScreen ? 'cw-fullscreen' : ''} cw-size-${size}`}>
      <div className="cw-stage">
        {/* Soft Atmosphere Glow */}
        <div className="cw-atmosphere" />

        {/* Floating Clouds */}
        <div className="cw-cloud cw-cloud-1" />
        <div className="cw-cloud cw-cloud-2" />

        {/* Rotating Globe (Rotates Clockwise) */}
        <div className="cw-globe">
          <div className="cw-land cw-land-1" />
          <div className="cw-land cw-land-2" />
          <div className="cw-land cw-land-3" />
          <div className="cw-land cw-land-4" />
          <div className="cw-grid-lat" />
          <div className="cw-grid-lon" />
        </div>

        {/* Rotating Circular Road with Dashed Lane Markings (Rotates Clockwise) */}
        <div className="cw-road-ring">
          <div className="cw-road-dashes" />
        </div>

        {/* Bus Perched at 12 o'clock, Facing Right with Road Suspension Bounce */}
        <div className="cw-bus-anchor">
          {/* Headlight Cone */}
          <div className="cw-headlight-cone" />

          {/* Bus Structure */}
          <div className="cw-bus">
            <div className="cw-bus-roof" />
            <div className="cw-bus-chassis">
              <div className="cw-dest-sign">
                <span className="cw-led" />
              </div>
              <div className="cw-windows">
                <div className="cw-win" />
                <div className="cw-win" />
                <div className="cw-win" />
                <div className="cw-windshield" />
              </div>
              <div className="cw-stripe" />
              <div className="cw-headlight" />
            </div>
            <div className="cw-wheels">
              <div className="cw-wheel"><div className="cw-wheel-hub" /></div>
              <div className="cw-wheel"><div className="cw-wheel-hub" /></div>
            </div>
            <div className="cw-exhaust" />
          </div>
        </div>
      </div>

      {label && <p className="cw-loading-label">{label}</p>}
    </div>
  );
}

