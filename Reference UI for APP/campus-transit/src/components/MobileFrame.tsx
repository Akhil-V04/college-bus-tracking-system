import React from 'react';
import { ScreenType } from '../types';

interface MobileFrameProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  children: React.ReactNode;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  currentScreen,
  onNavigate,
  children,
  theme,
  onToggleTheme,
}) => {
  const [currentTime, setCurrentTime] = React.useState('3:31');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours() % 12 || 12;
      const mins = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${mins}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-[#06090E]' : 'bg-[#F1F5F9]'} flex flex-col items-center justify-start sm:py-4 transition-colors duration-200`}>
      {/* Desktop Quick Navigation Toolbar */}
      <aside aria-label="Screen Quick Switcher" className="hidden lg:flex items-center gap-2 mb-3 px-4 py-2 bg-[#121820] border border-[#242A33] rounded-2xl shadow-xl text-xs overflow-x-auto max-w-4xl z-40">
        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] mr-1">
          Screens:
        </span>
        <button
          onClick={() => onNavigate('home')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            currentScreen === 'home' ? 'bg-[#EA580C] text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          1. Dashboard
        </button>
        <button
          onClick={() => onNavigate('campus-search-menu')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            currentScreen === 'campus-search-menu' ? 'bg-[#EA580C] text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          2. Search Menu
        </button>
        <button
          onClick={() => onNavigate('search-from-to')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            currentScreen === 'search-from-to' ? 'bg-[#EA580C] text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          3. From/To Search
        </button>
        <button
          onClick={() => onNavigate('station-search')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            currentScreen === 'station-search' ? 'bg-[#EA580C] text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          4. Station Search + Keypad
        </button>
        <button
          onClick={() => onNavigate('search-route-number')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            currentScreen === 'search-route-number' ? 'bg-[#EA580C] text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          5. Route Numbers
        </button>
        <button
          onClick={() => onNavigate('route-results')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            currentScreen === 'route-results' ? 'bg-[#EA580C] text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          6. RT03 Results
        </button>
        <button
          onClick={() => onNavigate('bus-details')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            currentScreen === 'bus-details' ? 'bg-[#EA580C] text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          7. Bus Details & Maps
        </button>
        <button
          onClick={() => onNavigate('stop-progression')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            currentScreen === 'stop-progression' ? 'bg-[#EA580C] text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          8. Stop Progression
        </button>
        <button
          onClick={() => onNavigate('emergency-report')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            currentScreen === 'emergency-report' ? 'bg-[#DC2626] text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          9. Emergency / SOS
        </button>
        <button
          onClick={() => onNavigate('role-selection')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            currentScreen === 'role-selection' ? 'bg-[#EA580C] text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          10. Role Selection
        </button>
      </aside>

      {/* Main App Container simulating authentic device frame */}
      <div
        id="app-container"
        className={`w-full max-w-[430px] min-h-screen sm:min-h-[890px] sm:max-h-[920px] ${
          theme === 'dark' ? 'bg-[#090D12] text-[#F8FAFC]' : 'bg-[#F8FAFC] text-[#090D12]'
        } flex flex-col justify-between shadow-2xl relative sm:rounded-[36px] overflow-hidden border-x sm:border border-[#1E293B] antialiased`}
      >
        {children}
      </div>
    </div>
  );
};
