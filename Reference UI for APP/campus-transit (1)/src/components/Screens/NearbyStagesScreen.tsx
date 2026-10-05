import React from 'react';
import { ScreenId } from '../../types';
import { NEAREST_STAGES } from '../../data/transitData';

interface NearbyStagesScreenProps {
  onBack: () => void;
  onSelectStage: (stageName: string) => void;
  onNavigate: (screen: ScreenId) => void;
}

export const NearbyStagesScreen: React.FC<NearbyStagesScreenProps> = ({
  onBack,
  onSelectStage,
  onNavigate
}) => {
  const handleStageSelect = (stageName: string) => {
    onSelectStage(stageName);
    onNavigate('route-results');
  };

  return (
    <div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 min-h-full h-full flex flex-col antialiased select-none overflow-y-auto">
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
          <h1 className="text-xl font-medium tracking-wide">Nearby Stages</h1>
        </div>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
      </header>

      {/* GPS Location Banner */}
      <div className="bg-orange-50 dark:bg-slate-800/80 border-b border-orange-100 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-[#EA580C]/10 text-[#EA580C] flex items-center justify-center">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">Current GPS Fix: Active</p>
            <p className="text-[11px] text-gray-500">College North Hub, Campus Gate 2</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-[#EA580C] bg-white dark:bg-slate-700 px-2 py-1 rounded shadow-xs">
          Accuracy: ±4m
        </span>
      </div>

      {/* Stage List */}
      <main className="flex-1 p-4 space-y-3">
        <p className="text-xs text-gray-500 px-1">Stages within walking radius sorted by distance:</p>

        {NEAREST_STAGES.map(stage => (
          <div
            key={stage.id}
            onClick={() => handleStageSelect(stage.name)}
            className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800/70 shadow-xs hover:border-orange-300 dark:hover:border-orange-700 transition cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white uppercase tracking-tight">
                  {stage.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Connecting: {stage.busesNext10Min.join(', ')}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300">
                  {stage.distance}
                </span>
                <span className="block text-[11px] text-gray-400 mt-1">{stage.time} walk</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-slate-300">
                Active Routes: <strong className="text-emerald-600 dark:text-emerald-400">{stage.busesNext10Min[0]}</strong>
              </span>
              <span className="font-semibold text-[#EA580C] flex items-center space-x-1">
                <span>View Buses</span>
                <span>→</span>
              </span>
            </div>
          </div>
        ))}
      </main>

      <footer className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
        <button
          onClick={() => onNavigate('search-directory')}
          className="w-full py-3 rounded-xl bg-[#EA580C] text-white font-medium text-sm text-center shadow"
        >
          Open Route Search Directory
        </button>
      </footer>
    </div>
  );
};
