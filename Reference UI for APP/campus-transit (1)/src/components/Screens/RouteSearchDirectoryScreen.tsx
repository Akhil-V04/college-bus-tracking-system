import React, { useState } from 'react';
import { ScreenId } from '../../types';
import { NEAREST_STAGES } from '../../data/transitData';

interface RouteSearchDirectoryScreenProps {
  onBack: () => void;
  onNavigate: (screen: ScreenId) => void;
  onSelectStage?: (stageName: string) => void;
  onToggleTheme: () => void;
}

export const RouteSearchDirectoryScreen: React.FC<RouteSearchDirectoryScreenProps> = ({
  onBack,
  onNavigate,
  onSelectStage,
  onToggleTheme
}) => {
  const [campusName, setCampusName] = useState('HYDERABAD CAMPUS');
  const [campusDropdownOpen, setCampusDropdownOpen] = useState(false);

  const campuses = [
    'HYDERABAD CAMPUS',
    'WARANGAL SATELLITE CAMPUS',
    'GACHIBOWLI EXTENSION',
    'GHATKESAR TECH PARK'
  ];

  return (
    <div className="bg-gray-50 dark:bg-slate-900 flex flex-col min-h-full h-full text-gray-900 dark:text-slate-100 select-none antialiased overflow-y-auto">
      {/* BEGIN: NavigationHeader */}
      <header
        className="bg-[#EA580C] text-white pt-4 pb-4 px-4 shadow-sm sticky top-0 z-30"
        data-purpose="top-navigation-bar"
      >
        <div className="flex items-center space-x-3 justify-between">
          {/* Back navigation button */}
          <button
            aria-label="Back"
            onClick={onBack}
            className="p-1 -ml-1 active:opacity-75 focus:outline-none flex items-center justify-center cursor-pointer"
            type="button"
          >
            <svg className="w-6 h-6 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Campus title with dropdown trigger */}
          <div
            onClick={() => setCampusDropdownOpen(prev => !prev)}
            className="flex items-center space-x-2 cursor-pointer active:opacity-85 select-none"
          >
            <h1 className="text-xl font-bold tracking-wide uppercase">{campusName}</h1>
            <svg
              className={`w-5 h-5 stroke-[2.5] transition-transform ${campusDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Theme button */}
          <button
            aria-label="Toggle theme"
            onClick={onToggleTheme}
            className="p-1 active:opacity-75 focus:outline-none flex items-center justify-center text-white cursor-pointer"
            type="button"
          >
            <svg className="w-6 h-6 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Campus Dropdown */}
        {campusDropdownOpen && (
          <div className="mt-3 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-orange-200 dark:border-slate-700 py-1 text-slate-800 dark:text-slate-100 overflow-hidden text-sm">
            {campuses.map(campus => (
              <button
                key={campus}
                type="button"
                onClick={() => {
                  setCampusName(campus);
                  setCampusDropdownOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 hover:bg-orange-50 dark:hover:bg-slate-700 font-medium transition-colors ${
                  campusName === campus ? 'text-[#EA580C] font-bold bg-orange-50/60 dark:bg-slate-700/60' : ''
                }`}
              >
                {campus}
              </button>
            ))}
          </div>
        )}
      </header>
      {/* END: NavigationHeader */}

      {/* BEGIN: MainContent */}
      <main className="flex-1 px-4 pt-5 pb-8 max-w-lg mx-auto w-full" data-purpose="route-search-options">
        {/* BEGIN: ActionCardsList */}
        <section aria-label="Search Options" className="space-y-3.5 mb-7">
          {/* Card 1: Search From and To */}
          <div
            onClick={() => onNavigate('search-from-to')}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between cursor-pointer active:scale-99 hover:shadow transition-all"
            data-purpose="action-card"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center space-x-4">
              {/* Route Path Icon Container */}
              <div
                className="w-14 h-14 rounded-xl bg-gray-50 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0"
                data-purpose="card-icon"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 32 32">
                  <path
                    d="M22 6a3.5 3.5 0 00-3.5 3.5c0 2.5 3.5 6.5 3.5 6.5s3.5-4 3.5-6.5A3.5 3.5 0 0022 6z"
                    stroke="#EA580C"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  <circle cx="22" cy="9.5" fill="#EA580C" r="1.2" />
                  <path d="M20 16c-4 3-7 2-10 6" stroke="#EA580C" strokeDasharray="2 2" strokeLinecap="round" strokeWidth="2" />
                  <path
                    d="M10 17a4 4 0 00-4 4c0 3.2 4 7.5 4 7.5s4-4.3 4-7.5a4 4 0 00-4-4z"
                    stroke="#293885"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  <circle cx="10" cy="21" fill="#293885" r="1.5" />
                </svg>
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
                Search From and To
              </span>
            </div>
            {/* Right Arrow */}
            <svg className="w-5 h-5 text-gray-400 stroke-[2.5] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M8.25 4.5l7.5 7.5-7.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Card 2: Search by Route Number */}
          <div
            onClick={() => onNavigate('search-route-number')}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between cursor-pointer active:scale-99 hover:shadow transition-all"
            data-purpose="action-card"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center space-x-4">
              {/* Bus with Search Lens Icon Container */}
              <div
                className="w-14 h-14 rounded-xl bg-gray-50 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0"
                data-purpose="card-icon"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 32 32">
                  <rect height="15" rx="3" stroke="#EA580C" strokeWidth="2" width="16" x="5" y="8" />
                  <line stroke="#EA580C" strokeWidth="2" x1="5" x2="21" y1="14" y2="14" />
                  <rect fill="#293885" height="3" rx="0.8" width="3" x="6.5" y="23" />
                  <rect fill="#293885" height="3" rx="0.8" width="3" x="16.5" y="23" />
                  <circle cx="8" cy="19" fill="#EA580C" r="1" />
                  <circle cx="18" cy="19" fill="#EA580C" r="1" />
                  <circle cx="19" cy="12" fill="white" r="4.5" stroke="#293885" strokeWidth="2" />
                  <line stroke="#293885" strokeLinecap="round" strokeWidth="2.2" x1="22.5" x2="26" y1="15.5" y2="19" />
                </svg>
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
                Search by Route Number
              </span>
            </div>
            <svg className="w-5 h-5 text-gray-400 stroke-[2.5] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M8.25 4.5l7.5 7.5-7.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Card 3: Search by Campus Bus Numbers */}
          <div
            onClick={() => onNavigate('search-stage')}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between cursor-pointer active:scale-99 hover:shadow transition-all"
            data-purpose="action-card"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center space-x-4">
              {/* Bus Fleet Icon Container */}
              <div
                className="w-14 h-14 rounded-xl bg-gray-50 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0"
                data-purpose="card-icon"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 32 32">
                  <rect fill="white" height="15" rx="3" stroke="#EA580C" strokeWidth="2" width="17" x="5" y="9" />
                  <line stroke="#EA580C" strokeWidth="1.8" x1="5" x2="22" y1="15" y2="15" />
                  <rect fill="#293885" height="3" rx="0.8" width="3.5" x="7" y="24" />
                  <rect fill="#293885" height="3" rx="0.8" width="3.5" x="16.5" y="24" />
                  <circle cx="8.5" cy="19.5" fill="#EA580C" r="1.1" />
                  <circle cx="18.5" cy="19.5" fill="#EA580C" r="1.1" />
                  <circle cx="20" cy="12" fill="white" r="4.5" stroke="#293885" strokeWidth="2" />
                  <line stroke="#293885" strokeLinecap="round" strokeWidth="2.2" x1="23.5" x2="27" y1="15.5" y2="19" />
                </svg>
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
                Search by Campus Bus Numbers
              </span>
            </div>
            <svg className="w-5 h-5 text-gray-400 stroke-[2.5] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M8.25 4.5l7.5 7.5-7.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </section>
        {/* END: ActionCardsList */}

        {/* BEGIN: SubheadSection */}
        <section className="mt-8 px-1" data-purpose="nearest-stages-header">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-gray-800 dark:text-slate-200 tracking-normal">
              Nearest Stages from your location
            </h2>
            <span className="text-xs text-[#EA580C] font-semibold cursor-pointer" onClick={() => onNavigate('nearby-stages')}>
              View Map
            </span>
          </div>

          <div className="space-y-2.5">
            {NEAREST_STAGES.map(stage => (
              <div
                key={stage.id}
                onClick={() => {
                  if (onSelectStage) onSelectStage(stage.name);
                  onNavigate('route-results');
                }}
                className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center justify-between cursor-pointer hover:bg-orange-50/50 dark:hover:bg-slate-700/50 transition-colors shadow-2xs"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-950/70 text-[#EA580C] flex items-center justify-center font-bold text-xs">
                    🚏
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{stage.name}</h3>
                    <p className="text-xs text-gray-400">{stage.distance} • Next in {stage.time}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/80 text-[#EA580C]">
                    {stage.busesNext10Min[0]}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </section>
        {/* END: SubheadSection */}
      </main>
      {/* END: MainContent */}

      {/* BEGIN: HomeIndicator */}
      <footer className="w-full flex justify-center pb-2 pt-4" data-purpose="system-home-bar">
        <div className="w-36 h-1 bg-gray-300 dark:bg-slate-700 rounded-full"></div>
      </footer>
      {/* END: HomeIndicator */}
    </div>
  );
};
