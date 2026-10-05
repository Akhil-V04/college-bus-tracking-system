import React from 'react';
import { BusTripResult, ScreenType } from '../types';
import { ROUTE_RESULTS_3K } from '../data/mockData';
import { ArrowLeft, Clock, Bus, ArrowRight, Moon, Sun } from 'lucide-react';

interface RouteSearchResultsScreenProps {
  onNavigate: (screen: ScreenType) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSelectTrip: (trip: BusTripResult) => void;
  selectedRouteCode?: string;
}

export const RouteSearchResultsScreen: React.FC<RouteSearchResultsScreenProps> = ({
  onNavigate,
  theme,
  onToggleTheme,
  onSelectTrip,
  selectedRouteCode = 'RT03 (3K)',
}) => {
  const handleCardClick = (trip: BusTripResult) => {
    onSelectTrip(trip);
    onNavigate('bus-details');
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-[#090F16] text-[#DDE3EE] selection:bg-orange-950 select-none">
      {/* TopBar */}
      <header
        id="app-header"
        className="bg-[#EA580C] text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-md"
      >
        <div className="flex items-center space-x-4">
          <button
            id="results-back-btn"
            aria-label="Go Back"
            onClick={() => onNavigate('campus-search-menu')}
            className="focus:outline-none active:opacity-75 transition-opacity flex items-center justify-center cursor-pointer"
            type="button"
          >
            <ArrowLeft className="w-6 h-6 stroke-current stroke-[2.5]" />
          </button>
          <h1 className="text-xl font-bold tracking-wide text-white">
            {selectedRouteCode}
          </h1>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            id="theme-toggle"
            aria-label="Toggle Theme"
            onClick={onToggleTheme}
            className="p-1.5 rounded-full hover:bg-orange-700/60 active:opacity-75 transition-colors focus:outline-none flex items-center justify-center cursor-pointer"
            type="button"
          >
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-white" />
            ) : (
              <Sun className="w-5 h-5 text-white" />
            )}
          </button>
          <button
            id="clock-schedule-btn"
            aria-label="Schedule / Clock"
            onClick={() => onNavigate('stop-progression')}
            className="p-1.5 rounded-full hover:bg-orange-700/60 focus:outline-none active:opacity-75 transition-opacity flex items-center justify-center cursor-pointer"
            type="button"
          >
            <Clock className="w-5 h-5 stroke-[2]" />
          </button>
        </div>
      </header>

      {/* Result Summary */}
      <section id="results-count" className="py-3 px-4 text-center">
        <p className="text-[#859490] italic text-sm font-normal">
          {ROUTE_RESULTS_3K.length} Results Found
        </p>
      </section>

      {/* Route Cards List */}
      <main id="route-results-list" className="px-3.5 space-y-3.5 flex-1 overflow-y-auto pb-6">
        {ROUTE_RESULTS_3K.map((trip) => (
          <article
            key={trip.id}
            onClick={() => handleCardClick(trip)}
            className="bg-[#161C24] rounded-xl shadow-lg border border-[#242A33] hover:border-orange-500/40 active:scale-[0.99] transition-all cursor-pointer overflow-hidden group"
          >
            <div className="p-4">
              {/* Card Header Info */}
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center space-x-2">
                  <div className="text-[#EA580C]">
                    <Bus className="w-5 h-5 stroke-[1.8]" />
                  </div>
                  <span className="text-xs font-semibold tracking-wide text-white uppercase">
                    {trip.routeName}
                  </span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#242A33] text-[#EA580C] border border-orange-500/20">
                  {trip.routeCode}
                </span>
              </div>

              {/* Route Timeline Flow */}
              <div className="relative pl-6 py-1">
                {/* Vertical Timeline Line */}
                <div className="absolute left-[7px] top-[14px] bottom-[14px] w-[2px] bg-[#2F353E]"></div>

                {/* Start Stop */}
                <div className="flex items-start justify-between relative mb-2">
                  {/* Purple Circle Pin */}
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-[3px] border-[#A78BFA] bg-[#161C24]"></div>
                  <div className="pr-2">
                    <h2 className="text-sm font-bold text-white leading-tight">
                      {trip.startStop}
                    </h2>
                    <div className="text-xs italic text-[#859490] mt-1">
                      Stops <span className="font-normal not-italic text-[#DDE3EE]">{trip.startStopCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0 pt-0.5">
                    <ArrowRight className="w-4 h-4 text-[#859490] stroke-[2]" />
                    <span className="text-sm font-medium text-white w-12 text-right">
                      {trip.startTime}
                    </span>
                  </div>
                </div>

                {/* Destination Stop */}
                <div className="flex items-start justify-between relative mt-3">
                  {/* Red Circle Pin */}
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-[3px] border-[#EF4444] bg-[#161C24]"></div>
                  <div className="pr-2">
                    <h2 className="text-sm font-bold text-white leading-tight">
                      {trip.destStop}
                    </h2>
                    <span className="text-xs text-[#859490]">
                      {trip.destBlock}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0 pt-0.5">
                    <ArrowRight className="w-4 h-4 text-[#859490] stroke-[2]" />
                    <span className="text-sm font-medium text-white w-12 text-right">
                      {trip.destTime}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dashed Line with Duration Badge */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full dashed-line-divider"></div>
                </div>
                <div className="relative bg-[#161C24] px-3 flex items-center space-x-1.5 text-[#EA580C]">
                  <Clock className="w-4 h-4 stroke-[2]" />
                  <span className="text-xs font-bold tracking-wide">
                    {trip.duration}
                  </span>
                </div>
              </div>

              {/* Card Footer Details */}
              <div className="flex items-center justify-between text-xs pt-0.5 border-t border-[#242A33] mt-2">
                <span className="text-[#BBCAC6] font-semibold tracking-wider">
                  {trip.registrationNumber}
                </span>
                <span className="text-[#EA580C] font-bold tracking-wider uppercase text-[11px] bg-orange-500/10 px-2 py-0.5 rounded">
                  {trip.serviceType}
                </span>
              </div>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
};
