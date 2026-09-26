import React, { useState } from 'react';
import { ScreenId } from '../../types';
import { RECENT_SEARCHES } from '../../data/transitData';

interface SearchFromToScreenProps {
  onBack: () => void;
  onSearch: (from: string, to: string) => void;
  onNavigate: (screen: ScreenId) => void;
}

export const SearchFromToScreen: React.FC<SearchFromToScreenProps> = ({
  onBack,
  onSearch,
  onNavigate
}) => {
  const [fromLocation, setFromLocation] = useState('Central Station');
  const [toLocation, setToLocation] = useState('Main Campus');

  const handleSwap = () => {
    const temp = fromLocation;
    setFromLocation(toLocation);
    setToLocation(temp);
  };

  const handleSearchSubmit = () => {
    onSearch(fromLocation, toLocation);
    onNavigate('route-results');
  };

  const handleSelectRecent = (from: string, to: string) => {
    setFromLocation(from);
    setToLocation(to);
    onSearch(from, to);
    onNavigate('route-results');
  };

  return (
    <div className="bg-white dark:bg-slate-900 min-h-full h-full flex flex-col text-slate-800 dark:text-slate-100 antialiased select-none overflow-y-auto">
      {/* BEGIN: TopBar */}
      <header className="bg-[#ea580c] text-white sticky top-0 z-30 shadow-sm" data-purpose="app-header">
        {/* Status bar area spacer for iOS Safe Area */}
        <div className="h-4 w-full"></div>
        {/* Main Navigation Row */}
        <div className="flex items-center px-4 pb-4 pt-1">
          <button
            aria-label="Go back"
            onClick={onBack}
            className="p-1 -ml-1 mr-3 rounded-full active:bg-orange-700 transition-colors inline-flex items-center justify-center focus:outline-none cursor-pointer"
            data-purpose="back-button"
            type="button"
          >
            <svg
              className="h-6 w-6 text-white stroke-[2.5]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-xl font-medium tracking-normal text-white">
            Search From and To
          </h1>
        </div>
      </header>
      {/* END: TopBar */}

      {/* BEGIN: MainContent */}
      <main className="flex-1 px-4 pt-6 pb-8 flex flex-col max-w-md mx-auto w-full">
        {/* BEGIN: SearchCard */}
        <section className="relative mb-6" data-purpose="search-card-container">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] p-5 flex items-stretch divide-x divide-gray-100 dark:divide-slate-700">
            {/* From Field (Left Side) */}
            <div className="flex-1 pr-4 min-w-0" data-purpose="from-field">
              <label className="block text-xs font-normal text-gray-500 dark:text-gray-400 mb-1 tracking-wide" htmlFor="origin-input">
                From
              </label>
              <input
                className="w-full p-0 border-0 text-base font-semibold text-gray-700 dark:text-white focus:ring-0 truncate bg-transparent outline-none"
                id="origin-input"
                name="origin"
                placeholder="Enter Origin"
                type="text"
                value={fromLocation}
                onChange={e => setFromLocation(e.target.value)}
              />
            </div>

            {/* To Field (Right Side) */}
            <div className="flex-1 pl-6 min-w-0" data-purpose="to-field">
              <label className="block text-xs font-normal text-gray-500 dark:text-gray-400 mb-1 tracking-wide" htmlFor="destination-input">
                To
              </label>
              <input
                className="w-full p-0 border-0 text-base font-semibold text-gray-700 dark:text-white focus:ring-0 truncate bg-transparent outline-none"
                id="destination-input"
                name="destination"
                placeholder="Enter Destination"
                type="text"
                value={toLocation}
                onChange={e => setToLocation(e.target.value)}
              />
            </div>
          </div>

          {/* Floating Swap Icon in the absolute center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <button
              aria-label="Swap origin and destination"
              onClick={handleSwap}
              className="w-10 h-10 rounded-full bg-[#ea580c] text-white flex items-center justify-center shadow-md active:scale-95 transition-transform hover:bg-orange-600 focus:outline-none cursor-pointer"
              data-purpose="swap-button"
              id="swap-locations-btn"
              type="button"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" />
              </svg>
            </button>
          </div>
        </section>
        {/* END: SearchCard */}

        {/* BEGIN: SearchButton */}
        <div className="mb-7">
          <button
            onClick={handleSearchSubmit}
            className="w-full bg-[#ea580c] hover:bg-orange-600 active:bg-orange-700 active:scale-[0.99] text-white font-medium text-lg py-3.5 rounded-xl shadow-sm transition-all focus:outline-none flex items-center justify-center tracking-normal cursor-pointer"
            data-purpose="search-bus-cta"
            type="button"
          >
            Search Bus
          </button>
        </div>
        {/* END: SearchButton */}

        {/* BEGIN: RecentTripHistory */}
        <section className="mt-1" data-purpose="recent-trip-history">
          <h2 className="text-sm font-normal text-slate-800 dark:text-slate-200 mb-4 tracking-normal">
            Recent Trip History
          </h2>

          <div className="flex flex-col gap-2.5">
            {RECENT_SEARCHES.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectRecent(item.from, item.to)}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors group cursor-pointer"
                data-purpose="history-pill"
                type="button"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </span>
                  <div className="text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{item.from}</span>
                    <span className="text-slate-400 mx-1.5">→</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{item.to}</span>
                  </div>
                </div>
                <svg className="h-4 w-4 text-slate-300 group-hover:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            ))}
          </div>
        </section>
        {/* END: RecentTripHistory */}
      </main>
      {/* END: MainContent */}

      {/* BEGIN: BottomNavigationSafeBar */}
      <footer className="h-4 w-full bg-[#ea580c] mt-auto"></footer>
    </div>
  );
};
