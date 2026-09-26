import React, { useState } from 'react';
import { RouteTrip } from '../../types';
import { RT03_STOPS } from '../../data/transitData';

interface BusDetailsScreenProps {
  trip?: RouteTrip;
  onBack: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
}

export const BusDetailsScreen: React.FC<BusDetailsScreenProps> = ({
  trip,
  onBack,
  onToggleTheme,
  isDark
}) => {
  const [activeTab, setActiveTab] = useState<'my-route' | 'full-route' | 'bus-info'>('my-route');
  const [isRotating, setIsRotating] = useState(false);
  const [remindMeOpen, setRemindMeOpen] = useState(false);
  const [selectedReminderStop, setSelectedReminderStop] = useState('CBS');
  const [reminderMinutes, setReminderMinutes] = useState(1);
  const [reminderActive, setReminderActive] = useState(false);
  const [punctualityModalOpen, setPunctualityModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentTrip = trip || {
    id: 'default-trip',
    routeCode: '3K',
    routeNumber: 'RT03 (3K)',
    terminalName: 'AFZALGANJ CENTRAL',
    origin: 'AFZALGANJ CENTRAL LIBRARY TWD CBS',
    destination: 'ECIL twd Nagaram',
    stopsCount: 15,
    departureTime: '13/09/2026 01:30 PM',
    arrivalTime: '13/09/2026 02:30 PM',
    duration: '01: 00 Hours',
    vehicleNumber: 'AP23Z0073',
    serviceType: 'METRO EXPRESS',
    depotName: 'MUSHIRABAD-II',
    driverName: 'Mr. P.SATAIAH',
    driverContact: '040-69440000 / 040-23450033',
    stops: RT03_STOPS,
    currentStopIndex: 1
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRefresh = () => {
    setIsRotating(true);
    setTimeout(() => {
      setIsRotating(false);
      showToast('Live telemetry refreshed: Bus is 350m ahead of CBS');
    }, 700);
  };

  const handleCreateReminder = () => {
    setRemindMeOpen(false);
    setReminderActive(true);
    showToast(`🔔 Reminder set: You will be alerted ${reminderMinutes} min before arriving at ${selectedReminderStop}`);
  };

  return (
    <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 min-h-full h-full flex flex-col font-sans select-none relative overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-4 right-4 z-50 bg-slate-900 text-white text-xs py-2.5 px-4 rounded-xl shadow-xl border border-slate-700 animate-bounce flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 font-bold text-orange-400">
            ✕
          </button>
        </div>
      )}

      {/* BEGIN: TopBar */}
      <header
        className="bg-[#EA580C] text-white pt-2 pb-0 flex flex-col shrink-0 z-30 shadow-sm"
        data-purpose="app-header"
      >
        {/* Status Bar Indicator */}
        <div className="px-4 pt-1 pb-1 flex justify-between items-center text-xs font-semibold tracking-wide text-white/95">
          <span>3:31</span>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold">5G</span>
            <div className="border border-white/80 rounded-[3px] px-1 py-[0.5px] text-[9px] font-bold leading-none">
              64
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center space-x-3">
            <button
              aria-label="Go Back"
              onClick={onBack}
              className="p-1 -ml-1 hover:bg-black/10 rounded-full transition-colors cursor-pointer"
              type="button"
            >
              <svg className="w-6 h-6 stroke-current stroke-[2.3]" fill="none" viewBox="0 0 24 24">
                <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="text-xl font-medium tracking-wide">Bus Details</h1>
          </div>

          <div className="flex items-center space-x-3.5">
            {/* Theme Toggle */}
            <button
              aria-label="Toggle Theme"
              onClick={onToggleTheme}
              className="p-1 hover:bg-black/10 rounded-full transition-colors cursor-pointer"
              type="button"
            >
              <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                />
              </svg>
            </button>

            {/* Share Action */}
            <button
              aria-label="Share"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'Campus Bus ' + currentTrip.routeNumber, url: window.location.href });
                } else {
                  showToast('Bus telemetry tracking link copied to clipboard!');
                }
              }}
              className="p-1 hover:bg-black/10 rounded-full transition-colors cursor-pointer"
              type="button"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
              </svg>
            </button>

            {/* Notification Bell (Triggers Remind Me Dialog) */}
            <button
              aria-label="Notification Alert"
              onClick={() => setRemindMeOpen(true)}
              className="p-1 hover:bg-black/10 rounded-full transition-colors relative cursor-pointer"
              type="button"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
              </svg>
              {reminderActive && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute top-0.5 right-0.5 ring-2 ring-[#EA580C]"></span>
              )}
            </button>
          </div>
        </div>

        {/* BEGIN: RouteTabs */}
        <nav
          className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex text-center font-medium text-xs tracking-wider shrink-0"
          data-purpose="route-tabs"
        >
          {/* Tab 1: MY ROUTE */}
          <button
            onClick={() => setActiveTab('my-route')}
            className={`flex-1 py-3 text-center relative transition-colors cursor-pointer ${
              activeTab === 'my-route'
                ? 'text-[#ea580c] font-bold'
                : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
            }`}
          >
            <span>MY ROUTE</span>
            {activeTab === 'my-route' && (
              <div className="absolute bottom-0 left-0 right-0 h-[3.5px] bg-[#ea580c] rounded-t-sm"></div>
            )}
          </button>

          {/* Tab 2: FULL ROUTE */}
          <button
            onClick={() => setActiveTab('full-route')}
            className={`flex-1 py-3 text-center relative transition-colors cursor-pointer ${
              activeTab === 'full-route'
                ? 'text-[#ea580c] font-bold'
                : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
            }`}
          >
            <span>FULL ROUTE</span>
            {activeTab === 'full-route' && (
              <div className="absolute bottom-0 left-0 right-0 h-[3.5px] bg-[#ea580c] rounded-t-sm"></div>
            )}
          </button>

          {/* Tab 3: BUS INFO */}
          <button
            onClick={() => setActiveTab('bus-info')}
            className={`flex-1 py-3 text-center relative transition-colors cursor-pointer ${
              activeTab === 'bus-info'
                ? 'text-[#ea580c] font-bold'
                : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
            }`}
          >
            <span>BUS INFO</span>
            {activeTab === 'bus-info' && (
              <div className="absolute bottom-0 left-0 right-0 h-[3.5px] bg-[#ea580c] rounded-t-sm"></div>
            )}
          </button>
        </nav>
        {/* END: RouteTabs */}
      </header>
      {/* END: TopBar */}

      {/* ============================================================== */}
      {/* TAB 1: MY ROUTE (Map Canvas + Pull-up Bottom Sheet) */}
      {/* ============================================================== */}
      {activeTab === 'my-route' && (
        <div className="relative flex-1 flex flex-col overflow-hidden bg-[#f4f1ea] dark:bg-slate-950">
          {/* Simulated Vector Map Area */}
          <div className="relative flex-1 overflow-hidden" data-purpose="map-view">
            <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <rect fill={isDark ? '#1e293b' : '#f4f1ea'} height="100%" width="100%" />

              {/* Water bodies */}
              <path d="M-20,180 Q60,190 70,250 T30,360 L-20,360 Z" fill={isDark ? '#0f172a' : '#b9ddf5'} />
              <path d="M190,40 Q215,60 220,105 T200,120 T180,100 Z" fill={isDark ? '#0f172a' : '#b9ddf5'} />
              <path d="M160,180 Q190,170 210,190 T220,225 T195,235 Z" fill={isDark ? '#1e3a5f' : '#c3e2f7'} opacity="0.8" />

              {/* Primary Yellow Highways */}
              <path d="M125,-10 L105,140 L70,380" fill="none" stroke="#fcd679" strokeWidth="8" />
              <path d="M125,-10 L105,140 L70,380" fill="none" stroke="#f3b83a" strokeWidth="6" />
              <path d="M-10,330 L110,340 L280,300 L390,285" fill="none" stroke="#fcd679" strokeWidth="7" />
              <path d="M-10,330 L110,340 L280,300 L390,285" fill="none" stroke="#f3b83a" strokeWidth="5" />
              <path d="M130,235 L260,330 L360,400" fill="none" stroke="#fcd679" strokeWidth="6" />

              {/* Secondary White Roads */}
              <path d="M-10,120 L350,110" fill="none" stroke={isDark ? '#334155' : '#ffffff'} strokeWidth="4" />
              <path d="M-10,80 L220,95 L400,200" fill="none" stroke={isDark ? '#334155' : '#ffffff'} strokeWidth="3" />
              <path d="M100,60 L240,160 L380,190" fill="none" stroke={isDark ? '#334155' : '#ffffff'} strokeWidth="3.5" />
              <path d="M220,170 L340,300" fill="none" stroke={isDark ? '#334155' : '#ffffff'} strokeWidth="3" />
              <path d="M30,220 L150,230 L230,280" fill="none" stroke={isDark ? '#334155' : '#ffffff'} strokeWidth="3" />

              {/* Blue Bus Route Trajectory */}
              <path
                d="M 50,330 L 100,310 L 160,265 L 214,214 L 248,208 L 285,142 L 315,120"
                fill="none"
                stroke="#EA580C"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="7"
              />
            </svg>

            {/* Location Labels on Map */}
            <div className="absolute text-[11px] font-bold text-gray-700 dark:text-slate-300 tracking-tight left-3 top-28 select-none">
              TIRUMALAGIRI
            </div>
            <div className="absolute text-[13px] font-bold text-gray-900 dark:text-white tracking-tight left-3 top-40 select-none">
              Secunderabad
            </div>
            <div className="absolute text-[10px] font-medium text-gray-500 left-44 top-5 select-none">
              YAPRAL
            </div>
            <div className="absolute text-[11px] italic font-semibold text-blue-800 dark:text-sky-400 left-36 top-32 select-none text-center">
              Safilguda Nadimi<br />Cheruvu
            </div>
            <div className="absolute text-[11px] font-bold text-gray-700 dark:text-slate-300 left-48 top-56 select-none">
              HABSIGUDA
            </div>
            <div className="absolute text-[11px] font-bold text-gray-600 dark:text-slate-400 left-72 top-40 select-none">
              MALLAPUR
            </div>
            <div className="absolute text-[11px] font-bold text-gray-700 dark:text-slate-300 left-48 top-44 select-none">
              NACHARAM
            </div>

            {/* Start Origin Pin */}
            <div className="absolute left-[50px] top-[330px] transform -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="w-5 h-5 rounded-full bg-emerald-600 border-2 border-white shadow-md flex items-center justify-center text-white text-[10px] font-bold">
                A
              </div>
            </div>

            {/* Waypoint Stop Dots along route */}
            <div className="absolute left-[100px] top-[310px] w-3.5 h-3.5 bg-[#ea580c] border-2 border-white rounded-full shadow-sm z-10 transform -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute left-[160px] top-[265px] w-3.5 h-3.5 bg-[#ea580c] border-2 border-white rounded-full shadow-sm z-10 transform -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute left-[248px] top-[208px] w-3.5 h-3.5 bg-[#ea580c] border-2 border-white rounded-full shadow-sm z-10 transform -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute left-[285px] top-[142px] w-3.5 h-3.5 bg-[#ea580c] border-2 border-white rounded-full shadow-sm z-10 transform -translate-x-1/2 -translate-y-1/2"></div>

            {/* Destination Red Pin */}
            <div className="absolute left-[315px] top-[120px] transform -translate-x-1/2 -translate-y-full z-10">
              <svg className="w-8 h-8 filter drop-shadow-md text-red-600 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </div>

            {/* Animated Live Bus Location Marker */}
            <div className="absolute left-[214px] top-[214px] transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#ea580c] border-2 border-white flex items-center justify-center shadow-lg animate-pulse text-white">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
                  </svg>
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white"></span>
              </div>
              <span className="bg-slate-900/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow mt-1">
                {currentTrip.vehicleNumber}
              </span>
            </div>

            {/* Floating Action Buttons */}
            {/* Refresh */}
            <button
              aria-label="Refresh route"
              onClick={handleRefresh}
              className="absolute top-4 right-4 w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border border-gray-100 dark:border-slate-700 text-[#ea580c] hover:bg-gray-50 active:scale-95 transition-transform z-20 cursor-pointer"
              type="button"
            >
              <svg
                className={`w-5 h-5 stroke-current ${isRotating ? 'animate-spin' : ''}`}
                fill="none"
                strokeWidth="2.3"
                viewBox="0 0 24 24"
              >
                <path
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Re-center */}
            <button
              aria-label="Current Location"
              onClick={() => showToast('Map re-centered to live bus GPS position')}
              className="absolute bottom-6 right-4 w-11 h-11 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border border-gray-100 dark:border-slate-700 text-[#ea580c] hover:bg-gray-50 active:scale-95 transition-transform z-20 cursor-pointer"
              type="button"
            >
              <svg className="w-5 h-5 fill-current transform rotate-45" viewBox="0 0 24 24">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
              </svg>
            </button>

            {/* Bus Indicator Badge Bottom Left */}
            <div className="absolute bottom-6 left-4 w-11 h-11 bg-[#ea580c] rounded-full flex items-center justify-center shadow-lg border-2 border-white text-white z-20">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
              </svg>
            </div>
          </div>

          {/* BEGIN: BottomSheetPanel */}
          <section
            className="bg-white dark:bg-slate-900 rounded-t-3xl pt-2 pb-5 px-5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-30 shrink-0 border-t border-gray-100 dark:border-slate-800"
            data-purpose="bottom-sheet"
          >
            {/* Drag Handle & Pull Indicator */}
            <div
              onClick={() => setActiveTab('full-route')}
              className="flex flex-col items-center justify-center pb-2 cursor-pointer"
            >
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mb-1.5"></div>
              <div className="flex items-center space-x-1.5 text-gray-500 dark:text-slate-400 text-xs font-normal select-none">
                <svg className="w-4 h-4 text-gray-600 dark:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="tracking-tight text-gray-600 dark:text-slate-300 font-medium">Pull Up to view more</span>
              </div>
            </div>

            {/* Route Timeline Stops */}
            <div className="mt-1 space-y-3.5 relative" data-purpose="stop-list">
              {/* Stop 1 (Current Active Stop) */}
              <div className="flex items-start relative">
                <div className="flex flex-col items-center mr-4 relative self-stretch">
                  <div className="w-1.5 h-3 bg-[#ea580c] rounded-t-sm"></div>
                  <div className="my-0.5 z-10">
                    <svg className="w-5 h-5 text-[#ea580c]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      <circle cx="12" cy="9" fill="white" r="2" />
                    </svg>
                  </div>
                  <div className="w-1 h-full bg-[#a0aab2] flex-1"></div>
                </div>

                <div className="flex-1 pt-0.5">
                  <h2 className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
                    LALAPET twd Moula Ali
                  </h2>
                  <div className="flex items-center space-x-8 mt-1.5 text-xs text-[#ea580c] font-semibold">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-gray-700 dark:text-slate-300">↳</span>
                      <span className="tracking-widest">15:22</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-gray-700 dark:text-slate-300">→]</span>
                      <span className="tracking-widest">15:22</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stop 2 (Next Stop) */}
              <div className="flex items-start relative">
                <div className="flex flex-col items-center mr-4 relative self-stretch">
                  <div className="w-4 h-4 rounded-full border-2 border-[#a0aab2] bg-white dark:bg-slate-800 z-10 my-0.5"></div>
                  <div className="w-1 h-5 bg-[#a0aab2]"></div>
                </div>
                <div className="flex-1 pt-0">
                  <h2 className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
                    INDUSTRIAL Estate twd Kushaiguda
                  </h2>
                  <div className="flex items-center space-x-8 mt-1.5 text-xs text-[#ea580c] font-semibold">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-gray-700 dark:text-slate-300">↳</span>
                      <span className="tracking-widest">--:--</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-gray-700 dark:text-slate-300">→]</span>
                      <span className="tracking-widest">--:--</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: FULL ROUTE (Vertical Stop Progression List) */}
      {/* ============================================================== */}
      {activeTab === 'full-route' && (
        <main
          className="flex-1 bg-white dark:bg-slate-900 relative pt-3 pb-8 px-4 overflow-y-auto"
          data-purpose="timeline-content"
        >
          {/* Floating Refresh */}
          <div className="flex justify-between items-center px-2 mb-3">
            <span className="text-xs text-gray-500 font-medium">All Route Stages ({currentTrip.stops.length})</span>
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-full bg-orange-50 dark:bg-orange-950/60 text-[#ea580c] cursor-pointer"
            >
              <svg className={`w-4 h-4 stroke-current stroke-2 ${isRotating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24">
                <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <section aria-label="Bus Stop Progression" className="relative pl-3 pr-2 space-y-4">
            {currentTrip.stops.map((stop, index) => {
              const isFirst = index === 0;
              const isCurrent = index === currentTrip.currentStopIndex;

              return (
                <div key={stop.id} className="relative flex items-start group">
                  {/* Vertical connecting line */}
                  {index < currentTrip.stops.length - 1 && (
                    <div
                      className={`absolute left-[13px] top-[18px] bottom-[-20px] w-[3px] z-0 ${
                        index < currentTrip.currentStopIndex ? 'bg-[#ea580c]' : 'bg-gray-300 dark:bg-slate-700'
                      }`}
                    ></div>
                  )}

                  {/* Marker Node */}
                  <div className="relative z-10 flex items-center justify-center w-[28px] h-[28px] -ml-[1px] mr-4 bg-white dark:bg-slate-900">
                    {isFirst ? (
                      <svg className="w-6 h-6 text-[#ea580c] fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    ) : isCurrent ? (
                      <div className="w-5 h-5 rounded-full bg-[#ea580c] flex items-center justify-center shadow text-white">
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                          <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-[16px] h-[16px] rounded-full border-[3px] border-gray-400 dark:border-slate-600 bg-white dark:bg-slate-900"></div>
                    )}
                  </div>

                  {/* Stop Details */}
                  <div className="flex-1 pt-0.5 pb-2">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                      {stop.name} <span className="text-xs font-normal text-gray-500">{stop.subText}</span>
                    </h2>

                    <div className="flex items-center space-x-8 mt-1 text-xs font-semibold text-[#ea580c]">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-gray-500">→</span>
                        <span>{stop.scheduledArrival}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-gray-500">[→</span>
                        <span>{stop.scheduledDeparture}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </main>
      )}

      {/* ============================================================== */}
      {/* TAB 3: BUS INFO (Telemetry Details & Punctuality) */}
      {/* ============================================================== */}
      {activeTab === 'bus-info' && (
        <main className="w-full flex-1 flex flex-col justify-between overflow-y-auto" data-purpose="bus-details-content">
          <div>
            {/* Route Quick Info Block */}
            <section className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-start justify-between">
                <div className="pt-1">
                  <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {currentTrip.routeCode}
                  </span>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <span className="block text-xs font-semibold text-[#ea580c]">Duration</span>
                    <span className="block text-sm font-medium text-[#ea580c]">{currentTrip.duration}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <button
                      aria-label="Refresh status"
                      onClick={handleRefresh}
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-xs active:scale-90 transition border border-orange-200 bg-orange-50 text-[#ea580c] cursor-pointer"
                      type="button"
                    >
                      <svg className={`w-5 h-5 fill-none stroke-current stroke-[2.2] ${isRotating ? 'animate-spin' : ''}`} viewBox="0 0 24 24">
                        <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <span className="text-xs font-medium text-gray-800 dark:text-slate-300 mt-1">Running</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Vehicle Registration and Category */}
            <section className="px-4 py-3.5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 tracking-wide">
                {currentTrip.vehicleNumber}
              </span>
              <span className="text-xs font-bold text-gray-800 dark:text-slate-200 tracking-wider">
                {currentTrip.serviceType}
              </span>
            </section>

            {/* Date of Trip & Depot Name */}
            <section className="px-4 py-3.5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900">
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 font-medium leading-none mb-1">Date of Trip</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Sunday, 13 Sep</span>
              </div>
              <div className="text-right">
                <span className="block text-xs text-gray-500 dark:text-gray-400 font-medium leading-none mb-1">Depot Name</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{currentTrip.depotName}</span>
              </div>
            </section>

            {/* Origin & Destination */}
            <section className="px-4 py-3.5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900">
              <div className="max-w-[55%]">
                <span className="block text-xs text-gray-500 dark:text-gray-400 font-medium leading-none mb-1">Origin</span>
                <p className="text-sm font-semibold text-gray-900 dark:text-white uppercase leading-snug">
                  {currentTrip.origin}
                </p>
              </div>
              <div className="text-right max-w-[42%]">
                <span className="block text-xs text-gray-500 dark:text-gray-400 font-medium leading-none mb-1">Destination</span>
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                  {currentTrip.destination}
                </p>
              </div>
            </section>

            {/* Scheduled Time Origin & Destination */}
            <section className="px-4 py-3.5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900">
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 font-medium leading-none mb-1">STD from Origin</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{currentTrip.departureTime}</span>
              </div>
              <div className="text-right">
                <span className="block text-xs text-gray-500 dark:text-gray-400 font-medium leading-none mb-1">STA at Destination</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{currentTrip.arrivalTime}</span>
              </div>
            </section>

            {/* Driver and Helpline Info (Grey shaded bar) */}
            <section className="bg-gray-100 dark:bg-slate-800 px-4 py-3 flex justify-between items-center text-xs">
              <div className="flex items-center space-x-1.5 truncate">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Driver Name</span>
                <span className="text-gray-900 dark:text-white font-semibold tracking-wide truncate">
                  {currentTrip.driverName}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-right">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Helpline</span>
                <div className="text-gray-900 dark:text-white font-semibold tracking-tight text-[11px] leading-tight">
                  <div>040-69440000 /</div>
                  <div>040-23450033</div>
                </div>
              </div>
            </section>
          </div>

          {/* Action Button */}
          <footer className="w-full p-4 bg-white dark:bg-slate-900 mt-4">
            <button
              onClick={() => setPunctualityModalOpen(true)}
              className="w-full py-4 px-4 bg-[#EA580C] hover:bg-orange-600 active:scale-[0.99] text-white font-medium text-base rounded-xl shadow-md transition text-center cursor-pointer"
              type="button"
            >
              Last Week Arrival Punctuality
            </button>
          </footer>
        </main>
      )}

      {/* ============================================================== */}
      {/* REMIND ME MODAL DIALOG (Screenshot 10 & HTML) */}
      {/* ============================================================== */}
      {remindMeOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            onClick={() => setRemindMeOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity"
          ></div>

          {/* Dialog Container */}
          <div
            aria-labelledby="modal-title"
            aria-modal="true"
            className="relative z-50 m-auto w-[88%] max-w-[340px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-5 flex flex-col border border-gray-100 dark:border-slate-700"
            role="dialog"
          >
            {/* Header */}
            <div className="flex items-center space-x-2.5 mb-4">
              <span className="text-xl flex items-center justify-center w-8 h-8 rounded-full bg-[#FFEDD5] text-[#EA580C]">
                🔔
              </span>
              <h2 className="text-lg font-bold text-[#1E2050] dark:text-white tracking-tight" id="modal-title">
                Remind Me
              </h2>
            </div>

            {/* Stop Selector Dropdown */}
            <div className="relative mb-5" data-purpose="stop-selector">
              <div className="relative">
                <select
                  value={selectedReminderStop}
                  onChange={e => setSelectedReminderStop(e.target.value)}
                  className="w-full appearance-none bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-800 dark:text-white font-medium text-base rounded-xl py-2.5 px-3.5 pr-10 shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="CBS">CBS</option>
                  <option value="VBIT Campus Gate">VBIT Campus Gate</option>
                  <option value="LALAPET twd Moula Ali">LALAPET twd Moula Ali</option>
                  <option value="INDUSTRIAL Estate twd Kushaiguda">INDUSTRIAL Estate</option>
                  <option value="ECIL Terminal">ECIL Terminal</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <svg className="w-5 h-5 stroke-current stroke-2" fill="none" viewBox="0 0 24 24">
                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Minute Slider Section */}
            <div className="mb-4 px-1" data-purpose="slider-container">
              <div className="relative flex items-center py-2">
                {/* Stepped tick markers behind slider */}
                <div aria-hidden="true" className="absolute inset-x-2 flex justify-between pointer-events-none px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-300"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-300"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-300"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-300"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-300"></div>
                </div>
                <input
                  aria-label="Minutes before stop alert"
                  className="w-full relative z-10 cursor-pointer accent-[#EA580C]"
                  id="minute-slider"
                  max="5"
                  min="1"
                  step="1"
                  type="range"
                  value={reminderMinutes}
                  onChange={e => setReminderMinutes(parseInt(e.target.value))}
                />
              </div>

              {/* Slider Range Labels */}
              <div className="flex justify-between items-center text-xs font-normal text-gray-500 mt-1">
                <span>1 min</span>
                <span>5 min</span>
              </div>
            </div>

            {/* Dynamic Info Banner */}
            <div className="rounded-xl py-2.5 px-3 text-center mb-5 border bg-[#FFF7ED] border-[#FED7AA] dark:bg-orange-950/60 dark:border-orange-900/60">
              <p className="text-xs text-gray-700 dark:text-slate-200 font-medium tracking-tight">
                Minutes before getting down at <span className="font-bold text-[#EA580C]">{selectedReminderStop}</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRemindMeOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl border border-[#EA580C] text-[#EA580C] font-medium text-sm hover:bg-orange-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReminder}
                className="w-full py-2.5 px-4 rounded-xl bg-[#EA580C] text-white font-medium text-sm shadow-md hover:bg-orange-600 active:scale-98 transition-all cursor-pointer"
                type="button"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PUNCTUALITY STATS MODAL */}
      {/* ============================================================== */}
      {punctualityModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setPunctualityModalOpen(false)} className="absolute inset-0 bg-black/50"></div>
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 border border-gray-100 dark:border-slate-700">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-gray-900 dark:text-white">Punctuality Score: 96.4%</h3>
              <button onClick={() => setPunctualityModalOpen(false)} className="text-gray-400 font-bold">
                ✕
              </button>
            </div>
            <div className="py-4 space-y-2 text-xs text-gray-600 dark:text-slate-300">
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-700/50">
                <span>Mon, 07 Sep:</span>
                <span className="font-bold text-emerald-600">On Time (+1 min)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-700/50">
                <span>Tue, 08 Sep:</span>
                <span className="font-bold text-emerald-600">On Time (0 min)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-700/50">
                <span>Wed, 09 Sep:</span>
                <span className="font-bold text-emerald-600">On Time (+2 min)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-700/50">
                <span>Thu, 10 Sep:</span>
                <span className="font-bold text-amber-600">Delayed (+6 min, traffic)</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Fri, 11 Sep:</span>
                <span className="font-bold text-emerald-600">On Time (+1 min)</span>
              </div>
            </div>
            <button
              onClick={() => setPunctualityModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#EA580C] text-white text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* BEGIN: BottomIndicator */}
      <footer className="bg-[#ea580c] h-3 w-full shrink-0" data-purpose="bottom-bar"></footer>
    </div>
  );
};
