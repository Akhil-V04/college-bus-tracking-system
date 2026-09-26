import React, { useState } from 'react';
import { ScreenType } from '../types';
import { RECENT_TRIPS } from '../data/mockData';
import { ArrowLeft, Moon, Sun, ArrowUpDown, ChevronRight, Clock } from 'lucide-react';

interface SearchFromToScreenProps {
  onNavigate: (screen: ScreenType) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const SearchFromToScreen: React.FC<SearchFromToScreenProps> = ({
  onNavigate,
  theme,
  onToggleTheme,
}) => {
  const [origin, setOrigin] = useState('Central Station');
  const [destination, setDestination] = useState('Main Campus');

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSelectRecent = (from: string, to: string) => {
    setOrigin(from);
    setDestination(to);
  };

  const handleSearch = () => {
    onNavigate('route-results');
  };

  return (
    <div className="min-h-full flex flex-col antialiased select-none bg-[#090D12] text-[#F8FAFC]">
      {/* TopBar */}
      <header
        id="app-header"
        className="text-white sticky top-0 z-30 shadow-sm bg-[#EA580C]"
      >
        {/* iOS Safe Area Spacer */}
        <div className="h-8 w-full"></div>

        {/* Main Navigation Row */}
        <div className="flex items-center px-4 pb-4 pt-1">
          <button
            id="back-button"
            aria-label="Go back"
            onClick={() => onNavigate('campus-search-menu')}
            className="p-1 -ml-1 mr-3 rounded-full active:scale-95 transition-colors inline-flex items-center justify-center focus:outline-none cursor-pointer"
            type="button"
          >
            <ArrowLeft className="h-6 w-6 text-white stroke-[2.5]" />
          </button>
          <h1 className="text-xl font-medium tracking-normal text-white flex-1">
            Search From and To
          </h1>
          <button
            id="theme-toggle-btn"
            aria-label="Toggle theme"
            onClick={onToggleTheme}
            className="p-1.5 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white focus:outline-none flex items-center justify-center cursor-pointer"
            type="button"
          >
            {theme === 'dark' ? (
              <Moon className="h-5 w-5 text-white stroke-[2]" />
            ) : (
              <Sun className="h-5 w-5 text-white stroke-[2]" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pt-6 pb-8 flex flex-col max-w-md mx-auto w-full">
        {/* Search Card Container */}
        <section id="search-card-container" className="relative mb-5 space-y-3">
          {/* Card 1 */}
          <div className="rounded-2xl shadow-md p-4 flex items-stretch divide-x divide-slate-700/60 bg-[#161F2C] border border-white/10 relative">
            <div id="from-field" className="flex-1 pr-4 min-w-0">
              <label
                htmlFor="origin-input"
                className="block text-xs font-normal text-slate-400 mb-1 tracking-wide"
              >
                From
              </label>
              <input
                id="origin-input"
                name="origin"
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Enter Origin"
                className="w-full p-0 border-0 text-base font-semibold text-white focus:ring-0 focus:outline-none truncate bg-transparent"
              />
            </div>

            <div id="to-field" className="flex-1 pl-4 min-w-0">
              <label
                htmlFor="destination-input"
                className="block text-xs font-normal text-slate-400 mb-1 tracking-wide"
              >
                To
              </label>
              <input
                id="destination-input"
                name="destination"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Enter Destination"
                className="w-full p-0 border-0 text-base font-semibold text-white focus:ring-0 focus:outline-none truncate bg-transparent"
              />
            </div>

            {/* Swap Button inside center */}
            <button
              id="swap-locations-btn"
              onClick={handleSwap}
              aria-label="Swap locations"
              type="button"
              className="absolute -bottom-3.5 right-6 w-7 h-7 bg-[#EA580C] hover:bg-[#c2410c] text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 z-10 cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Quick Route Card / Stage selector */}
          <div className="rounded-2xl shadow-md p-4 flex items-stretch divide-x divide-slate-700/60 bg-[#161F2C] border border-white/10">
            <div className="flex-1 pr-4 min-w-0">
              <label className="block text-xs font-normal text-slate-400 mb-1 tracking-wide">
                Campus Stage
              </label>
              <span className="text-sm font-semibold text-slate-300 block truncate">
                ECIL Terminal
              </span>
            </div>
            <div className="flex-1 pl-4 min-w-0">
              <label className="block text-xs font-normal text-slate-400 mb-1 tracking-wide">
                Destination Stage
              </label>
              <span className="text-sm font-semibold text-slate-300 block truncate">
                VBIT Campus Gate
              </span>
            </div>
          </div>
        </section>

        {/* Primary CTA Search Button */}
        <div className="mb-7">
          <button
            id="search-bus-cta"
            onClick={handleSearch}
            className="w-full bg-[#EA580C] hover:bg-[#c2410c] active:scale-[0.99] text-white font-semibold text-lg py-3.5 rounded-xl shadow-sm transition-all focus:outline-none flex items-center justify-center tracking-normal cursor-pointer"
            type="button"
          >
            Search Bus
          </button>
        </div>

        {/* Recent Trip History */}
        <section id="recent-trip-history" className="mt-1">
          <h2 className="text-sm font-normal text-[#F8FAFC] mb-3 tracking-normal">
            Recent Trip History
          </h2>

          <div className="flex flex-col gap-2.5">
            {RECENT_TRIPS.map((trip) => (
              <button
                key={trip.id}
                onClick={() => handleSelectRecent(trip.from, trip.to)}
                className="flex items-center justify-between p-3.5 rounded-xl text-left transition-colors group bg-[#161F2C] border border-white/5 hover:border-orange-500/30 cursor-pointer"
                type="button"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[#EA580C]/15 text-[#EA580C]">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div className="text-xs">
                    <span className="font-medium text-[#F8FAFC]">
                      {trip.from}
                    </span>
                    <span className="text-slate-400 mx-1.5">→</span>
                    <span className="font-medium text-[#F8FAFC]">
                      {trip.to}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-300" />
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* Bottom Safe Bar */}
      <footer className="h-4 w-full bg-[#EA580C] mt-auto"></footer>
    </div>
  );
};
