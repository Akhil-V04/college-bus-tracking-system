import React, { useState } from 'react';
import { ScreenId } from '../../types';

interface BusPassScreenProps {
  onBack: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export const BusPassScreen: React.FC<BusPassScreenProps> = ({ onBack, onNavigate }) => {
  const [scanned, setScanned] = useState(false);
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const handleSimulateScan = () => {
    setScanned(true);
    setTimeout(() => setScanned(false), 3000);
  };

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-900 text-gray-900 dark:text-slate-100 min-h-full h-full flex flex-col antialiased select-none overflow-y-auto">
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
          <h1 className="text-xl font-medium tracking-wide">Digital Bus Pass</h1>
        </div>
        <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">Pass #CP-8491</span>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 space-y-4 max-w-md mx-auto w-full">
        {/* Pass Card */}
        <div className="relative rounded-2xl overflow-hidden shadow-xl border border-orange-200 dark:border-slate-700 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 text-white p-5">
          {/* Header watermark */}
          <div className="flex justify-between items-start border-b border-white/20 pb-3">
            <div>
              <span className="text-[10px] tracking-widest font-extrabold uppercase text-orange-200">
                CAMPUS TRANSIT AUTHORITY
              </span>
              <h2 className="text-lg font-black tracking-tight leading-none mt-0.5">STUDENT TRANSIT PASS</h2>
            </div>
            <span className="px-2 py-0.5 bg-emerald-400/90 text-slate-900 text-[10px] font-black rounded-full uppercase tracking-wider">
              Active
            </span>
          </div>

          {/* Student Profile Info */}
          <div className="flex items-center space-x-4 my-4">
            <div className="w-16 h-16 rounded-xl bg-white text-[#EA580C] flex items-center justify-center font-black text-2xl shadow-inner border-2 border-orange-200 shrink-0">
              AS
            </div>
            <div className="overflow-hidden">
              <h3 className="text-base font-bold truncate">AARAV SHARMA</h3>
              <p className="text-xs text-orange-100 font-mono">ID: 23CS-8491</p>
              <p className="text-xs text-orange-200 font-medium">B.Tech Computer Science</p>
            </div>
          </div>

          {/* Route & Validity Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-black/15 rounded-xl p-3 backdrop-blur-xs">
            <div>
              <span className="text-orange-200 text-[10px] uppercase font-semibold block">Permitted Route</span>
              <span className="font-bold">RT03 (ECIL - Campus)</span>
            </div>
            <div>
              <span className="text-orange-200 text-[10px] uppercase font-semibold block">Valid Till</span>
              <span className="font-bold">31 May 2027</span>
            </div>
            <div>
              <span className="text-orange-200 text-[10px] uppercase font-semibold block">Boarding Stop</span>
              <span className="font-bold">Lalapet Stage 2</span>
            </div>
            <div>
              <span className="text-orange-200 text-[10px] uppercase font-semibold block">Security Level</span>
              <span className="font-bold text-emerald-300">Level 3 Cleared</span>
            </div>
          </div>

          {/* Dynamic QR & Authenticity code */}
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Simulated QR Code */}
              <div className="w-14 h-14 bg-white p-1.5 rounded-lg shrink-0 flex items-center justify-center shadow">
                <svg className="w-full h-full text-slate-900" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm8-2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm6-4h2v4h-2v-4zm-2 4h2v2h-2v-2zm2 2h2v2h-2v-2zm-4-2h2v4h-2v-4z" />
                </svg>
              </div>
              <div className="text-[11px] leading-tight">
                <p className="font-mono text-orange-100">Live Token Ticker</p>
                <p className="font-mono font-bold text-white tracking-widest">{currentTime}</p>
                <p className="text-[9px] text-orange-200 mt-0.5">Dynamic encrypted anti-screenshot</p>
              </div>
            </div>

            <button
              onClick={handleSimulateScan}
              className="text-xs bg-white text-[#EA580C] font-bold px-3 py-2 rounded-xl shadow active:scale-95 transition cursor-pointer"
            >
              NFC Tap
            </button>
          </div>
        </div>

        {/* Scan Status Toast if tested */}
        {scanned && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center space-x-2">
            <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span><strong>NFC Confirmed:</strong> Conductor device validated your RT03 ride.</span>
          </div>
        )}

        {/* Quick Rules */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-xs space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Pass Benefits &amp; Guidelines</h4>
          <ul className="text-xs space-y-1.5 text-gray-700 dark:text-slate-300 list-disc list-inside">
            <li>Unlimited rides on registered route RT03 and campus shuttles</li>
            <li>Priority morning boarding between 08:00 AM – 09:15 AM</li>
            <li>Present this pass to the vehicle conductor or tap over the terminal scanner</li>
            <li>In case of card loss, contact the Campus Transport Helpdesk</li>
          </ul>
        </div>
      </main>

      <footer className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex space-x-3">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-slate-700 font-semibold text-xs text-center"
        >
          Return to Dashboard
        </button>
        <button
          onClick={() => alert('Campus Pass offline credential saved to your device cache!')}
          className="flex-1 py-3 rounded-xl bg-[#EA580C] text-white font-semibold text-xs text-center shadow"
        >
          Save Offline Copy
        </button>
      </footer>
    </div>
  );
};
