import React, { useState } from 'react';
import { Smartphone, Monitor, Sun, Moon } from 'lucide-react';

interface PhoneFrameProps {
  children: React.ReactNode;
  currentTime?: string;
  isDark: boolean;
  onToggleTheme: () => void;
  title?: string;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  children,
  currentTime = '3:31',
  isDark,
  onToggleTheme,
  title
}) => {
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'expanded'>('mobile');

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'} flex flex-col items-center justify-start md:py-6 px-0 md:px-4 font-sans select-none`}>
      {/* Top Desktop Controls Bar */}
      <aside aria-label="Device Preview Toolbar" className="w-full max-w-4xl hidden md:flex items-center justify-between pb-3 px-2">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-orange-600"></div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Campus Transit • Interactive Preview
          </span>
          {title && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 font-semibold">
              {title}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition-colors"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>

          <div className="flex items-center rounded-lg bg-white dark:bg-slate-800 p-0.5 shadow-sm border border-slate-300 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setDeviceMode('mobile')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                deviceMode === 'mobile'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Frame</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('expanded')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                deviceMode === 'expanded'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Full Width</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div
        className={`w-full transition-all duration-300 ${
          deviceMode === 'mobile'
            ? 'max-w-[420px] md:h-[870px] md:max-h-[92vh] md:rounded-[40px] md:border-[10px] md:border-slate-900 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden relative bg-white dark:bg-slate-900'
            : 'max-w-2xl min-h-screen md:min-h-[850px] md:rounded-2xl md:shadow-xl flex flex-col overflow-hidden relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
        }`}
      >
        {/* Device Top Speaker Notch (Only in Mobile Mode) */}
        {deviceMode === 'mobile' && (
          <div className="hidden md:flex justify-center items-center h-4 w-full bg-slate-900 absolute top-0 left-0 right-0 z-50">
            <div className="w-16 h-1 bg-slate-700 rounded-full"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800 ml-3"></div>
          </div>
        )}

        {/* Content Viewport */}
        <div className="flex-1 flex flex-col w-full h-full overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
};
