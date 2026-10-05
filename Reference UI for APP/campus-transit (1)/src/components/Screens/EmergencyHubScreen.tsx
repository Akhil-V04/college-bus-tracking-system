import React from 'react';
import { ScreenId } from '../../types';

interface EmergencyHubScreenProps {
  onBack: () => void;
  onSelectOption: (optionId: string) => void;
  onNavigate: (screen: ScreenId) => void;
}

export const EmergencyHubScreen: React.FC<EmergencyHubScreenProps> = ({
  onBack,
  onSelectOption,
  onNavigate
}) => {
  const emergencyOptions = [
    {
      id: 'women-safety',
      title: 'Women Safety',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="7.5" r="2.5" stroke="#EA580C" strokeWidth="1.6" />
          <path
            d="M8.5 7.5c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5v2.5c0 1.5-1 3-3.5 3s-3.5-1.5-3.5-3v-2.5z"
            stroke="#EA580C"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
          <path d="M5.5 14.5c1.5 1 3.5 1.5 6.5 1.5 1.5 0 3-.2 4-.6" stroke="#F97316" strokeLinecap="round" strokeWidth="1.6" />
          <path d="M5 14c-.6.6-1 1.4-1 2.2 0 1.8 1.5 3.3 3.3 3.3h7.2c2 0 3.5-.8 4.5-2.5" stroke="#F97316" strokeLinecap="round" strokeWidth="1.6" />
        </svg>
      )
    },
    {
      id: 'report-breakdown',
      title: 'Report Breakdown',
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24">
          <rect height="13" rx="2" stroke="#EA580C" strokeWidth="1.6" width="11" x="4" y="6" />
          <line stroke="#EA580C" strokeWidth="1.6" x1="4" x2="15" y1="10" y2="10" />
          <line stroke="#EA580C" strokeWidth="1.6" x1="9.5" x2="9.5" y1="6" y2="10" />
          <circle cx="6.5" cy="19" fill="#EA580C" r="1" />
          <circle cx="12.5" cy="19" fill="#EA580C" r="1" />
          <path d="M17.5 13c-.3-.8-.9-1.2-1.7-1.1" stroke="#F97316" strokeLinecap="round" strokeWidth="1.5" />
          <path d="M18.5 10c.8-.5 1.8-.2 2.2.5.4.6.2 1.5-.4 1.8.6.2 1 .8 1 1.5 0 .8-.7 1.5-1.5 1.5h-1.5" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      )
    },
    {
      id: 'medical-assistance',
      title: 'Medical Assistance',
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24">
          <rect height="13" rx="2.5" stroke="#EA580C" strokeWidth="1.6" width="18" x="3" y="7" />
          <path d="M8 7V5.5C8 4.7 8.7 4 9.5 4h5c.8 0 1.5.7 1.5 1.5V7" stroke="#F97316" strokeLinecap="round" strokeWidth="1.6" />
          <circle cx="12" cy="13.5" r="4.2" stroke="#EA580C" strokeWidth="1.4" />
          <path d="M12 11.5v4M10 13.5h4" stroke="#EA580C" strokeLinecap="round" strokeWidth="1.6" />
        </svg>
      )
    },
    {
      id: 'report-accident',
      title: 'Report Accident',
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24">
          <rect height="12" rx="2" stroke="#EA580C" strokeWidth="1.6" width="13" x="4.5" y="7" />
          <line stroke="#EA580C" strokeWidth="1.6" x1="4.5" x2="17.5" y1="11" y2="11" />
          <line stroke="#EA580C" strokeWidth="1.6" x1="11" x2="11" y1="7" y2="11" />
          <circle cx="7.5" cy="15.5" fill="#EA580C" r="0.8" />
          <circle cx="14.5" cy="15.5" fill="#EA580C" r="0.8" />
          <path d="M7 19v1M15 19v1" stroke="#EA580C" strokeLinecap="round" strokeWidth="1.6" />
          <path d="M16 5l1.5-2.5M19 6.5l2.5-1M18.5 9l2.5 1" stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      )
    }
  ];

  const handleCardClick = (id: string) => {
    onSelectOption(id);
    onNavigate('report-accident');
  };

  return (
    <div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 min-h-full h-full flex flex-col antialiased select-none overflow-y-auto">
      {/* BEGIN: MainHeader */}
      <header
        className="bg-[#EA580C] text-white px-4 pt-10 pb-4 shadow-sm flex items-center gap-4 sticky top-0 z-20"
        data-purpose="app-header"
      >
        <button
          aria-label="Go Back"
          onClick={onBack}
          className="p-1 -ml-1 text-white hover:text-white/80 active:opacity-70 transition-opacity focus:outline-none cursor-pointer"
          type="button"
        >
          <svg className="w-6 h-6 stroke-current" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M19 12H5m7 7-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold tracking-wide">Emergency</h1>
      </header>
      {/* END: MainHeader */}

      {/* BEGIN: MainContent */}
      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 px-1">
          Select incident category for immediate priority response from Campus Security &amp; Quick Reaction Team.
        </p>

        {/* Grid containing the 4 emergency incident options */}
        <div className="grid grid-cols-2 gap-4" data-purpose="emergency-options-grid">
          {emergencyOptions.map(option => (
            <button
              key={option.id}
              onClick={() => handleCardClick(option.id)}
              className="flex flex-col justify-between p-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl min-h-[145px] hover:border-orange-300 dark:hover:border-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-xs hover:shadow active:scale-98 transition-all text-left cursor-pointer"
            >
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-[#FFF7ED] dark:bg-orange-950/70">
                {option.icon}
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-white leading-snug">
                {option.title}
              </span>
            </button>
          ))}
        </div>

        {/* 24/7 Helpline Card */}
        <div className="mt-8 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">
              SOS
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-900 dark:text-red-300">Direct Campus Hotline</h3>
              <p className="text-xs text-red-700 dark:text-red-400">Available 24x7 for all faculty, students, and drivers</p>
            </div>
          </div>
          <div className="mt-3 flex space-x-2">
            <a
              href="tel:04069440000"
              className="flex-1 py-2 text-center rounded-lg bg-red-600 text-white font-bold text-xs shadow hover:bg-red-700 transition"
            >
              Call 040-69440000
            </a>
          </div>
        </div>
      </main>
      {/* END: MainContent */}

      {/* BEGIN: BottomIndicator */}
      <footer className="pb-3 flex justify-center w-full mt-auto" data-purpose="home-indicator">
        <div className="w-32 h-1 bg-[#EA580C]/60 rounded-full"></div>
      </footer>
    </div>
  );
};
