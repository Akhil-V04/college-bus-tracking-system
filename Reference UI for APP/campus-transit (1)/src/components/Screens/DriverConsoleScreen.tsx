import React, { useState } from 'react';
import { ScreenId } from '../../types';

interface DriverConsoleScreenProps {
  onBack: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export const DriverConsoleScreen: React.FC<DriverConsoleScreenProps> = ({ onBack, onNavigate }) => {
  const [currentSpeed, setCurrentSpeed] = useState(38);
  const [occupancy, setOccupancy] = useState(34);
  const [currentStopIndex, setCurrentStopIndex] = useState(1);
  const [driverStatus, setDriverStatus] = useState<'on-route' | 'stopped' | 'break'>('on-route');

  const stops = [
    'AFZALGANJ CENTRAL',
    'LALAPET twd Moula Ali',
    'INDUSTRIAL ESTATE',
    'ZTS X ROAD',
    'ECIL TERMINAL'
  ];

  const handleNextStop = () => {
    if (currentStopIndex < stops.length - 1) {
      setCurrentStopIndex(prev => prev + 1);
    } else {
      alert('Trip completed! Route RT03 has reached final campus terminus.');
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 min-h-full h-full flex flex-col antialiased select-none overflow-y-auto">
      {/* Header */}
      <header className="bg-[#EA580C] text-white pt-10 pb-4 px-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 -ml-1 text-white hover:opacity-80 active:opacity-60 cursor-pointer"
          >
            <svg className="w-6 h-6 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-xl font-medium tracking-wide">Driver Cockpit HUD</h1>
        </div>
        <span className="text-xs font-mono bg-black/30 px-2.5 py-1 rounded-full text-emerald-300 flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>GPS LIVE</span>
        </span>
      </header>

      {/* Main Cockpit Display */}
      <main className="flex-1 p-4 space-y-4 max-w-md mx-auto w-full">
        {/* Driver identity */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-white">Mr. P. SATAIAH</h2>
            <p className="text-xs text-slate-400">Badge: DRV-4412 • Depot: Mushirabad-II</p>
            <p className="text-xs text-orange-400 font-semibold mt-0.5">Route RT03 • Bus AP23Z0073</p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
              {driverStatus}
            </span>
          </div>
        </div>

        {/* Speed & Occupancy Cockpit Gauges */}
        <div className="grid grid-cols-2 gap-3">
          {/* Speedometer */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
            <span className="text-xs text-slate-400 font-medium">Telemetry Speed</span>
            <div className="text-4xl font-black text-white font-mono my-1 tracking-tight">
              {currentSpeed}
              <span className="text-xs font-normal text-slate-400 ml-1">km/h</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded">
              Limit: 40 km/h (Safe)
            </span>
          </div>

          {/* Passenger Count */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
            <span className="text-xs text-slate-400 font-medium">On-board Load</span>
            <div className="text-4xl font-black text-white font-mono my-1 tracking-tight">
              {occupancy}
              <span className="text-xs font-normal text-slate-400 ml-1">/ 42</span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-[#EA580C] h-full rounded-full"
                style={{ width: `${(occupancy / 42) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Active Flag Alert Notification */}
        <div className="p-3.5 rounded-xl bg-orange-950/80 border border-orange-600/70 text-orange-200 text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">🚩</span>
            <div>
              <p className="font-bold text-white">Passenger Flag Alert!</p>
              <p className="text-[11px] text-orange-300">1 Student waiting at Lalapet Stage 2 (Night Beacon Active)</p>
            </div>
          </div>
          <button
            onClick={() => alert('Flag signal acknowledged by driver')}
            className="px-2.5 py-1 bg-[#EA580C] text-white font-bold rounded text-[11px] shrink-0"
          >
            ACK
          </button>
        </div>

        {/* Stop Progression */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-400 block mb-1">Target Stop</span>
          <h3 className="text-lg font-bold text-white uppercase">{stops[currentStopIndex]}</h3>
          <p className="text-xs text-slate-400 mt-1">Next: {stops[currentStopIndex + 1] || 'End of Line'}</p>

          <div className="mt-4 pt-3 border-t border-slate-700 flex space-x-2">
            <button
              onClick={handleNextStop}
              className="flex-1 py-3 rounded-xl bg-[#EA580C] hover:bg-orange-600 active:scale-98 text-white font-bold text-xs tracking-wider uppercase transition shadow cursor-pointer"
            >
              Mark Arrived &amp; Proceed
            </button>
          </div>
        </div>

        {/* Safety & SOS */}
        <div className="flex space-x-3 pt-2">
          <button
            onClick={() => onNavigate('emergency-hub')}
            className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs flex items-center justify-center space-x-1.5"
          >
            <span>🚨</span>
            <span>Driver SOS</span>
          </button>
          <button
            onClick={() => alert('Depot line 040-23450033 connected')}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5"
          >
            <span>📞</span>
            <span>Call Depot</span>
          </button>
        </div>
      </main>

      <footer className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between">
        <button
          onClick={() => onNavigate('role-selection')}
          className="w-full py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 text-center"
        >
          Exit Driver Mode
        </button>
      </footer>
    </div>
  );
};
