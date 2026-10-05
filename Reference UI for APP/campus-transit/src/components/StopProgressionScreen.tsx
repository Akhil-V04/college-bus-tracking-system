import React, { useState } from 'react';
import { ScreenType } from '../types';
import { FULL_ROUTE_STOPS } from '../data/mockData';
import { ArrowLeft, Moon, Sun, Share2, Bell, RotateCw, Bus } from 'lucide-react';

interface StopProgressionScreenProps {
  onNavigate: (screen: ScreenType) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenRemindMe: () => void;
  onOpenShareToast: () => void;
}

export const StopProgressionScreen: React.FC<StopProgressionScreenProps> = ({
  onNavigate,
  theme,
  onToggleTheme,
  onOpenRemindMe,
  onOpenShareToast,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'MY ROUTE' | 'FULL ROUTE' | 'BUS INFO'>('FULL ROUTE');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 700);
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-[#090F16] text-[#F8FAFC] antialiased select-none">
      {/* Top Status Bar */}
      <header className="bg-[#EA580C] px-6 pt-3 pb-1 flex items-center justify-between text-xs font-semibold text-white">
        <span>3:31</span>
        <div className="flex items-center space-x-2">
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z" />
          </svg>
          <span className="text-[10px] font-bold tracking-tight">5G</span>
          <div className="flex items-center">
            <div className="w-5 h-2.5 border border-white rounded-sm p-0.5 flex items-center">
              <div className="bg-white h-full w-[64%] rounded-2xs"></div>
            </div>
            <div className="w-0.5 h-1 bg-white rounded-r-xs ml-px"></div>
          </div>
        </div>
      </header>

      {/* Main App Bar */}
      <nav className="bg-[#EA580C] text-white px-4 py-3.5 flex items-center justify-between shadow-md relative z-20">
        <div className="flex items-center space-x-3">
          <button
            id="progression-back-btn"
            aria-label="Go Back"
            onClick={() => onNavigate('bus-details')}
            className="p-1 -ml-1 text-white hover:text-orange-100 transition cursor-pointer"
            type="button"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
          </button>
          <h1 className="text-xl font-bold tracking-wide">Stop Progression</h1>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="progression-theme-btn"
            aria-label="Toggle Theme"
            onClick={onToggleTheme}
            className="p-1.5 rounded-full hover:bg-[#C2410C] text-white transition cursor-pointer"
            type="button"
          >
            {theme === 'dark' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>
          <button
            id="progression-share-btn"
            aria-label="Share Route"
            onClick={onOpenShareToast}
            className="p-1.5 rounded-full hover:bg-[#C2410C] text-white transition cursor-pointer"
            type="button"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            id="progression-remind-btn"
            aria-label="Notifications"
            onClick={onOpenRemindMe}
            className="p-1.5 rounded-full hover:bg-[#C2410C] text-amber-200 transition cursor-pointer"
            type="button"
          >
            <Bell className="w-5 h-5 fill-current" />
          </button>
        </div>
      </nav>

      {/* Segment Tabs */}
      <section className="bg-[#0E141C] border-b border-[#1E293B] flex items-center justify-between text-xs tracking-wider uppercase font-semibold text-[#64748B] px-4 shrink-0">
        <button
          onClick={() => {
            setActiveTab('MY ROUTE');
            onNavigate('bus-details');
          }}
          className="py-3.5 px-2 hover:text-slate-300 transition-colors"
        >
          MY ROUTE
        </button>
        <button
          onClick={() => setActiveTab('FULL ROUTE')}
          className="py-3.5 px-2 text-[#EA580C] border-b-2 border-[#EA580C] font-bold"
        >
          FULL ROUTE
        </button>
        <button
          onClick={() => {
            setActiveTab('BUS INFO');
            onNavigate('bus-details');
          }}
          className="py-3.5 px-2 hover:text-slate-300 transition-colors"
        >
          BUS INFO
        </button>
      </section>

      {/* Main Progression Sheet */}
      <main className="flex-1 bg-[#090F16] relative px-4 pt-3 pb-24 overflow-y-auto">
        {/* Card Sheet Container */}
        <div className="bg-[#0E141C] border border-[#1E293B] rounded-t-3xl shadow-xl p-4 relative">
          {/* Drag Handle */}
          <div className="w-12 h-1 bg-[#334155] rounded-full mx-auto mb-4"></div>

          {/* Live Refresh Floating Control */}
          <div className="absolute right-5 top-4">
            <button
              id="refresh-stops-btn"
              aria-label="Refresh route"
              onClick={handleRefresh}
              className="w-9 h-9 rounded-full bg-[#151D28] border border-[#1E293B] text-[#14B8A6] flex items-center justify-center hover:bg-[#1E293B] transition shadow-md cursor-pointer"
              type="button"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Route Progression Timeline */}
          <section className="relative ml-2" id="route-timeline">
            {/* Continuous Vertical Track Line */}
            <div className="absolute left-[13px] top-4 bottom-8 w-[3px] bg-[#334155] rounded-full z-0"></div>
            {/* Completed Segment Track Overlay */}
            <div className="absolute left-[13px] top-4 h-[75px] w-[3px] bg-[#14B8A6] z-0"></div>

            {/* Stop Items */}
            <div className="space-y-6 relative z-10 pt-1">
              {FULL_ROUTE_STOPS.map((stop) => {
                const isLive = stop.isLive;
                const isPassed = stop.status === 'passed';

                return (
                  <article
                    key={stop.id}
                    className={`flex items-start ${isLive ? 'relative' : ''}`}
                  >
                    {/* Node Marker */}
                    <div className="w-7 flex justify-center mr-3 shrink-0">
                      {isLive ? (
                        <div className="w-7 h-7 rounded-full bg-[#EA580C] shadow-lg shadow-orange-950/60 border-2 border-[#0E141C] flex items-center justify-center text-white ring-2 ring-[#EA580C]/40 -mt-1">
                          <Bus className="w-3.5 h-3.5 fill-current" />
                        </div>
                      ) : isPassed ? (
                        <div className="w-4 h-4 rounded-full border-[3px] border-[#14B8A6] bg-[#0E141C] mt-0.5"></div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border-[3px] border-[#64748B] bg-[#0E141C] mt-0.5"></div>
                      )}
                    </div>

                    {/* Stop Meta & Timings */}
                    <div className="flex-1 pr-4">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <h2 className="text-sm font-bold tracking-tight text-[#F8FAFC]">
                          {stop.name}
                        </h2>
                        {isLive && (
                          <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-[#EA580C]/20 text-[#EA580C] border border-[#EA580C]/30">
                            LIVE NOW
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-6 mt-1.5 text-xs font-mono">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[12px] text-[#14B8A6]">➔</span>
                          <span className={isPassed ? 'text-[#14B8A6] font-medium' : 'text-[#64748B]'}>
                            {stop.scheduledArrival || '--:--'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[12px] text-[#14B8A6]">➔</span>
                          <span className={isPassed ? 'text-[#14B8A6] font-medium' : 'text-[#64748B]'}>
                            {stop.scheduledDeparture || '--:--'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Nav Dock */}
      <footer className="sticky bottom-0 left-0 right-0 bg-[#0E141C] border-t border-[#1E293B] pt-2.5 pb-4 px-6 z-30">
        <div className="flex items-center justify-between max-w-sm mx-auto text-xs text-[#64748B]">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C] animate-pulse"></span>
            <span className="text-[#F8FAFC] font-bold">Bus 14228</span>
          </div>
          <div className="text-right font-medium">
            <span className="text-[#14B8A6] font-semibold">Next:</span> Chadarghat (4 min)
          </div>
        </div>
        <div className="w-32 h-1 bg-[#334155] rounded-full mx-auto mt-2.5"></div>
      </footer>
    </div>
  );
};
