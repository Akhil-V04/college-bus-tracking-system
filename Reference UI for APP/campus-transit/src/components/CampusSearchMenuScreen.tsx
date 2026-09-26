import React, { useState } from 'react';
import { ScreenType } from '../types';
import { CAMPUSES } from '../data/mockData';
import { ArrowLeft, ChevronDown, Moon, Sun, ChevronRight, Check } from 'lucide-react';

interface CampusSearchMenuScreenProps {
  onNavigate: (screen: ScreenType) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const CampusSearchMenuScreen: React.FC<CampusSearchMenuScreenProps> = ({
  onNavigate,
  theme,
  onToggleTheme,
}) => {
  const [selectedCampus, setSelectedCampus] = useState(CAMPUSES[0]);
  const [showCampusDropdown, setShowCampusDropdown] = useState(false);

  return (
    <div className="w-full min-h-full flex flex-col bg-[#0E141C] text-slate-100 antialiased select-none">
      {/* TopBar */}
      <header
        id="header-bar"
        className="bg-[#EA580C] text-white pt-10 pb-4 px-4 shadow-md sticky top-0 z-50 flex items-center justify-between"
      >
        {/* Back Navigation Button */}
        <button
          id="back-btn"
          aria-label="Go Back"
          onClick={() => onNavigate('home')}
          className="p-1 -ml-1 text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer"
          type="button"
        >
          <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Campus Title with Dropdown Selector */}
        <div className="relative">
          <button
            id="campus-selector-btn"
            onClick={() => setShowCampusDropdown(!showCampusDropdown)}
            className="flex items-center gap-1.5 cursor-pointer active:opacity-80 transition-opacity focus:outline-none"
            type="button"
          >
            <h1 className="text-base font-extrabold tracking-wider uppercase text-white drop-shadow-sm">
              {selectedCampus}
            </h1>
            <ChevronDown className={`w-5 h-5 stroke-[2.5] text-white transition-transform duration-200 ${showCampusDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Campus Dropdown Menu */}
          {showCampusDropdown && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-[#161C24] border border-[#283545] rounded-xl shadow-2xl py-2 z-50">
              <span className="text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider block">
                Select Campus
              </span>
              {CAMPUSES.map((campus) => (
                <button
                  key={campus}
                  onClick={() => {
                    setSelectedCampus(campus);
                    setShowCampusDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between hover:bg-[#1f2834] text-slate-200 transition-colors"
                >
                  <span>{campus}</span>
                  {selectedCampus === campus && (
                    <Check className="w-4 h-4 text-[#EA580C]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          id="theme-toggle"
          aria-label="Toggle Theme"
          onClick={onToggleTheme}
          className="p-1 -mr-1 text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer"
          type="button"
        >
          {theme === 'dark' ? (
            <Moon className="w-6 h-6 stroke-[2]" />
          ) : (
            <Sun className="w-6 h-6 stroke-[2]" />
          )}
        </button>
      </header>

      {/* Main Content */}
      <main id="search-options-list" className="flex-1 px-4 py-5 flex flex-col space-y-4">
        {/* Option Card 1: Search From and To */}
        <button
          id="search-from-to-card"
          onClick={() => onNavigate('search-from-to')}
          className="w-full flex items-center justify-between p-4 bg-[#161C24] border border-[#283545] rounded-xl hover:border-orange-500/50 active:bg-[#1f2732] active:scale-[0.99] transition-all shadow-sm cursor-pointer group text-left"
        >
          <div className="flex items-center space-x-4">
            {/* Route Pinpoints Icon Container */}
            <div className="w-12 h-12 rounded-lg bg-[#0E141C] border border-[#283545] flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
                <circle className="stroke-[#38BDF8]" cx="6" cy="18" r="2.5" strokeWidth="2" fill="#0E141C" />
                <path d="M7.5 16.5L16.5 7.5" stroke="#EA580C" strokeWidth="1.8" strokeDasharray="2 2" strokeLinecap="round" />
                <circle className="stroke-[#EA580C]" cx="17.5" cy="6.5" r="2.5" strokeWidth="2" fill="#0E141C" />
                <path d="M17.5 9V11" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[15px] font-medium text-[#F8FAFC] group-hover:text-white">
              Search From and To
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Option Card 2: Search by Route Number */}
        <button
          id="search-route-number-card"
          onClick={() => onNavigate('search-route-number')}
          className="w-full flex items-center justify-between p-4 bg-[#161C24] border border-[#283545] rounded-xl hover:border-orange-500/50 active:bg-[#1f2732] active:scale-[0.99] transition-all shadow-sm cursor-pointer group text-left"
        >
          <div className="flex items-center space-x-4">
            {/* Bus with Search Badge Icon Container */}
            <div className="w-12 h-12 rounded-lg bg-[#0E141C] border border-[#283545] flex items-center justify-center relative shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
                <rect x="4" y="5" width="13" height="13" rx="2" stroke="#EA580C" strokeWidth="1.8" />
                <line x1="4" y1="9" x2="17" y2="9" stroke="#EA580C" strokeWidth="1.5" />
                <circle cx="7" cy="18.5" r="1.2" fill="#EA580C" />
                <circle cx="14" cy="18.5" r="1.2" fill="#EA580C" />
                <circle cx="15.5" cy="11.5" r="3" stroke="#38BDF8" strokeWidth="1.8" fill="#0E141C" />
                <path d="M17.8 13.8L20 16" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[15px] font-medium text-[#F8FAFC] group-hover:text-white">
              Search by Route Number
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Option Card 3: Search by Campus Bus Numbers */}
        <button
          id="search-campus-bus-card"
          onClick={() => onNavigate('search-route-number')}
          className="w-full flex items-center justify-between p-4 bg-[#161C24] border border-[#283545] rounded-xl hover:border-orange-500/50 active:bg-[#1f2732] active:scale-[0.99] transition-all shadow-sm cursor-pointer group text-left"
        >
          <div className="flex items-center space-x-4">
            {/* Campus Bus Icon Container */}
            <div className="w-12 h-12 rounded-lg bg-[#0E141C] border border-[#283545] flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
                <rect x="4" y="5" width="13" height="13" rx="2" stroke="#EA580C" strokeWidth="1.8" />
                <line x1="4" y1="9" x2="17" y2="9" stroke="#EA580C" strokeWidth="1.5" />
                <circle cx="7" cy="18.5" r="1.2" fill="#EA580C" />
                <circle cx="14" cy="18.5" r="1.2" fill="#EA580C" />
                <circle cx="15.5" cy="11.5" r="3" stroke="#38BDF8" strokeWidth="1.8" fill="#0E141C" />
                <path d="M17.8 13.8L20 16" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[15px] font-medium text-[#F8FAFC] group-hover:text-white">
              Search by Campus Bus Numbers
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Bottom Contextual Section */}
        <div id="stages-notice" className="pt-6 px-1">
          <p className="text-[15px] font-semibold text-slate-200 tracking-wide mb-3">
            Nearest Stages from your location
          </p>

          <div className="space-y-2">
            {[
              { name: 'VBIT Main Gate', distance: '120 m away', nextBus: 'RT03 in 4 min' },
              { name: 'Engineering Block Stand', distance: '350 m away', nextBus: '3K in 9 min' },
              { name: 'Hostel Circle Gate 2', distance: '500 m away', nextBus: '222P in 15 min' }
            ].map((stage, idx) => (
              <button
                key={idx}
                onClick={() => onNavigate('station-search')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#161F2C] border border-[#283545] hover:border-orange-500/30 transition-all text-left"
              >
                <div>
                  <div className="text-sm font-bold text-white">{stage.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{stage.distance}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#EA580C] bg-[#EA580C]/10 px-2 py-0.5 rounded">
                    {stage.nextBus}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
