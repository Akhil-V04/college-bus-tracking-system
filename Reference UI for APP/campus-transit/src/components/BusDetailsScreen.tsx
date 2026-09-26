import React, { useState } from 'react';
import { BusDetailTab, ScreenType } from '../types';
import { BUS_INFO_3K } from '../data/mockData';
import { 
  ArrowLeft, 
  Moon, 
  Sun, 
  Share2, 
  Bell, 
  RotateCw, 
  Navigation, 
  Bus, 
  ChevronUp, 
  LogIn, 
  LogOut, 
  Clock, 
  Phone,
  Crosshair,
  MapPin,
  Flag
} from 'lucide-react';

interface BusDetailsScreenProps {
  onNavigate: (screen: ScreenType) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenRemindMe: () => void;
  onOpenPunctuality: () => void;
  onOpenShareToast: () => void;
}

export const BusDetailsScreen: React.FC<BusDetailsScreenProps> = ({
  onNavigate,
  theme,
  onToggleTheme,
  onOpenRemindMe,
  onOpenPunctuality,
  onOpenShareToast,
}) => {
  const [activeTab, setActiveTab] = useState<BusDetailTab>('my-route');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busLocationOffset, setBusLocationOffset] = useState({ x: 0, y: 0 });

  const handleRefresh = () => {
    setIsRefreshing(true);
    setBusLocationOffset({
      x: (Math.random() - 0.5) * 12,
      y: (Math.random() - 0.5) * 12,
    });
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Top Navigation Header */}
      <header className="bg-[#EA580C] text-white pt-3 pb-2 px-4 shadow-md z-30 shrink-0">
        {/* iOS Status Bar */}
        <div className="flex justify-between items-center text-xs font-semibold px-1 pb-1">
          <span>3:31</span>
          <div className="flex items-center space-x-2">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z" />
            </svg>
            <span className="text-[10px] font-bold">5G</span>
            <div className="w-5 h-2.5 border border-white rounded-sm p-0.5 flex items-center">
              <div className="h-full bg-white rounded-2xs w-3/4"></div>
            </div>
          </div>
        </div>

        {/* App Bar Header */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center space-x-3">
            <button
              id="bus-details-back-btn"
              aria-label="Go Back"
              onClick={() => onNavigate('route-results')}
              className="p-1 text-white hover:opacity-80 transition-opacity cursor-pointer"
              type="button"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
            <h1 className="text-xl font-bold tracking-tight">Bus Details</h1>
          </div>

          {/* Action Icons */}
          <div className="flex items-center space-x-2">
            {/* Theme toggle */}
            <button
              id="details-theme-toggle"
              aria-label="Toggle Theme"
              onClick={onToggleTheme}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-orange-700/50 transition-colors cursor-pointer"
              type="button"
            >
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 stroke-[2]" />
              ) : (
                <Sun className="w-4 h-4 stroke-[2]" />
              )}
            </button>

            {/* Share */}
            <button
              id="details-share-btn"
              aria-label="Share Route"
              onClick={onOpenShareToast}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-orange-700/50 transition-colors cursor-pointer"
              type="button"
            >
              <Share2 className="w-4 h-4 stroke-[2]" />
            </button>

            {/* Notification Bell (Triggers Remind Me modal) */}
            <button
              id="details-remind-bell-btn"
              aria-label="Notifications"
              onClick={onOpenRemindMe}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-orange-700/50 transition-colors cursor-pointer text-amber-200"
              type="button"
            >
              <Bell className="w-4 h-4 stroke-[2] fill-current" />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs Nav */}
      <nav aria-label="Bus Details Tabs" className="bg-[#161C24] border-b border-[#283545] z-20 shrink-0">
        <div className="flex text-xs font-bold tracking-wider uppercase">
          <button
            onClick={() => setActiveTab('my-route')}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
              activeTab === 'my-route'
                ? 'text-white border-b-2 border-[#EA580C] bg-white/5 font-bold'
                : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
            }`}
            type="button"
          >
            MY ROUTE
          </button>
          <button
            onClick={() => setActiveTab('full-route')}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
              activeTab === 'full-route'
                ? 'text-[#EA580C] border-b-2 border-[#EA580C] bg-white/5 font-bold'
                : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
            }`}
            type="button"
          >
            FULL ROUTE
          </button>
          <button
            onClick={() => setActiveTab('bus-info')}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
              activeTab === 'bus-info'
                ? 'text-[#EA580C] border-b-2 border-[#EA580C] bg-white/5 font-bold'
                : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
            }`}
            type="button"
          >
            BUS INFO
          </button>
        </div>
      </nav>

      {/* TAB 1: MY ROUTE */}
      {activeTab === 'my-route' && (
        <div className="relative flex-1 flex flex-col overflow-hidden bg-[#0F172A]">
          {/* Interactive Vector Map Canvas Graphic */}
          <div className="relative flex-1 bg-[#0F172A] overflow-hidden" id="map-viewport">
            <svg
              className="absolute inset-0 w-full h-full object-cover"
              preserveAspectRatio="none"
              viewBox="0 0 400 650"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <style>{`
                  .water { fill: #1e293b; }
                  .road-secondary { stroke: #334155; stroke-width: 3; fill: none; }
                  .road-primary { stroke: #475569; stroke-width: 5; fill: none; stroke-linecap: round; }
                  .road-highway { stroke: #64748b; stroke-width: 7; fill: none; }
                  .highway-inner { stroke: #334155; stroke-width: 4; fill: none; }
                  .bus-route { stroke: #EA580C; stroke-width: 5; fill: none; stroke-linejoin: round; stroke-linecap: round; }
                  .map-label { fill: #94a3b8; font-family: sans-serif; font-size: 10px; font-weight: 600; }
                  .water-label { fill: #64748b; font-family: sans-serif; font-size: 9px; font-style: italic; }
                `}</style>
              </defs>

              {/* Base Map Background */}
              <rect fill="#0F172A" height="650" width="400"></rect>

              {/* Water Features / Cheruvu / Lakes */}
              <path className="water" d="M 170,90 C 180,60 210,65 215,95 C 220,120 190,140 180,130 Z"></path>
              <path className="water" d="M -30,220 C 40,220 70,270 45,340 C 20,380 -20,360 -30,220 Z"></path>
              <path className="water" d="M 160,250 C 200,280 190,340 165,360 C 150,330 140,290 160,250 Z"></path>

              {/* Grid of Roads & Expressways */}
              <path className="road-secondary" d="M -20,160 L 420,150"></path>
              <path className="road-secondary" d="M 110,-20 L 130,670"></path>
              <path className="road-secondary" d="M -20,470 L 420,440"></path>
              <path className="road-primary" d="M 130,230 L 380,420"></path>
              <path className="road-primary" d="M -20,340 L 420,330"></path>

              {/* Major Highway */}
              <path className="road-highway" d="M 80,-20 L 130,360 L 320,670"></path>
              <path className="highway-inner" d="M 80,-20 L 130,360 L 320,670"></path>

              {/* District Labels */}
              <text className="map-label" x="180" y="85">YAPRAL</text>
              <text className="water-label" x="145" y="210">Safilguda Nadimi</text>
              <text className="water-label" x="160" y="222">Cheruvu</text>
              <text className="map-label" x="10" y="195">TIRUMALAGIRI</text>
              <text className="map-label text-white font-bold" fill="#f8fafc" x="8" y="235">Secunderabad</text>
              <text className="map-label" x="210" y="370">HABSIGUDA</text>
              <text className="map-label" x="290" y="285">MALLAPUR</text>
              <text className="map-label font-bold" fill="#cbd5e1" x="235" y="318">NACHARAM</text>

              {/* Route Polyline (Vibrant Orange) */}
              <path className="bus-route" d="M 235,305 L 260,270 L 300,240 L 325,210 L 335,190"></path>

              {/* Waypoint stops */}
              <circle cx="260" cy="270" fill="#EA580C" r="5" stroke="#161C24" strokeWidth="2"></circle>
              <circle cx="280" cy="255" fill="#EA580C" r="5" stroke="#161C24" strokeWidth="2"></circle>
              <circle cx="300" cy="240" fill="#EA580C" r="5" stroke="#161C24" strokeWidth="2"></circle>
              <circle cx="312" cy="225" fill="#EA580C" r="5" stroke="#161C24" strokeWidth="2"></circle>
              <circle cx="325" cy="210" fill="#EA580C" r="5" stroke="#161C24" strokeWidth="2"></circle>

              {/* Start/Current Stop Pin with dynamic pulse offset */}
              <g transform={`translate(${225 + busLocationOffset.x}, ${290 + busLocationOffset.y})`}>
                <circle cx="10" cy="15" fill="#EA580C" fillOpacity="0.25" r="14">
                  <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="10" cy="15" fill="#EA580C" r="6"></circle>
                <circle cx="10" cy="15" fill="#ffffff" r="2.5"></circle>
              </g>

              {/* Destination Flag / Marker Pin */}
              <g transform="translate(325, 170)">
                <path d="M 10 0 C 4.48 0 0 4.48 0 10 C 0 17.5 10 28 10 28 C 10 28 20 17.5 20 10 C 20 4.48 15.52 0 10 0 Z" fill="#EF4444" stroke="#ffffff" strokeWidth="1.5"></path>
                <circle cx="10" cy="9.5" fill="#ffffff" r="4"></circle>
              </g>
            </svg>

            {/* Floating Action Buttons */}
            <div className="absolute right-4 top-4 flex flex-col space-y-3 z-10">
              <button
                id="refresh-map-btn"
                aria-label="Refresh Location"
                onClick={handleRefresh}
                className="w-11 h-11 rounded-full bg-[#161C24] border border-[#283545] text-[#EA580C] flex items-center justify-center shadow-lg active:scale-95 transition-transform hover:bg-slate-800 cursor-pointer"
                type="button"
              >
                <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Live GPS Recenter Button */}
            <div className="absolute right-4 bottom-52 z-10">
              <button
                id="gps-recenter-btn"
                aria-label="My Current Location"
                onClick={handleRefresh}
                className="w-11 h-11 rounded-full bg-[#161C24] border border-[#283545] text-[#EA580C] flex items-center justify-center shadow-lg active:scale-95 transition-transform hover:bg-slate-800 cursor-pointer"
                type="button"
              >
                <Navigation className="w-5 h-5 fill-current" />
              </button>
            </div>

            {/* Bus Status Icon Floating Indicator */}
            <div className="absolute left-4 bottom-52 z-10">
              <button
                onClick={() => onNavigate('stop-progression')}
                className="w-11 h-11 rounded-full bg-[#161C24] border-2 border-[#EA580C] flex items-center justify-center shadow-lg cursor-pointer"
              >
                <Bus className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Bottom Pull-Up Sheet */}
          <section
            id="bottom-sheet"
            className="relative z-20 bg-[#161C24] border-t border-[#283545] rounded-t-3xl shadow-[0_-10px_25px_rgba(0,0,0,0.6)] px-5 pt-3 pb-5 shrink-0"
          >
            {/* Drag Handle Indicator */}
            <div
              onClick={() => onNavigate('stop-progression')}
              className="flex flex-col items-center cursor-pointer mb-2"
            >
              <div className="w-10 h-1 bg-slate-600 rounded-full mb-2"></div>
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium hover:text-[#EA580C] transition-colors">
                <ChevronUp className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>Pull Up to view more</span>
              </div>
            </div>

            {/* Stops Progression Timeline List */}
            <div className="mt-3 space-y-3">
              {/* Stop 1: Active Focus */}
              <div className="flex items-start">
                <div className="relative flex flex-col items-center mr-4">
                  <div className="w-5 h-5 rounded-full border-2 border-[#EA580C] bg-[#161C24] flex items-center justify-center z-10">
                    <div className="w-2 h-2 rounded-full bg-[#EA580C]"></div>
                  </div>
                  <div className="w-0.5 h-10 bg-slate-700 -my-0.5"></div>
                </div>
                <div className="flex-1 pb-1">
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    LALAPET twd Moula Ali
                  </h3>
                  <div className="flex items-center space-x-6 mt-1 text-xs">
                    <div className="flex items-center space-x-1.5 text-[#EA580C] font-semibold">
                      <LogIn className="w-3.5 h-3.5" />
                      <span className="tracking-wider">--:--</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-[#EA580C] font-semibold">
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="tracking-wider">--:--</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stop 2: Next Stop */}
              <div className="flex items-start">
                <div className="relative flex flex-col items-center mr-4">
                  <div className="w-5 h-5 rounded-full border-2 border-slate-500 bg-[#161C24] flex items-center justify-center z-10">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                  </div>
                </div>
                <div className="flex-1 pb-1">
                  <h3 className="text-sm font-bold text-slate-300 tracking-wide">
                    INDUSTRIAL Estate twd Kushaiguda
                  </h3>
                  <div className="flex items-center space-x-6 mt-1 text-xs">
                    <div className="flex items-center space-x-1.5 text-[#EA580C] font-semibold">
                      <LogIn className="w-3.5 h-3.5" />
                      <span className="tracking-wider">--:--</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-[#EA580C] font-semibold">
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="tracking-wider">--:--</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* iOS Home Bar Indicator */}
            <div className="w-32 h-1 bg-slate-700 rounded-full mx-auto mt-4"></div>
          </section>
        </div>
      )}

      {/* TAB 2: FULL ROUTE */}
      {activeTab === 'full-route' && (
        <div className="relative flex-1 flex flex-col overflow-hidden bg-[#0d1522]">
          {/* Vector Map with dot grid */}
          <div className="relative flex-1 w-full overflow-hidden" style={{
            backgroundColor: '#0d1522',
            backgroundImage: 'radial-gradient(#1e293b 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}>
            {/* Secondary road paths */}
            <svg className="w-full h-full absolute inset-0 opacity-40 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <path d="M-20,180 Q100,160 220,240 T440,290" fill="none" stroke="#334155" strokeWidth="3"></path>
              <path d="M80,-20 L160,350 L260,520" fill="none" stroke="#1e293b" strokeWidth="5"></path>
              <path d="M-10,410 L280,390 L430,470" fill="none" stroke="#1e293b" strokeWidth="4"></path>
            </svg>

            {/* District Labels */}
            <div className="absolute top-10 left-6 text-[11px] font-bold text-slate-400/80 tracking-wide pointer-events-none">
              SECUNDERABAD
            </div>
            <div className="absolute top-28 right-10 text-[10px] font-bold text-slate-500 tracking-wide pointer-events-none">
              NACHARAM
            </div>
            <div className="absolute top-52 right-12 text-[10px] font-bold text-slate-500 tracking-wide pointer-events-none">
              HABSIGUDA
            </div>
            <div className="absolute top-64 left-8 text-[11px] font-bold text-slate-400/80 tracking-wide pointer-events-none">
              HYDERABAD
            </div>

            {/* Vector Route Path */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              {/* Route Shadow */}
              <path d="M 80,480 C 110,440 140,390 200,310 C 240,260 285,190 335,115" fill="none" opacity="0.4" stroke="#EA580C" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6"></path>
              {/* Main Line */}
              <path d="M 80,480 C 110,440 140,390 200,310 C 240,260 285,190 335,115" fill="none" stroke="#EA580C" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5"></path>
              {/* Intermediate stop dots */}
              <circle cx="105" cy="450" fill="#161C24" r="4.5" stroke="#EA580C" strokeWidth="2"></circle>
              <circle cx="128" cy="420" fill="#161C24" r="4.5" stroke="#EA580C" strokeWidth="2"></circle>
              <circle cx="155" cy="380" fill="#161C24" r="4.5" stroke="#EA580C" strokeWidth="2"></circle>
              <circle cx="180" cy="345" fill="#161C24" r="4.5" stroke="#EA580C" strokeWidth="2"></circle>
              <circle cx="215" cy="290" fill="#161C24" r="4.5" stroke="#EA580C" strokeWidth="2"></circle>
              <circle cx="240" cy="250" fill="#161C24" r="4.5" stroke="#EA580C" strokeWidth="2"></circle>
              <circle cx="270" cy="205" fill="#161C24" r="4.5" stroke="#EA580C" strokeWidth="2"></circle>
              <circle cx="300" cy="165" fill="#161C24" r="4.5" stroke="#EA580C" strokeWidth="2"></circle>
            </svg>

            {/* Terminal Pin: ECIL Bus Terminal */}
            <div className="absolute top-[88px] left-[322px] -translate-x-1/2 -translate-y-full flex flex-col items-center cursor-pointer">
              <div className="bg-rose-600 text-white rounded-full p-1.5 shadow-lg ring-2 ring-rose-400/40">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <span className="mt-1 px-1.5 py-0.5 rounded bg-slate-900/90 text-[9px] font-bold text-rose-300 border border-slate-700/60 backdrop-blur whitespace-nowrap shadow">
                ECIL Terminal
              </span>
            </div>

            {/* Origin Pin: Afzalganj */}
            <div className="absolute top-[495px] left-[78px] -translate-x-1/2 -translate-y-full flex flex-col items-center cursor-pointer">
              <div className="bg-[#EA580C] text-white rounded-full p-1.5 shadow-lg ring-2 ring-orange-400">
                <Flag className="w-3 h-3" />
              </div>
              <span className="mt-1 px-1.5 py-0.5 rounded bg-slate-900/90 text-[9px] font-bold text-orange-300 border border-slate-700/60 backdrop-blur whitespace-nowrap shadow">
                Afzalganj
              </span>
            </div>

            {/* Live Bus Indicator on Route */}
            <div className="absolute top-[415px] left-[132px] -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
              <span className="absolute w-8 h-8 rounded-full bg-orange-500/20 animate-ping"></span>
              <div className="w-7 h-7 rounded-full bg-[#EA580C] border-2 border-slate-900 flex items-center justify-center text-white text-xs shadow-md">
                <Bus className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Floating Action Buttons */}
            <div className="absolute top-4 right-4 flex flex-col space-y-3 z-20">
              <button
                onClick={handleRefresh}
                className="w-11 h-11 bg-[#161C24]/95 border border-[#283545] rounded-full flex items-center justify-center text-[#EA580C] shadow-lg hover:bg-[#1f2834] active:scale-95 transition-all cursor-pointer"
                type="button"
              >
                <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="absolute bottom-36 right-4 z-20">
              <button
                onClick={handleRefresh}
                className="w-11 h-11 bg-[#161C24]/95 border border-[#283545] rounded-full flex items-center justify-center text-[#EA580C] shadow-lg hover:bg-[#1f2834] active:scale-95 transition-all cursor-pointer"
                type="button"
              >
                <Crosshair className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Drawer */}
          <section
            id="route-stops-drawer"
            className="relative bg-[#161C24] border-t border-[#283545] rounded-t-3xl shadow-[0_-8px_24px_rgba(0,0,0,0.7)] flex flex-col z-30 max-h-[340px] pb-4 shrink-0"
          >
            {/* Drawer Handle */}
            <div
              onClick={() => onNavigate('stop-progression')}
              className="pt-3 pb-2 px-4 flex flex-col items-center cursor-pointer"
            >
              <div className="w-12 h-1.5 bg-slate-600 rounded-full mb-2"></div>
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium tracking-wide hover:text-orange-400 transition-colors">
                <ChevronUp className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>Pull Up to view more</span>
              </div>
            </div>

            {/* Stops Timeline */}
            <div className="px-5 py-2 overflow-y-auto no-scrollbar flex-1 space-y-3">
              {/* Stop 1 */}
              <div className="relative flex items-start space-x-4">
                <div className="flex flex-col items-center self-stretch">
                  <div className="w-1 h-3 bg-[#EA580C] rounded-full mb-1"></div>
                  <div className="w-4 h-4 rounded-full border-2 border-slate-400 bg-[#161C24] flex-shrink-0 z-10"></div>
                  <div className="w-1 flex-1 bg-slate-700 my-1 rounded-full"></div>
                </div>
                <div className="flex-1 pb-1">
                  <h2 className="text-sm font-bold text-slate-100 tracking-tight leading-snug uppercase">
                    Afzalganj Central Library <span className="text-xs text-slate-400 font-semibold normal-case">twd CBS</span>
                  </h2>
                  <div className="flex items-center space-x-6 mt-1 text-xs">
                    <div className="flex items-center space-x-1.5 text-[#EA580C] font-semibold">
                      <LogIn className="w-3 h-3" />
                      <span>15:22</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-[#EA580C] font-semibold">
                      <LogOut className="w-3 h-3" />
                      <span>15:22</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stop 2: Live Bus */}
              <div className="relative flex items-start space-x-4">
                <div className="flex flex-col items-center self-stretch">
                  <div className="w-6 h-6 rounded-full bg-[#EA580C] flex items-center justify-center text-white text-[11px] shadow-md shadow-orange-950 ring-2 ring-orange-500/30 flex-shrink-0 z-10 -ml-1">
                    <Bus className="w-3.5 h-3.5" />
                  </div>
                  <div className="w-1 flex-1 bg-slate-700 mt-1 mb-1 rounded-full min-h-[24px]"></div>
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-tight">
                      CBS
                    </h2>
                    <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold rounded bg-[#EA580C]/20 text-[#EA580C]">
                      LIVE NOW
                    </span>
                  </div>
                  <div className="flex items-center space-x-6 mt-1 text-xs text-slate-400 font-medium">
                    <div className="flex items-center space-x-1.5">
                      <LogIn className="w-3 h-3" />
                      <span>--:--</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <LogOut className="w-3 h-3" />
                      <span>--:--</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* iOS Home Indicator */}
            <div className="w-full flex justify-center pt-2">
              <div className="w-32 h-1 bg-slate-600/80 rounded-full"></div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: BUS INFO */}
      {activeTab === 'bus-info' && (
        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {/* Route & Status Card */}
          <div
            id="route-status-card"
            className="bg-[#161C24] border border-[#283545] rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <span className="text-xs uppercase text-gray-400 tracking-wider block font-semibold mb-0.5">
                Route
              </span>
              <span className="text-3xl font-extrabold text-white tracking-tight leading-none">
                {BUS_INFO_3K.routeNumber}
              </span>
            </div>

            <div className="text-right pr-2">
              <span className="text-xs font-semibold text-[#EA580C] block">
                Duration
              </span>
              <span className="text-sm font-bold text-[#EA580C]">
                {BUS_INFO_3K.duration}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center pl-3 border-l border-[#283545]/60">
              <div className="w-10 h-10 rounded-full border-2 border-[#EA580C]/40 bg-[#EA580C]/10 flex items-center justify-center text-[#EA580C] mb-1">
                <RotateCw className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <span className="text-xs font-semibold text-gray-300">
                {BUS_INFO_3K.status}
              </span>
            </div>
          </div>

          {/* Vehicle & Fleet Card */}
          <div
            id="vehicle-fleet-card"
            className="bg-[#161C24] border border-[#283545] rounded-xl px-4 py-3 flex items-center justify-between"
          >
            <div>
              <span className="text-xs text-gray-400 block font-medium">Registration No.</span>
              <span className="text-sm font-bold text-white tracking-wide">
                {BUS_INFO_3K.registrationNumber}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-medium">Service Type</span>
              <span className="text-xs font-bold text-gray-200 tracking-wider uppercase">
                {BUS_INFO_3K.serviceType}
              </span>
            </div>
          </div>

          {/* Date & Depot Card */}
          <div
            id="date-depot-card"
            className="bg-[#161C24] border border-[#283545] rounded-xl px-4 py-3 flex items-center justify-between"
          >
            <div>
              <span className="text-xs text-gray-400 block font-medium">Date of Trip</span>
              <span className="text-sm font-semibold text-white">
                {BUS_INFO_3K.dateOfTrip}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-medium">Depot Name</span>
              <span className="text-sm font-semibold text-white uppercase">
                {BUS_INFO_3K.depotName}
              </span>
            </div>
          </div>

          {/* Origin & Destination Card */}
          <div
            id="origin-destination-card"
            className="bg-[#161C24] border border-[#283545] rounded-xl px-4 py-3 flex justify-between items-start gap-4"
          >
            <div className="flex-1">
              <span className="text-xs text-gray-400 block font-medium mb-1">Origin</span>
              <p className="text-sm font-bold text-white leading-snug">
                {BUS_INFO_3K.originName}
              </p>
            </div>
            <div className="pt-4 text-[#EA580C] opacity-70">
              ➔
            </div>
            <div className="flex-1 text-right">
              <span className="text-xs text-gray-400 block font-medium mb-1">Destination</span>
              <p className="text-sm font-bold text-white leading-snug">
                {BUS_INFO_3K.destinationName}
              </p>
            </div>
          </div>

          {/* Schedule Times Card */}
          <div
            id="schedule-card"
            className="bg-[#161C24] border border-[#283545] rounded-xl px-4 py-3 flex items-center justify-between"
          >
            <div>
              <span className="text-xs text-gray-400 block font-medium">STD from Origin</span>
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                {BUS_INFO_3K.stdOrigin}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-medium">STA at Destination</span>
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                {BUS_INFO_3K.staDestination}
              </span>
            </div>
          </div>

          {/* Driver & Helpline Card */}
          <div
            id="driver-helpline-card"
            className="bg-[#161C24] border border-[#283545] rounded-xl px-4 py-3 flex items-center justify-between text-xs"
          >
            <div className="pr-2">
              <span className="text-gray-400 font-medium">Driver Name</span>
              <span className="font-bold text-white ml-1.5">{BUS_INFO_3K.driverName}</span>
            </div>
            <div className="text-right border-l border-[#283545] pl-3">
              <span className="text-gray-400 font-medium block">Helpline</span>
              <div className="font-semibold text-gray-200 mt-0.5 space-y-0.5 text-[11px] leading-tight">
                {BUS_INFO_3K.helplineNumbers.map((num, idx) => (
                  <div key={idx}>{num}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Action Button: Punctuality */}
          <div className="pt-2 pb-6">
            <button
              id="punctuality-action-btn"
              onClick={onOpenPunctuality}
              className="w-full bg-[#EA580C] hover:bg-[#c2410c] active:scale-[0.98] text-white font-semibold text-base py-3.5 px-4 rounded-xl shadow-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
              type="button"
            >
              <Clock className="w-5 h-5 text-white/90" />
              <span>Last Week Arrival Punctuality</span>
            </button>
          </div>
        </main>
      )}
    </div>
  );
};
