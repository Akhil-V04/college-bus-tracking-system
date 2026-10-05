import React, { useState } from 'react';
import { ScreenType } from '../types';
import { ROUTE_ITEMS } from '../data/mockData';
import { ArrowLeft, Moon, Sun, Search, Bus } from 'lucide-react';

interface SearchByRouteNumberScreenProps {
  onNavigate: (screen: ScreenType) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSelectRoute: (routeNumber: string) => void;
}

export const SearchByRouteNumberScreen: React.FC<SearchByRouteNumberScreenProps> = ({
  onNavigate,
  theme,
  onToggleTheme,
  onSelectRoute,
}) => {
  const [filterText, setFilterText] = useState('');

  const filteredRoutes = ROUTE_ITEMS.filter((item) =>
    item.number.toLowerCase().includes(filterText.toLowerCase()) ||
    (item.title && item.title.toLowerCase().includes(filterText.toLowerCase()))
  );

  const handleRouteClick = (routeNumber: string) => {
    onSelectRoute(routeNumber);
    onNavigate('route-results');
  };

  return (
    <div className="w-full min-h-full flex flex-col justify-between bg-[#090F16] text-white select-none">
      {/* Top Header Section */}
      <header id="app-header" className="bg-[#EA580C] px-4 pt-4 pb-5 flex flex-col gap-4 text-white">
        {/* Top Bar: Back, Title, Theme Toggle */}
        <nav aria-label="Navigation Header" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              id="route-back-btn"
              aria-label="Go Back"
              onClick={() => onNavigate('campus-search-menu')}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 active:bg-black/20 transition-colors focus:outline-none cursor-pointer"
              type="button"
            >
              <ArrowLeft className="w-6 h-6 text-white stroke-[2.5]" />
            </button>
            <h1 className="text-xl font-semibold tracking-wide text-white">
              Search by Route Number
            </h1>
          </div>

          <button
            id="theme-toggle"
            aria-label="Toggle Theme"
            onClick={onToggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 active:bg-black/20 transition-colors focus:outline-none cursor-pointer"
            type="button"
          >
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-white stroke-[2]" />
            ) : (
              <Sun className="w-5 h-5 text-white stroke-[2]" />
            )}
          </button>
        </nav>

        {/* Search Input Container */}
        <div className="relative w-full">
          <input
            id="route-search"
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search By Route Number"
            className="w-full h-12 px-4 pr-11 rounded-lg bg-white text-gray-900 placeholder-gray-500 text-base font-normal border-none shadow-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <Search className="w-5 h-5" />
          </div>
        </div>
      </header>

      {/* Main Content List */}
      <main className="flex-1 bg-[#090F16] flex flex-col overflow-y-auto">
        {/* Section Sub-Header */}
        <div className="px-5 pt-4 pb-2 bg-[#090F16]">
          <h2 className="text-sm font-medium text-gray-400 tracking-wide">
            Route Number
          </h2>
        </div>

        {/* Route Items List */}
        <div id="routes-list" className="flex-1 flex flex-col bg-[#0E141C]">
          {filteredRoutes.map((route) => (
            <article
              key={route.number}
              onClick={() => handleRouteClick(route.number)}
              className="route-item flex items-center justify-between px-5 py-3.5 border-b border-[#222B38] hover:bg-[#161C24] active:bg-[#1A222D] transition-colors cursor-pointer"
            >
              <div className="flex items-center">
                <div className="w-8 h-8 flex items-center justify-center mr-4 text-[#EA580C]">
                  <Bus className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <span className="text-lg font-medium tracking-normal text-white">
                    {route.number}
                  </span>
                  {route.title && (
                    <span className="text-xs text-slate-400 block -mt-0.5">
                      {route.title}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs font-semibold text-[#EA580C] px-2 py-0.5 rounded bg-orange-500/10">
                Active
              </span>
            </article>
          ))}

          {filteredRoutes.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              No matching routes found for &quot;{filterText}&quot;
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation Indicator */}
      <footer className="w-full pt-3 pb-2 flex justify-center items-center bg-[#090F16]">
        <div className="w-36 h-1 bg-[#EA580C] rounded-full"></div>
      </footer>
    </div>
  );
};
