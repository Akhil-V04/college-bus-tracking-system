import React, { useState } from 'react';
import { ScreenId } from '../../types';
import { ROUTE_NUMBERS_LIST } from '../../data/transitData';

interface SearchByRouteScreenProps {
  onBack: () => void;
  onSelectRoute: (routeCode: string) => void;
  onNavigate: (screen: ScreenId) => void;
}

export const SearchByRouteScreen: React.FC<SearchByRouteScreenProps> = ({
  onBack,
  onSelectRoute,
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRoutes = ROUTE_NUMBERS_LIST.filter(route =>
    route.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRouteClick = (code: string) => {
    onSelectRoute(code);
    onNavigate('route-results');
  };

  return (
    <div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 min-h-full h-full flex flex-col antialiased select-none overflow-y-auto">
      {/* BEGIN: TopAppHeader */}
      <header className="bg-[#EA580C] text-white pt-3 pb-5 px-4 shadow-sm shrink-0" data-purpose="app-header">
        {/* Top Navigation Bar */}
        <div className="flex items-center h-12">
          <button
            aria-label="Go back"
            onClick={onBack}
            className="p-2 -ml-2 text-white hover:opacity-80 active:opacity-60 transition-opacity focus:outline-none cursor-pointer"
            type="button"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-[1.35rem] font-medium tracking-wide ml-3">Search by Route Number</h1>
        </div>

        {/* Search Bar Input Box */}
        <div className="mt-3 px-0.5">
          <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm flex items-center h-13 px-4 focus-within:ring-2 focus-within:ring-orange-300">
            <input
              className="w-full bg-transparent border-0 text-gray-700 dark:text-white text-base placeholder-gray-400 focus:ring-0 focus:outline-none p-0"
              id="route-search-input"
              placeholder="Search By Route Number (e.g. 100B, RT03, 222P)"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold px-2 py-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>
      {/* END: TopAppHeader */}

      {/* BEGIN: MainContent */}
      <main className="flex-1 flex flex-col bg-white dark:bg-slate-900">
        {/* Category Label Header */}
        <section className="px-5 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-base font-medium text-gray-800 dark:text-slate-200">Route Number</h2>
          <span className="text-xs text-gray-400">{filteredRoutes.length} available</span>
        </section>

        {/* Route List */}
        <section className="flex-1 divide-y divide-gray-100 dark:divide-slate-800" data-purpose="route-list">
          {filteredRoutes.map(item => (
            <div
              key={item.id}
              onClick={() => handleRouteClick(item.code)}
              className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-orange-50/60 dark:hover:bg-slate-800 active:bg-orange-100/60 transition-colors"
              data-purpose="route-item"
            >
              <div className="flex items-center">
                <div className="text-[#EA580C] mr-5 flex-shrink-0">
                  {/* Bus Front Icon */}
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect height="15" rx="2" width="16" x="4" y="3" />
                    <line x1="4" x2="20" y1="11" y2="11" />
                    <line x1="9" x2="9" y1="3" y2="11" />
                    <line x1="15" x2="15" y1="3" y2="11" />
                    <circle cx="7.5" cy="14.5" fill="currentColor" r="1" />
                    <circle cx="16.5" cy="14.5" fill="currentColor" r="1" />
                    <line x1="2" x2="22" y1="18" y2="18" />
                    <path d="M7 18l-1.5 3" />
                    <path d="M17 18l1.5 3" />
                  </svg>
                </div>
                <div>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
                    {item.code}
                  </span>
                  <p className="text-xs text-gray-400 dark:text-slate-400 truncate max-w-[240px]">
                    {item.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 font-medium">
                  {item.buses} active
                </span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            </div>
          ))}

          {filteredRoutes.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">
              No matching routes found for "{searchQuery}"
            </div>
          )}
        </section>
      </main>
      {/* END: MainContent */}

      {/* BEGIN: BottomIndicator */}
      <footer className="py-2.5 flex justify-center items-center bg-white dark:bg-slate-900 shrink-0" data-purpose="system-navigation-bar">
        <div className="w-36 h-1.5 bg-[#EA580C] rounded-full"></div>
      </footer>
    </div>
  );
};
