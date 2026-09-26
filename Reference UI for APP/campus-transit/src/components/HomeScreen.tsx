import React, { useState } from 'react';
import { ScreenType } from '../types';
import { 
  Bus, 
  Plane, 
  Building2, 
  MapPin, 
  Ticket, 
  Info, 
  ChevronRight, 
  Moon, 
  Sun, 
  Bell, 
  MessageSquare, 
  Globe 
} from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (screen: ScreenType) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenPass: () => void;
  onOpenAbout: () => void;
  onOpenFlagBus: () => void;
  onOpenFeedback: () => void;
  onOpenLanguage: () => void;
  onOpenNotifications: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  theme,
  onToggleTheme,
  onOpenPass,
  onOpenAbout,
  onOpenFlagBus,
  onOpenFeedback,
  onOpenLanguage,
  onOpenNotifications,
}) => {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locatingStatus, setLocatingStatus] = useState<string | null>(null);

  const handleEnableLocation = () => {
    setLocatingStatus('Locating...');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationEnabled(true);
          setLocatingStatus('Location enabled!');
          setTimeout(() => setLocatingStatus(null), 3000);
        },
        () => {
          // Fallback simulation if running in restricted container/iframe
          setLocationEnabled(true);
          setLocatingStatus('Location enabled (Campus GPS)');
          setTimeout(() => setLocatingStatus(null), 3000);
        },
        { timeout: 5000 }
      );
    } else {
      setLocationEnabled(true);
      setLocatingStatus('Location enabled (Simulated)');
      setTimeout(() => setLocatingStatus(null), 3000);
    }
  };

  return (
    <div className="w-full flex-grow flex flex-col justify-between select-none bg-[#090D12] text-[#F8FAFC]">
      {/* Top Container */}
      <div className="w-full flex-grow flex flex-col">
        {/* Header */}
        <header
          id="main-header"
          className="bg-[#0F172A] border-b border-[#1E293B] text-white pt-3.5 pb-3 px-4 shadow-sm sticky top-0 z-30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-[#EA580C] rounded-md p-1.5 w-10 h-10 flex items-center justify-center shadow-xs">
                {/* Clean Transit Icon */}
                <Bus className="w-6 h-6 text-white stroke-[2.2]" />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#F8FAFC]">
                Campus Transit
              </span>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-300">
              <button
                id="toggle-theme-btn"
                aria-label="Toggle Theme"
                onClick={onToggleTheme}
                className="p-1.5 text-[#F97316] hover:opacity-80 active:scale-95 transition-all"
                type="button"
              >
                {theme === 'dark' ? (
                  <Moon className="w-5 h-5 fill-current" />
                ) : (
                  <Sun className="w-5 h-5 fill-current" />
                )}
              </button>
              <button
                id="header-notifications-btn"
                aria-label="Notifications"
                onClick={onOpenNotifications}
                className="p-1.5 hover:text-white active:scale-95 transition-opacity"
                type="button"
              >
                <Bell className="w-5 h-5" />
              </button>
              <button
                id="header-feedback-btn"
                aria-label="Feedback & Chat"
                onClick={onOpenFeedback}
                className="p-1.5 hover:text-white active:scale-95 transition-opacity"
                type="button"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
              <button
                id="header-language-btn"
                aria-label="Change Language or Help"
                onClick={onOpenLanguage}
                className="p-1.5 hover:text-white active:scale-95 transition-opacity"
                type="button"
              >
                <Globe className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Location Banner */}
        {!locationEnabled ? (
          <section
            id="location-status-banner"
            className="bg-[#3b1219] px-4 py-2.5 flex items-center justify-between border-b border-[#5c1d27]"
          >
            <div className="flex items-center space-x-3 pr-2">
              <MapPin className="w-5 h-5 text-[#ff8089] flex-shrink-0 fill-current" />
              <p className="text-xs sm:text-sm font-medium text-[#ffd0d4] leading-snug">
                Location sharing disabled. Tap here to enable location
              </p>
            </div>
            <button
              id="enable-location-btn"
              onClick={handleEnableLocation}
              className="text-xs sm:text-sm font-bold text-[#ff8089] hover:underline flex-shrink-0 ml-1 cursor-pointer"
              type="button"
            >
              {locatingStatus || 'Enable'}
            </button>
          </section>
        ) : (
          <section
            id="location-status-active-banner"
            className="bg-[#0e2722] px-4 py-2 flex items-center justify-between border-b border-[#145347] transition-all"
          >
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse"></span>
              <p className="text-xs font-semibold text-[#86efac]">
                GPS Active: Hyderabad Campus Center
              </p>
            </div>
            <button
              onClick={() => setLocationEnabled(false)}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-200"
            >
              Turn Off
            </button>
          </section>
        )}

        {/* Service Menu */}
        <main
          id="services-menu"
          className="px-4 py-4 space-y-3 flex-grow max-w-xl mx-auto w-full overflow-y-auto no-scrollbar"
        >
          {/* Item 1: Campus Express Services */}
          <button
            id="service-express-btn"
            onClick={() => onNavigate('campus-search-menu')}
            className="w-full text-left bg-[#161F2C] rounded-xl p-3.5 flex items-center justify-between border border-[#1E293B] shadow-sm hover:border-[#EA580C]/40 active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#EA580C]/15 flex items-center justify-center flex-shrink-0 border border-[#EA580C]/20">
                <Plane className="w-6 h-6 text-[#F97316] -rotate-45" />
              </div>
              <span className="text-base font-semibold text-[#F8FAFC] group-hover:text-white">
                Campus Express Services
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-[#F97316] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>

          {/* Item 2: Route & Gate Services */}
          <button
            id="service-route-gate-btn"
            onClick={() => onNavigate('route-results')}
            className="w-full text-left bg-[#161F2C] rounded-xl p-3.5 flex items-center justify-between border border-[#1E293B] shadow-sm hover:border-[#EA580C]/40 active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#EA580C]/15 flex items-center justify-center flex-shrink-0 border border-[#EA580C]/20">
                <Building2 className="w-6 h-6 text-[#F97316]" />
              </div>
              <span className="text-base font-semibold text-[#F8FAFC] group-hover:text-white">
                Route &amp; Gate Services
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-[#F97316] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>

          {/* Item 3: Hostel & Shift Services */}
          <button
            id="service-hostel-shift-btn"
            onClick={() => onNavigate('route-number-search')}
            className="w-full text-left bg-[#161F2C] rounded-xl p-3.5 flex items-center justify-between border border-[#1E293B] shadow-sm hover:border-[#EA580C]/40 active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#EA580C]/15 flex items-center justify-center flex-shrink-0 border border-[#EA580C]/20">
                <Bus className="w-6 h-6 text-[#F97316]" />
              </div>
              <span className="text-base font-semibold text-[#F8FAFC] group-hover:text-white">
                Hostel &amp; Shift Services
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-[#F97316] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>

          {/* Item 4: Bus Stop Near Me */}
          <button
            id="service-bus-stop-btn"
            onClick={() => onNavigate('station-search')}
            className="w-full text-left bg-[#161F2C] rounded-xl p-3.5 flex items-center justify-between border border-[#1E293B] shadow-sm hover:border-[#EA580C]/40 active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#EA580C]/15 flex items-center justify-center flex-shrink-0 border border-[#EA580C]/20">
                <MapPin className="w-6 h-6 text-[#F97316]" />
              </div>
              <span className="text-base font-semibold text-[#F8FAFC] group-hover:text-white">
                Bus Stop Near Me
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-[#F97316] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>

          {/* Item 5: My Bus Pass / ID */}
          <button
            id="service-bus-pass-btn"
            onClick={onOpenPass}
            className="w-full text-left bg-[#161F2C] rounded-xl p-3.5 flex items-center justify-between border border-[#1E293B] shadow-sm hover:border-[#EA580C]/40 active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#EA580C]/15 flex items-center justify-center flex-shrink-0 border border-[#EA580C]/20">
                <Ticket className="w-6 h-6 text-[#F97316]" />
              </div>
              <span className="text-base font-semibold text-[#F8FAFC] group-hover:text-white">
                My Bus Pass / ID
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-[#F97316] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>

          {/* Item 6: About Campus Fleet */}
          <button
            id="service-about-fleet-btn"
            onClick={onOpenAbout}
            className="w-full text-left bg-[#161F2C] rounded-xl p-4 flex items-center justify-between border border-[#1E293B] shadow-sm hover:border-[#EA580C]/40 active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-6 h-6 flex items-center justify-center text-[#F97316]">
                <Info className="w-6 h-6" />
              </div>
              <span className="text-base font-semibold text-[#F8FAFC] group-hover:text-white">
                About Campus Fleet
              </span>
            </div>
          </button>
        </main>
      </div>

      {/* Bottom Section */}
      <footer
        id="action-buttons-and-branding"
        className="px-4 pb-6 pt-2 max-w-xl mx-auto w-full"
      >
        {/* Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Flag a Bus Button */}
          <button
            id="flag-bus-btn"
            onClick={onOpenFlagBus}
            className="w-full py-3.5 px-4 bg-[#EA580C] hover:bg-[#d94e07] text-white font-semibold rounded-xl text-center shadow-sm active:bg-[#c2410c] active:scale-[0.98] transition-all cursor-pointer"
            type="button"
          >
            Flag a Bus
          </button>

          {/* Emergency Button */}
          <button
            id="emergency-btn"
            onClick={() => onNavigate('emergency-report')}
            className="w-full py-3.5 px-4 bg-[#e84e55] hover:bg-[#dc3b43] text-white font-semibold rounded-xl text-center shadow-sm active:bg-[#d43f46] active:scale-[0.98] transition-all cursor-pointer"
            type="button"
          >
            Emergency?
          </button>
        </div>

        {/* Campus Fleet Branding / Powered By */}
        <div className="flex items-center justify-center space-x-1.5 text-slate-400 text-sm font-medium select-none">
          <span>Powered by</span>
          <span className="text-[#F97316] font-extrabold tracking-wider text-base">
            CAMPUS
          </span>
          <span className="text-[#f27a25] font-serif font-bold text-base">
            Fleet
          </span>
        </div>
      </footer>
    </div>
  );
};
