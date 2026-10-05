import React from 'react';
import { RouteTrip, ScreenId } from '../../types';
import { ROUTE_TRIPS } from '../../data/transitData';

interface RouteResultsScreenProps {
  routeCode: string;
  onBack: () => void;
  onSelectTrip: (trip: RouteTrip) => void;
  onNavigate: (screen: ScreenId) => void;
  onToggleTheme: () => void;
}

export const RouteResultsScreen: React.FC<RouteResultsScreenProps> = ({
  routeCode = 'RT03 (3K)',
  onBack,
  onSelectTrip,
  onNavigate,
  onToggleTheme
}) => {
  return (
    <div className="bg-[#F2F4F7] dark:bg-slate-900 text-gray-800 dark:text-slate-100 min-h-full h-full flex flex-col antialiased select-none overflow-y-auto">
      {/* BEGIN: TopBar */}
      <header
        className="bg-[#EA580C] text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm"
        data-purpose="app-header"
      >
        <div className="flex items-center space-x-4">
          <button
            aria-label="Go Back"
            onClick={onBack}
            className="focus:outline-none active:opacity-75 transition-opacity cursor-pointer"
            type="button"
          >
            <svg className="w-6 h-6 stroke-current stroke-[2.5]" fill="none" viewBox="0 0 24 24">
              <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-xl font-medium tracking-wide">{routeCode}</h1>
        </div>

        <div className="flex items-center space-x-3 text-white">
          <button
            aria-label="Toggle Theme"
            onClick={onToggleTheme}
            className="focus:outline-none active:opacity-75 transition-opacity cursor-pointer"
            type="button"
          >
            <svg className="w-6 h-6 stroke-current stroke-[2]" fill="none" viewBox="0 0 24 24">
              <path
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            aria-label="Schedule / Clock"
            onClick={() => alert('Full daily timetable for ' + routeCode + ' is running normally')}
            className="focus:outline-none active:opacity-75 transition-opacity cursor-pointer"
            type="button"
          >
            <svg className="w-6 h-6 stroke-current stroke-[2]" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>
      {/* END: TopBar */}

      {/* BEGIN: ResultSummary */}
      <section className="py-3 px-4 text-center" data-purpose="results-count">
        <p className="text-gray-500 dark:text-slate-400 italic text-sm font-normal">
          {ROUTE_TRIPS.length} Results Found
        </p>
      </section>
      {/* END: ResultSummary */}

      {/* BEGIN: RouteCardsList */}
      <main className="px-3.5 space-y-3.5 flex-1 pb-6" data-purpose="route-results-list">
        {ROUTE_TRIPS.map(trip => (
          <article
            key={trip.id}
            onClick={() => {
              onSelectTrip(trip);
              onNavigate('bus-details');
            }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
            data-purpose="route-item-card"
          >
            <div className="p-4">
              {/* Card Header Info */}
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center space-x-2">
                  <div className="text-[#EA580C]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path
                        d="M8 17h8m-8-5h8m-9 9a2 2 0 01-2-2V7a3 3 0 013-3h12a3 3 0 013 3v12a2 2 0 01-2 2M5 17h.01M19 17h.01M5 10h14"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold tracking-wide text-gray-700 dark:text-slate-200 uppercase">
                    {trip.terminalName}
                  </span>
                </div>
                <span className="text-xs font-medium text-gray-600 dark:text-slate-300">{trip.routeCode}</span>
              </div>

              {/* Route Timeline Flow */}
              <div className="relative pl-6 py-1">
                {/* Vertical Timeline Connecting Line */}
                <div className="absolute left-[7px] top-[14px] bottom-[14px] w-[2px] bg-gray-300 dark:bg-slate-600"></div>

                {/* Start Stop */}
                <div className="flex items-start justify-between relative mb-3">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-[3px] border-[#6D28D9] bg-white dark:bg-slate-800"></div>
                  <div className="pr-2">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{trip.origin}</h2>
                    <div className="text-xs italic text-gray-400 mt-0.5">
                      Stops <span className="font-normal not-italic text-gray-600 dark:text-slate-300">{trip.stopsCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 pt-0.5">
                    <span className="text-gray-400 font-bold text-sm">→]</span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-200 w-12 text-right">
                      {trip.departureTime}
                    </span>
                  </div>
                </div>

                {/* Destination Stop */}
                <div className="flex items-start justify-between relative mt-3">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-[3px] border-[#DC2626] bg-white dark:bg-slate-800"></div>
                  <div className="pr-2">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{trip.destination}</h2>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{trip.destinationDetail}</span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 pt-0.5">
                    <span className="text-gray-400 font-bold text-sm">→]</span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-200 w-12 text-right">
                      {trip.arrivalTime}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dashed Line with Duration Badge */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-dashed border-[#EA580C]"></div>
                </div>
                <div className="relative bg-white dark:bg-slate-800 px-3 flex items-center space-x-1.5 text-[#EA580C]">
                  <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-xs font-semibold tracking-wide">{trip.duration}</span>
                </div>
              </div>

              {/* Card Footer Details */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <span className="text-gray-700 dark:text-slate-300 font-semibold tracking-wider">{trip.vehicleNumber}</span>
                <span className="text-[#EA580C] font-bold tracking-wider uppercase text-[11px] bg-orange-50 dark:bg-orange-950/70 px-2 py-0.5 rounded">
                  {trip.serviceType}
                </span>
              </div>
            </div>
          </article>
        ))}
      </main>
      {/* END: RouteCardsList */}
    </div>
  );
};
