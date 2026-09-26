import React, { useState } from 'react';
import { ScreenId } from '../../types';

interface FlagBusScreenProps {
  onBack: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export const FlagBusScreen: React.FC<FlagBusScreenProps> = ({ onBack, onNavigate }) => {
  const [flagged, setFlagged] = useState(false);
  const [flashlightActive, setFlashlightActive] = useState(false);
  const [targetStop, setTargetStop] = useState('LALAPET twd Moula Ali');
  const [targetRoute, setTargetRoute] = useState('RT03 (3K) - AP23Z0073');

  const handleToggleFlag = () => {
    setFlagged(prev => !prev);
  };

  return (
    <div className={`min-h-full h-full flex flex-col select-none overflow-y-auto ${flashlightActive ? 'bg-amber-400 text-slate-950' : 'bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100'}`}>
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
          <h1 className="text-xl font-medium tracking-wide">Flag A Bus</h1>
        </div>
        <button
          onClick={() => setFlashlightActive(prev => !prev)}
          className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center space-x-1 cursor-pointer ${
            flashlightActive ? 'bg-black text-amber-300' : 'bg-white/20 text-white'
          }`}
        >
          <span>🔦</span>
          <span>{flashlightActive ? 'Beacon ON' : 'Night Beacon'}</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-5 space-y-5 max-w-md mx-auto w-full">
        {/* Info card */}
        <div className="p-4 rounded-2xl bg-orange-50 dark:bg-slate-800 border border-orange-100 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#EA580C] text-white flex items-center justify-center font-bold text-lg">
              🚩
            </div>
            <div>
              <h2 className="font-bold text-sm text-gray-900 dark:text-white">Smart Digital Bus Flag</h2>
              <p className="text-xs text-gray-500">Alerts the oncoming driver cockpit HUD to halt at your stop.</p>
            </div>
          </div>
        </div>

        {/* Station and Route Selectors */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Your Waiting Stage</label>
            <select
              value={targetStop}
              onChange={e => setTargetStop(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="LALAPET twd Moula Ali">LALAPET twd Moula Ali</option>
              <option value="INDUSTRIAL Estate twd Kushaiguda">INDUSTRIAL Estate</option>
              <option value="CBS (Central Bus Station)">CBS</option>
              <option value="ECIL Terminal">ECIL Terminal</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Target Bus Line</label>
            <select
              value={targetRoute}
              onChange={e => setTargetRoute(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="RT03 (3K) - AP23Z0073">RT03 (3K) - AP23Z0073 (In Transit)</option>
              <option value="RT03 (3K) - TS08Z0239">RT03 (3K) - TS08Z0239 (In Transit)</option>
              <option value="100B - Campus Express">100B - Campus Express</option>
            </select>
          </div>
        </div>

        {/* Live Distance Status */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
          <div>
            <span className="text-gray-400 block">Approaching Distance</span>
            <span className="font-bold text-sm text-gray-800 dark:text-slate-100">420 meters away</span>
          </div>
          <div className="text-right">
            <span className="text-gray-400 block">Estimated Time</span>
            <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">~2 Minutes</span>
          </div>
        </div>

        {/* Flag Action Button with Pulsing Signal */}
        <div className="pt-2 flex flex-col items-center">
          <button
            onClick={handleToggleFlag}
            className={`w-36 h-36 rounded-full flex flex-col items-center justify-center font-bold text-center p-3 shadow-xl transition-all cursor-pointer ${
              flagged
                ? 'bg-emerald-600 text-white ring-8 ring-emerald-200 animate-pulse'
                : 'bg-[#EA580C] text-white hover:bg-orange-600 active:scale-95 ring-8 ring-orange-100 dark:ring-orange-950'
            }`}
          >
            <span className="text-3xl mb-1">{flagged ? '✓' : '🚩'}</span>
            <span className="text-xs uppercase tracking-wide leading-tight">
              {flagged ? 'Flag Broadcasted' : 'Tap To Flag Bus'}
            </span>
          </button>
          <p className="text-[11px] text-gray-400 mt-4 text-center max-w-xs">
            {flagged
              ? 'Driver HUD has received your pickup ping. The vehicle will pull into the curb.'
              : 'Tap to transmit a high-priority halt signal to the oncoming driver console.'}
          </p>
        </div>

        {/* Driver Acknowledgment Box */}
        {flagged && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              🚌
            </div>
            <div>
              <p className="font-bold">Driver Acknowledged!</p>
              <p className="text-[11px] opacity-90">Mr. P. SATAIAH has turned on the curb indicator light.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex justify-between">
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-full py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-semibold text-center"
        >
          Return to Dashboard
        </button>
      </footer>
    </div>
  );
};
