import React, { useState } from 'react';
import { ScreenId } from '../../types';

interface DashboardScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onOpenFlagBus: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenAbout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigate,
  onOpenFlagBus,
  isDark,
  onToggleTheme,
  onOpenAbout
}) => {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const handleEnableLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationEnabled(true);
        },
        () => {
          setLocationEnabled(true); // gracefully acknowledge
        }
      );
    } else {
      setLocationEnabled(true);
    }
  };

  return (
    <div className="bg-[#f5f6f8] dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans min-h-full h-full flex flex-col justify-between antialiased select-none overflow-y-auto">
      {/* Top Container */}
      <div className="w-full flex-grow flex flex-col">
        {/* BEGIN: Header */}
        <header className="bg-[#EA580C] text-white pt-3 pb-3 px-4 shadow-sm sticky top-0 z-30" data-purpose="main-header">
          <div className="flex items-center justify-between">
            {/* Left Logo and App Name */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
              <div className="bg-white rounded-md p-1.5 w-10 h-10 flex items-center justify-center shadow-xs">
                <svg className="w-7 h-7 text-[#EA580C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M8 7h8m-8 4h8m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  <path d="M16 19v2m-8-2v2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">Campus Transit</span>
            </div>

            {/* Right Header Utility Icons */}
            <div className="flex items-center space-x-4 text-white">
              {/* Theme Toggle */}
              <button
                aria-label="Toggle Theme"
                className="p-1 hover:opacity-80 transition-opacity cursor-pointer"
                onClick={onToggleTheme}
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              </button>

              {/* Notification Bell */}
              <button
                aria-label="Notifications"
                className="p-1 hover:opacity-80 transition-opacity relative cursor-pointer"
                onClick={() => setNotificationOpen(prev => !prev)}
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                <span className="w-2 h-2 rounded-full bg-yellow-300 absolute top-1 right-1"></span>
              </button>

              {/* Chat / Support Icon */}
              <button
                aria-label="Feedback & Chat"
                className="p-1 hover:opacity-80 transition-opacity cursor-pointer"
                onClick={() => alert('Campus Transit Help Desk: Call 040-69440000 or message transit@campusfleet.edu')}
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>

              {/* Language / Web Icon */}
              <button
                aria-label="Change Language or Help"
                className="p-1 hover:opacity-80 transition-opacity cursor-pointer"
                onClick={() => alert('Language set to English (Default). Telugu & Hindi telemetry audio available on board.')}
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>
        {/* END: Header */}

        {/* Notifications Dropdown Toast */}
        {notificationOpen && (
          <div className="bg-orange-50 border-b border-orange-200 p-3 text-xs text-orange-950 flex items-center justify-between">
            <div>
              <p className="font-bold">Active Shuttle Notice:</p>
              <p>Evening shuttle RT03 departing VBIT Gate at 17:15. All routes on schedule.</p>
            </div>
            <button
              onClick={() => setNotificationOpen(false)}
              className="text-orange-700 font-bold ml-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* BEGIN: LocationBanner */}
        {!locationEnabled ? (
          <section
            className="bg-[#ffebee] dark:bg-rose-950/40 px-4 py-2.5 flex items-center justify-between border-b border-[#ffd9d9] dark:border-rose-900/50"
            data-purpose="location-status-banner"
          >
            <div className="flex items-center space-x-3 pr-2">
              <svg className="w-5 h-5 text-[#b71c1c] dark:text-rose-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  clipRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  fillRule="evenodd"
                />
              </svg>
              <p className="text-xs sm:text-sm font-medium text-[#b71c1c] dark:text-rose-300 leading-snug">
                Location sharing disabled. Tap here to enable location
              </p>
            </div>
            <button
              onClick={handleEnableLocation}
              className="text-xs sm:text-sm font-bold text-[#b71c1c] dark:text-rose-400 hover:underline flex-shrink-0 ml-1 cursor-pointer"
              type="button"
            >
              Enable
            </button>
          </section>
        ) : (
          <section className="bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 flex items-center justify-between border-b border-emerald-200 dark:border-emerald-900/50">
            <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Live GPS Active • Nearest: Lalapet Stop (120m)</span>
            </div>
          </section>
        )}
        {/* END: LocationBanner */}

        {/* BEGIN: ServiceMenu */}
        <main className="px-4 py-3 space-y-3 flex-grow max-w-xl mx-auto w-full" data-purpose="services-menu">
          {/* Item 1: Campus Express Services */}
          <button
            onClick={() => onNavigate('search-directory')}
            className="w-full touch-card bg-white dark:bg-slate-800 rounded-xl p-3.5 flex items-center justify-between border border-gray-100 dark:border-slate-700 shadow-xs hover:shadow transition-shadow text-left cursor-pointer active:scale-99"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] dark:bg-orange-950/60 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-[#EA580C]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                </svg>
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-white">Campus Express Services</span>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            </svg>
          </button>

          {/* Item 2: Route & Gate Services */}
          <button
            onClick={() => onNavigate('search-directory')}
            className="w-full touch-card bg-white dark:bg-slate-800 rounded-xl p-3.5 flex items-center justify-between border border-gray-100 dark:border-slate-700 shadow-xs hover:shadow transition-shadow text-left cursor-pointer active:scale-99"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] dark:bg-orange-950/60 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-[#EA580C]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z" />
                </svg>
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-white">Route &amp; Gate Services</span>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            </svg>
          </button>

          {/* Item 3: Hostel & Shift Services */}
          <button
            onClick={() => onNavigate('hostel-shift-services')}
            className="w-full touch-card bg-white dark:bg-slate-800 rounded-xl p-3.5 flex items-center justify-between border border-gray-100 dark:border-slate-700 shadow-xs hover:shadow transition-shadow text-left cursor-pointer active:scale-99"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] dark:bg-orange-950/60 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-[#EA580C]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
                </svg>
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-white">Hostel &amp; Shift Services</span>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            </svg>
          </button>

          {/* Item 4: Bus Stop Near Me */}
          <button
            onClick={() => onNavigate('nearby-stages')}
            className="w-full touch-card bg-white dark:bg-slate-800 rounded-xl p-3.5 flex items-center justify-between border border-gray-100 dark:border-slate-700 shadow-xs hover:shadow transition-shadow text-left cursor-pointer active:scale-99"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] dark:bg-orange-950/60 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-[#EA580C]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h3v8h2v-8h3c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 6h-6V4h6v4z" />
                </svg>
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-white">Bus Stop Near Me</span>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            </svg>
          </button>

          {/* Item 5: My Bus Pass / ID */}
          <button
            onClick={() => onNavigate('bus-pass')}
            className="w-full touch-card bg-white dark:bg-slate-800 rounded-xl p-3.5 flex items-center justify-between border border-gray-100 dark:border-slate-700 shadow-xs hover:shadow transition-shadow text-left cursor-pointer active:scale-99"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] dark:bg-orange-950/60 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-[#EA580C]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-9 7.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z" />
                </svg>
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-white">My Bus Pass / ID</span>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            </svg>
          </button>

          {/* Item 6: About Campus Fleet */}
          <button
            onClick={onOpenAbout}
            className="w-full touch-card bg-white dark:bg-slate-800 rounded-xl p-4 flex items-center justify-between border border-gray-100 dark:border-slate-700 shadow-xs hover:shadow transition-shadow text-left cursor-pointer active:scale-99"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-6 h-6 flex items-center justify-center text-slate-700 dark:text-slate-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-white">About Campus Fleet</span>
            </div>
          </button>
        </main>
        {/* END: ServiceMenu */}
      </div>
      {/* END: TopContainer */}

      {/* BEGIN: BottomSection */}
      <footer className="px-4 pb-6 pt-2 max-w-xl mx-auto w-full" data-purpose="action-buttons-and-branding">
        {/* Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Flag a Bus Button */}
          <button
            onClick={onOpenFlagBus}
            className="w-full py-3.5 px-4 bg-[#EA580C] hover:bg-[#c2410c] text-white font-semibold rounded-xl text-center shadow-sm active:scale-98 transition-all cursor-pointer"
            type="button"
          >
            Flag a Bus
          </button>

          {/* Emergency Button */}
          <button
            onClick={() => onNavigate('emergency-hub')}
            className="w-full py-3.5 px-4 bg-[#e84e55] hover:bg-[#d43f46] text-white font-semibold rounded-xl text-center shadow-sm active:scale-98 transition-all cursor-pointer"
            type="button"
          >
            Emergency?
          </button>
        </div>

        {/* Campus Fleet Branding / Powered By */}
        <div className="flex items-center justify-center space-x-1.5 text-slate-600 dark:text-slate-400 text-sm font-medium select-none">
          <span>Powered by</span>
          <span className="text-[#EA580C] font-extrabold tracking-wider text-base">CAMPUS</span>
          <span className="text-[#f27a25] font-serif font-bold text-base">Fleet</span>
        </div>
      </footer>
      {/* END: BottomSection */}
    </div>
  );
};
