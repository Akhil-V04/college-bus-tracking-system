import React, { useState } from 'react';
import { ScreenId } from '../../types';

interface SearchStageScreenProps {
  onBack: () => void;
  onSelectStage: (stage: string) => void;
  onNavigate: (screen: ScreenId) => void;
}

export const SearchStageScreen: React.FC<SearchStageScreenProps> = ({
  onBack,
  onSelectStage,
  onNavigate
}) => {
  const [query, setQuery] = useState('Eci');
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(true);

  const stageSuggestions = [
    { name: 'ECIL TERMINAL', buses: 'RT03, 100B, 47w', distance: '1.2 km' },
    { name: 'ECIL CROSS ROAD', buses: '222P, 1/458', distance: '1.4 km' },
    { name: 'LALAPET', buses: 'RT03 (3K), 100B', distance: '120 m' },
    { name: 'CBS (Central Bus Station)', buses: 'RT03, 3K, 1', distance: '2.5 km' },
    { name: 'VBIT CAMPUS GATE', buses: 'All Campus Shuttles', distance: '0 m' }
  ];

  const filteredStages = stageSuggestions.filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleStageClick = (stageName: string) => {
    onSelectStage(stageName);
    onNavigate('route-results');
  };

  const handleKeyPress = (char: string) => {
    setQuery(prev => prev + char);
  };

  const handleBackspace = () => {
    setQuery(prev => prev.slice(0, -1));
  };

  return (
    <div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 flex flex-col h-full min-h-full overflow-hidden select-none">
      {/* Top Header Section */}
      <header className="pt-2 pb-3 px-4 shrink-0 shadow-sm bg-[#EA580C]">
        {/* Status Bar */}
        <div className="flex justify-between items-center text-white text-xs font-semibold mb-2 px-1 opacity-95">
          <span>3:31</span>
          <div className="flex items-center space-x-1.5 text-[11px]">
            <span className="font-bold text-[10px]">5G</span>
            <div className="border border-white/80 rounded-[3px] px-1 py-[0.5px] text-[9px] font-bold leading-none">
              64
            </div>
          </div>
        </div>

        {/* Search Bar Input Box */}
        <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 flex items-center shadow-md">
          {/* Back Arrow */}
          <button
            aria-label="Go back"
            onClick={onBack}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Input Field with Blinking Cursor */}
          <div className="flex-1 ml-2 flex items-center">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search Stop / Stage"
              className="w-full text-base text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 p-0 font-normal"
            />
            <span className="w-[1.5px] h-5 ml-[1px] animate-pulse bg-[#EA580C]"></span>
          </div>

          {/* Clear 'X' Button */}
          {query && (
            <button
              aria-label="Clear input"
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-gray-600 hover:text-gray-800 focus:outline-none cursor-pointer"
              type="button"
            >
              <svg className="w-5 h-5 fill-[#EA580C]" viewBox="0 0 24 24">
                <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Location Warning Banner */}
      <div className="bg-[#feecec] dark:bg-rose-950/40 px-4 py-2.5 flex items-center justify-between border-b border-red-100 dark:border-rose-900/50" data-purpose="location-warning">
        <div className="flex items-start space-x-2.5 max-w-[78%]">
          <svg className="w-5 h-5 text-[#c82333] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <p className="text-xs text-[#a72334] dark:text-rose-300 font-normal leading-tight">
            Location sharing disable. Tap here to enable location
          </p>
        </div>
        <button
          onClick={() => alert('Campus GPS tracking enabled!')}
          className="text-xs text-[#cf2739] dark:text-rose-400 font-bold tracking-wide hover:underline focus:outline-none shrink-0 pl-1 cursor-pointer"
        >
          Enable
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Nearest Stages heading */}
        <div className="pt-1">
          <h2 className="text-[13px] text-gray-800 dark:text-slate-300 font-medium tracking-tight">
            Nearest Stages form your location
          </h2>
        </div>

        {/* Live Filter Results if typing */}
        {query && filteredStages.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Matching Stages</h3>
            {filteredStages.map(stage => (
              <div
                key={stage.name}
                onClick={() => handleStageClick(stage.name)}
                className="p-3 rounded-xl bg-orange-50/60 dark:bg-slate-800 border border-orange-100 dark:border-slate-700 flex items-center justify-between cursor-pointer hover:bg-orange-100/80 transition-colors"
              >
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase">{stage.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Routes: {stage.buses} • {stage.distance}</p>
                </div>
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            ))}
          </div>
        )}

        {/* Recent Search */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              Recent Search
            </h3>
            <button
              onClick={() => setShowVirtualKeyboard(prev => !prev)}
              className="text-[11px] text-orange-600 font-semibold"
            >
              {showVirtualKeyboard ? 'Hide Keypad' : 'Show Keypad'}
            </button>
          </div>

          <div
            onClick={() => handleStageClick('LALAPET')}
            className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-slate-800 group cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 px-1 rounded-lg"
          >
            <div className="flex items-center space-x-3.5">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-semibold tracking-wide text-gray-800 dark:text-slate-200 uppercase">
                LALAPET
              </span>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="7" x2="17" y1="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </div>
        </div>
      </main>

      {/* BEGIN: KeyboardSection (Simulated SwiftKey as seen in Screenshot 6) */}
      {showVirtualKeyboard && (
        <footer className="bg-[#121417] text-white shrink-0 pb-1 select-none font-sans" data-purpose="virtual-keyboard">
          {/* Top Keyboard Toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 text-gray-400 border-b border-gray-800/60 text-xs">
            <span>💬</span>
            <span>😊</span>
            <span>📋</span>
            <span className="text-[11px] font-semibold text-gray-300">aあ</span>
            <span>🎤</span>
            <span>⚙️</span>
            <span>•••</span>
          </div>

          {/* Word Suggestions */}
          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-gray-300 bg-gray-900/40">
            <span className="text-gray-400">Existing</span>
            <button
              onClick={() => handleStageClick('ECIL')}
              className="text-white font-bold tracking-wide px-3 py-0.5 rounded bg-gray-800/60 hover:bg-orange-600"
            >
              ECIL
            </button>
            <span className="text-gray-400">Exist</span>
          </div>

          {/* Alphabet Keys */}
          <div className="px-1.5 py-1 space-y-1.5 text-sm">
            {/* Row 1 */}
            <div className="flex justify-center space-x-1">
              {['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'].map(k => (
                <button
                  key={k}
                  onClick={() => handleKeyPress(k)}
                  className="w-[9%] h-8.5 rounded bg-gray-800/70 hover:bg-gray-700 flex items-center justify-center font-light text-gray-100 active:scale-90"
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Row 2 */}
            <div className="flex justify-center space-x-1 px-3">
              {['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'].map(k => (
                <button
                  key={k}
                  onClick={() => handleKeyPress(k)}
                  className="w-[10%] h-8.5 rounded bg-gray-800/70 hover:bg-gray-700 flex items-center justify-center font-light text-gray-100 active:scale-90"
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Row 3 */}
            <div className="flex justify-between items-center px-1">
              <button
                onClick={() => setQuery(prev => prev.toUpperCase())}
                className="w-[12%] h-8.5 rounded bg-gray-800/90 text-orange-400 flex items-center justify-center text-xs font-bold"
              >
                ⇧
              </button>
              <div className="flex-1 flex justify-around max-w-[70%]">
                {['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(k => (
                  <button
                    key={k}
                    onClick={() => handleKeyPress(k)}
                    className="w-8 h-8.5 rounded bg-gray-800/70 hover:bg-gray-700 flex items-center justify-center font-light text-gray-100 active:scale-90"
                  >
                    {k}
                  </button>
                ))}
              </div>
              <button
                onClick={handleBackspace}
                className="w-[12%] h-8.5 rounded bg-gray-800/90 text-orange-400 flex items-center justify-center text-sm active:scale-90"
              >
                ⌫
              </button>
            </div>

            {/* Row 4 */}
            <div className="flex justify-between items-center px-1 pt-0.5">
              <span className="w-9 text-xs font-semibold text-orange-400 text-center">123</span>
              <span className="w-8 text-center text-orange-400">😊</span>
              <div
                onClick={() => handleKeyPress(' ')}
                className="flex-1 mx-2 h-7.5 rounded bg-[#1a1c22] border border-gray-700/50 flex flex-col justify-center items-center cursor-pointer hover:bg-gray-800"
              >
                <span className="text-[9px] text-gray-400 tracking-tight">Microsoft SwiftKey</span>
              </div>
              <button
                onClick={() => handleStageClick(query || 'LALAPET')}
                className="w-12 h-7.5 rounded bg-[#EA580C] text-white font-bold text-xs flex items-center justify-center shadow-xs"
              >
                Go
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};
