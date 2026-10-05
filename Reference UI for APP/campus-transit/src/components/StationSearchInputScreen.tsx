import React, { useState } from 'react';
import { ScreenType } from '../types';
import { ArrowLeft, X, Moon, Sun, MapPin, Clock, ArrowUpRight, Mic, MoreHorizontal, Delete, CornerDownLeft } from 'lucide-react';

interface StationSearchInputScreenProps {
  onNavigate: (screen: ScreenType) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const StationSearchInputScreen: React.FC<StationSearchInputScreenProps> = ({
  onNavigate,
  theme,
  onToggleTheme,
}) => {
  const [searchTerm, setSearchTerm] = useState('Eci');
  const [showLocationAlert, setShowLocationAlert] = useState(true);

  const handleKeyPress = (char: string) => {
    setSearchTerm((prev) => prev + char);
  };

  const handleBackspace = () => {
    setSearchTerm((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setSearchTerm('');
  };

  const handleSelectStation = (station: string) => {
    setSearchTerm(station);
    setTimeout(() => {
      onNavigate('route-results');
    }, 300);
  };

  return (
    <div className="w-full min-h-full flex flex-col justify-between bg-[#090F16] text-slate-100 antialiased select-none">
      {/* Top Section */}
      <div className="flex-1 flex flex-col">
        {/* iOS Status Bar */}
        <div id="status-bar" className="bg-[#EA580C] px-6 pt-3 pb-1 flex justify-between items-center text-white text-xs font-semibold select-none">
          <span>3:31</span>
          <div className="flex items-center space-x-2">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z" />
            </svg>
            <span className="text-[10px] font-bold tracking-tight">5G</span>
            <div className="w-5 h-2.5 border border-white rounded-sm p-0.5 flex items-center">
              <div className="h-full bg-white rounded-2xs w-3/4"></div>
            </div>
          </div>
        </div>

        {/* Search Header */}
        <header id="app-search-header" className="bg-[#EA580C] px-4 pt-2 pb-3.5 shadow-md">
          <div className="flex items-center gap-2">
            {/* Search Bar Container */}
            <div className="flex-1 bg-white rounded-xl px-3.5 py-2.5 flex items-center shadow-inner text-slate-900">
              <button
                id="search-back-btn"
                aria-label="Go back"
                onClick={() => onNavigate('campus-search-menu')}
                className="text-slate-700 hover:text-slate-900 transition-colors p-0.5 mr-2.5 cursor-pointer"
                type="button"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
              </button>

              <div className="flex-1 flex items-center font-medium text-base tracking-wide">
                <span>{searchTerm}</span>
                <span className="inline-block w-[2px] h-5 bg-[#EA580C] ml-0.5 blinking-cursor"></span>
              </div>

              {searchTerm.length > 0 && (
                <button
                  id="clear-search-btn"
                  aria-label="Clear input"
                  onClick={handleClear}
                  className="w-5 h-5 bg-slate-500 hover:bg-slate-700 rounded-full flex items-center justify-center text-white transition-colors ml-2 cursor-pointer"
                  type="button"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>

            {/* Theme Switcher Button */}
            <button
              id="theme-toggle"
              aria-label="Toggle Theme"
              onClick={onToggleTheme}
              className="p-2.5 bg-orange-700/60 hover:bg-orange-700 text-white rounded-xl transition-colors border border-orange-500/40 cursor-pointer"
              type="button"
            >
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 stroke-[2]" />
              ) : (
                <Sun className="w-5 h-5 stroke-[2]" />
              )}
            </button>
          </div>
        </header>

        {/* Location Warning Banner */}
        {showLocationAlert && (
          <section
            id="location-permission-warning"
            className="bg-red-950/40 border-b border-red-900/30 px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="text-red-400 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <p className="text-xs text-red-200 leading-snug font-normal">
                Location sharing disabled. Tap here to enable location
              </p>
            </div>
            <button
              id="enable-loc-link"
              onClick={() => setShowLocationAlert(false)}
              className="text-xs font-semibold text-red-400 hover:text-red-300 uppercase tracking-wider shrink-0 cursor-pointer"
              type="button"
            >
              ENABLE
            </button>
          </section>
        )}

        {/* Search Results Area */}
        <main className="flex-1 px-4 py-5 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-100 tracking-wide">
              Nearest Stages from your location
            </h2>
          </div>

          {/* Quick suggestions based on typing */}
          {searchTerm.toLowerCase().includes('eci') && (
            <div className="mb-5 space-y-1">
              <button
                onClick={() => handleSelectStation('ECIL Terminal')}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg bg-[#161F2C] border border-orange-500/30 text-left hover:bg-[#1E293B] cursor-pointer"
              >
                <div>
                  <div className="text-sm font-bold text-white">ECIL Terminal</div>
                  <div className="text-xs text-slate-400">Main Campus Hub • Gate 1</div>
                </div>
                <span className="text-xs text-[#EA580C] font-semibold">Select ➔</span>
              </button>
            </div>
          )}

          {/* Recent Searches */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-slate-400 tracking-wider">
              Recent Search
            </h3>

            {/* Station Item (LALAPET) */}
            <div
              id="station-lalapet"
              onClick={() => handleSelectStation('LALAPET')}
              className="flex items-center justify-between py-3 border-b border-slate-800/80 group cursor-pointer hover:bg-[#0E141C] px-1 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="text-slate-400 group-hover:text-[#EA580C] transition-colors">
                  <Clock className="w-5 h-5 stroke-[1.8]" />
                </div>
                <span className="text-sm font-bold text-slate-100 tracking-wider">
                  LALAPET
                </span>
              </div>
              <div className="text-slate-500 group-hover:text-slate-300 transition-colors">
                <ArrowUpRight className="w-4 h-4 stroke-[2]" />
              </div>
            </div>

            {/* Station Item (HABSIGUDA) */}
            <div
              id="station-habsiguda"
              onClick={() => handleSelectStation('HABSIGUDA')}
              className="flex items-center justify-between py-3 border-b border-slate-800/80 group cursor-pointer hover:bg-[#0E141C] px-1 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="text-slate-400 group-hover:text-[#EA580C] transition-colors">
                  <Clock className="w-5 h-5 stroke-[1.8]" />
                </div>
                <span className="text-sm font-bold text-slate-100 tracking-wider">
                  HABSIGUDA
                </span>
              </div>
              <div className="text-slate-500 group-hover:text-slate-300 transition-colors">
                <ArrowUpRight className="w-4 h-4 stroke-[2]" />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Virtual Mobile Keyboard */}
      <footer
        id="virtual-mobile-keyboard"
        className="bg-[#12161E] select-none border-t border-slate-800/60 pt-2 pb-5 px-1.5 shadow-2xl"
      >
        {/* Suggestion Toolbar */}
        <div className="flex items-center justify-between px-3 pb-2 text-slate-400 border-b border-slate-800/40 text-xs">
          <div className="flex items-center gap-4">
            <span
              onClick={() => setSearchTerm('Existing')}
              className="hover:text-slate-200 cursor-pointer"
            >
              Existing
            </span>
            <span
              onClick={() => handleSelectStation('ECIL Terminal')}
              className="text-white font-semibold cursor-pointer underline decoration-[#EA580C]"
            >
              Eci
            </span>
            <span
              onClick={() => setSearchTerm('Exist')}
              className="hover:text-slate-200 cursor-pointer"
            >
              Exist
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-400">
            <Mic className="w-4 h-4 cursor-pointer hover:text-white" />
            <MoreHorizontal className="w-4 h-4 cursor-pointer hover:text-white" />
          </div>
        </div>

        {/* Keyboard Keys Grid */}
        <div className="pt-2 space-y-2">
          {/* Row 1 */}
          <div className="flex justify-center gap-1.5 px-0.5">
            {['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'].map((k) => (
              <button
                key={k}
                onClick={() => handleKeyPress(k)}
                className="flex-1 py-2.5 bg-[#1E2530] text-white rounded-md text-sm font-medium shadow-sm hover:bg-slate-700 active:scale-95 transition-all"
              >
                {k}
              </button>
            ))}
          </div>

          {/* Row 2 */}
          <div className="flex justify-center gap-1.5 px-3">
            {['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'].map((k) => (
              <button
                key={k}
                onClick={() => handleKeyPress(k)}
                className="flex-1 py-2.5 bg-[#1E2530] text-white rounded-md text-sm font-medium shadow-sm hover:bg-slate-700 active:scale-95 transition-all"
              >
                {k}
              </button>
            ))}
          </div>

          {/* Row 3 */}
          <div className="flex justify-center gap-1.5 px-0.5">
            <button
              onClick={() => handleKeyPress('^')}
              className="w-10 py-2.5 bg-[#181E27] text-orange-400 rounded-md flex items-center justify-center shadow-sm hover:bg-slate-700 active:scale-95 transition-all"
            >
              ⇧
            </button>
            {['z', 'x', 'c', 'v', 'b', 'n', 'm'].map((k) => (
              <button
                key={k}
                onClick={() => handleKeyPress(k)}
                className="flex-1 py-2.5 bg-[#1E2530] text-white rounded-md text-sm font-medium shadow-sm hover:bg-slate-700 active:scale-95 transition-all"
              >
                {k}
              </button>
            ))}
            <button
              onClick={handleBackspace}
              className="w-10 py-2.5 bg-[#181E27] text-orange-400 rounded-md flex items-center justify-center shadow-sm hover:bg-slate-700 active:scale-95 transition-all"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          {/* Row 4 */}
          <div className="flex justify-center items-center gap-1.5 px-0.5 pt-1">
            <button
              onClick={() => handleKeyPress('123')}
              className="w-12 py-2.5 bg-[#181E27] text-orange-400 rounded-md text-xs font-semibold shadow-sm hover:bg-slate-700"
            >
              123
            </button>
            <button
              onClick={() => handleKeyPress('😊')}
              className="w-9 py-2.5 bg-[#181E27] text-orange-400 rounded-md flex items-center justify-center shadow-sm hover:bg-slate-700"
            >
              😊
            </button>
            <button
              onClick={() => handleKeyPress(' ')}
              className="flex-1 py-2.5 bg-[#1E2530] text-slate-300 rounded-md text-xs font-normal shadow-sm tracking-wide text-center active:bg-slate-700"
            >
              Space
            </button>
            <button
              onClick={() => handleKeyPress('.')}
              className="w-9 py-2.5 bg-[#181E27] text-slate-300 rounded-md text-xs font-medium shadow-sm hover:bg-slate-700"
            >
              .
            </button>
            <button
              onClick={() => onNavigate('route-results')}
              className="w-12 py-2.5 bg-[#EA580C] text-white rounded-md flex items-center justify-center shadow-sm hover:bg-[#c2410c] active:scale-95"
            >
              <CornerDownLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* iOS Home Indicator */}
        <div className="w-28 h-1 bg-slate-600/70 rounded-full mx-auto mt-4 mb-0.5"></div>
      </footer>
    </div>
  );
};
