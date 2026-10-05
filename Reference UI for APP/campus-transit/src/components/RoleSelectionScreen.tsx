import React, { useState } from 'react';
import { ScreenType } from '../types';
import { ArrowLeft, Moon, Sun, Check, User, Bus, ArrowRight } from 'lucide-react';

interface RoleSelectionScreenProps {
  onNavigate: (screen: ScreenType) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSelectIdentity?: (role: 'passenger' | 'driver') => void;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  onNavigate,
  theme,
  onToggleTheme,
  onSelectIdentity,
}) => {
  const [selectedRole, setSelectedRole] = useState<'passenger' | 'driver'>('passenger');

  const handleContinue = () => {
    if (onSelectIdentity) {
      onSelectIdentity(selectedRole);
    }
    onNavigate('home');
  };

  return (
    <div className="w-full min-h-full flex flex-col justify-between bg-[#090F16] text-white select-none antialiased">
      {/* Navigation Bar */}
      <header
        id="top-navigation-bar"
        className="w-full bg-[#090F16]/90 backdrop-blur-md sticky top-0 z-50 border-b border-[#283545]/40"
      >
        <div className="flex items-center justify-between px-4 h-14">
          <button
            id="role-back-btn"
            aria-label="Go back"
            onClick={() => onNavigate('home')}
            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-300 active:bg-[#161C24] transition-colors cursor-pointer"
            type="button"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              CampusShuttle
            </span>
          </div>

          <button
            id="theme-toggle-btn"
            aria-label="Toggle Theme"
            onClick={onToggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-300 active:bg-[#161C24] transition-colors cursor-pointer"
            type="button"
          >
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-amber-500 fill-current" />
            ) : (
              <Sun className="w-5 h-5 text-amber-500 fill-current" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main id="role-selection-section" className="flex-1 flex flex-col justify-center px-6 py-6 w-full max-w-md mx-auto">
        {/* Header Title & Branding Section */}
        <div id="branding-header" className="text-center mb-9">
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1.5">
            CampusShuttle
          </h1>
          <p className="text-xs font-bold tracking-widest text-[#94A3B8] uppercase">
            College Transit Tracker
          </p>
          <p className="mt-4 text-sm text-slate-300 font-normal">
            Choose your transit identity to continue
          </p>
        </div>

        {/* Role Selection Cards */}
        <div id="role-cards-container" className="grid grid-cols-2 gap-4 w-full">
          {/* Passenger Card */}
          <button
            id="role-passenger-btn"
            onClick={() => setSelectedRole('passenger')}
            className={`relative flex flex-col items-center p-5 rounded-2xl bg-[#161C24] border-2 shadow-lg transition-all duration-150 focus:outline-none cursor-pointer ${
              selectedRole === 'passenger'
                ? 'border-[#EA580C] shadow-orange-950/40'
                : 'border-[#283545] opacity-75'
            }`}
            type="button"
          >
            {/* Selection Check Badge */}
            {selectedRole === 'passenger' && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#EA580C] flex items-center justify-center shadow">
                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
              </span>
            )}

            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-colors ${
                selectedRole === 'passenger'
                  ? 'bg-[#EA580C]/20 border border-[#EA580C]/40 text-[#EA580C]'
                  : 'bg-[#090F16] border border-[#283545] text-slate-400'
              }`}
            >
              <User className="w-10 h-10" />
            </div>

            <span className="text-base font-bold text-white tracking-wide">
              Passenger
            </span>
            <span className="text-xs text-slate-400 mt-1 font-medium text-center">
              Student / Faculty
            </span>
          </button>

          {/* Bus Driver Card */}
          <button
            id="role-driver-btn"
            onClick={() => setSelectedRole('driver')}
            className={`relative flex flex-col items-center p-5 rounded-2xl bg-[#161C24] border-2 shadow-lg transition-all duration-150 focus:outline-none cursor-pointer ${
              selectedRole === 'driver'
                ? 'border-[#EA580C] shadow-orange-950/40'
                : 'border-[#283545] opacity-75'
            }`}
            type="button"
          >
            {selectedRole === 'driver' && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#EA580C] flex items-center justify-center shadow">
                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
              </span>
            )}

            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-colors ${
                selectedRole === 'driver'
                  ? 'bg-[#EA580C]/20 border border-[#EA580C]/40 text-[#EA580C]'
                  : 'bg-[#090F16] border border-[#283545] text-slate-400'
              }`}
            >
              <Bus className="w-10 h-10" />
            </div>

            <span className="text-base font-bold text-slate-200 tracking-wide">
              Bus Driver
            </span>
            <span className="text-xs text-slate-400 mt-1 font-medium text-center">
              Transit Operator
            </span>
          </button>
        </div>

        {/* Supplementary Access Notice */}
        <div id="help-notice" className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            Need driver dispatch credentials?{' '}
            <span
              onClick={() => onNavigate('emergency-report')}
              className="text-[#EA580C] hover:underline font-semibold cursor-pointer ml-0.5"
            >
              Contact Transit Office
            </span>
          </p>
        </div>
      </main>

      {/* Bottom Sticky Action Button */}
      <footer
        id="footer-action-bar"
        className="w-full p-6 bg-[#090F16] border-t border-[#283545]/40 max-w-md mx-auto"
      >
        <button
          id="continue-button"
          onClick={handleContinue}
          className="w-full h-14 bg-[#EA580C] hover:bg-[#d94e07] active:bg-[#C2410C] text-white font-bold text-base tracking-wide rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
          type="button"
        >
          <span>
            Continue as {selectedRole === 'passenger' ? 'Passenger' : 'Bus Driver'}
          </span>
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </footer>
    </div>
  );
};
