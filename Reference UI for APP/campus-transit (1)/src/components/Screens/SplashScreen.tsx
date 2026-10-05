import React from 'react';

interface SplashScreenProps {
  onContinue: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onContinue }) => {
  return (
    <div
      onClick={onContinue}
      className="bg-white text-slate-900 flex flex-col justify-between items-center min-h-full h-full w-full overflow-hidden select-none cursor-pointer"
      data-purpose="splash-screen"
    >
      {/* Top Branding Section */}
      <header className="w-full flex flex-col items-center pt-8 sm:pt-12 px-6 text-center">
        {/* App Logo Icon: Pin & Minimal Bus */}
        <div className="flex flex-col items-center mb-2" data-purpose="app-icon">
          <svg className="w-10 h-10 text-[#ea580c] drop-shadow-sm -mb-1" fill="currentColor" viewBox="0 0 24 24">
            <path
              clipRule="evenodd"
              d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
              fillRule="evenodd"
            />
          </svg>
          <div className="bg-[#ea580c] text-white rounded px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase flex items-center gap-1 shadow-sm">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
            </svg>
            CAMPUS
          </div>
        </div>

        {/* Wordmark */}
        <div className="mb-4" data-purpose="app-title-group">
          <div className="text-3xl font-extrabold tracking-tight flex items-center justify-center gap-1 text-[#ea580c]">
            <span>Campus</span>
            <span className="text-slate-900">Transit</span>
          </div>
          <p className="text-[11px] font-semibold tracking-wider uppercase mt-0.5 text-[#c2410c]">
            Track • Commute • Arrive
          </p>
        </div>

        {/* Organization Title */}
        <div className="mt-2" data-purpose="organization-details">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">
            COLLEGE BUS TRACK
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1 max-w-[260px] mx-auto leading-tight">
            College Route &amp; Live Telemetry System
          </p>
        </div>

        {/* Accreditation Seal */}
        <div className="mt-4 flex flex-col items-center" data-purpose="campus-badge">
          <div className="w-10 h-10 rounded-full border-2 border-[#ea580c] flex items-center justify-center p-1 bg-white shadow-xs">
            <svg className="w-6 h-6 text-[#ea580c]" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.333A48.68 48.68 0 0012 9.75c-2.551 0-5.056.2-7.5.583V21m15 0H3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-slate-800 tracking-wider uppercase mt-1">Official Campus Transit</span>
          <span className="text-[9px] font-semibold tracking-widest uppercase text-[#ea580c]">Verified Portal</span>
        </div>
      </header>

      {/* Middle Graphic Section: Animated Vector Bus & Skyline */}
      <section className="w-full flex flex-col items-center justify-end px-4 relative mt-auto mb-4" data-purpose="illustration-container">
        {/* Clouds */}
        <div className="w-full max-w-[340px] flex justify-between px-6 mb-3 opacity-60">
          <svg className="w-12 h-7 text-slate-300 fill-current animate-pulse" viewBox="0 0 24 24">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
          </svg>
          <svg className="w-8 h-5 text-slate-200 fill-current translate-y-2" viewBox="0 0 24 24">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
          </svg>
          <svg className="w-14 h-8 text-slate-300 fill-current" viewBox="0 0 24 24">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
          </svg>
        </div>

        {/* Bus, Buildings, and Street Layout SVG */}
        <div className="relative w-full max-w-[340px] flex justify-center items-end">
          <svg className="w-full h-auto" fill="none" viewBox="0 0 340 140" xmlns="http://www.w3.org/2000/svg">
            {/* Background buildings */}
            <rect fill="none" height="70" stroke="#d1d5db" strokeWidth="1.5" width="45" x="42" y="55" />
            <rect fill="#d1d5db" height="4" width="6" x="49" y="62" />
            <rect fill="#d1d5db" height="4" width="6" x="61" y="62" />
            <rect fill="#d1d5db" height="4" width="6" x="73" y="62" />
            <rect fill="#d1d5db" height="4" width="6" x="49" y="72" />
            <rect fill="#d1d5db" height="4" width="6" x="61" y="72" />
            <rect fill="#d1d5db" height="4" width="6" x="73" y="72" />
            <rect fill="none" height="90" stroke="#d1d5db" strokeWidth="1.5" width="55" x="200" y="35" />
            <rect fill="#d1d5db" height="5" width="7" x="208" y="44" />
            <rect fill="#d1d5db" height="5" width="7" x="223" y="44" />
            <rect fill="#d1d5db" height="5" width="7" x="238" y="44" />
            <rect fill="#d1d5db" height="5" width="7" x="208" y="54" />
            <rect fill="#d1d5db" height="5" width="7" x="223" y="54" />
            <rect fill="#d1d5db" height="5" width="7" x="238" y="54" />

            {/* Street lamp 1 */}
            <path d="M40 125 V105" stroke="#1f2937" strokeLinecap="round" strokeWidth="1.5" />
            <circle cx="40" cy="100" fill="#ea580c" r="10" stroke="#1f2937" strokeWidth="1.5" />
            <path d="M40 94 V106 M36 98 L40 101 M44 98 L40 101" stroke="#ffffff" strokeLinecap="round" strokeWidth="1.2" />

            {/* Street lamp 2 */}
            <path d="M290 125 V102" stroke="#1f2937" strokeLinecap="round" strokeWidth="1.5" />
            <circle cx="290" cy="95" fill="#ea580c" r="12" stroke="#1f2937" strokeWidth="1.5" />
            <path d="M290 88 V102 M285 93 L290 97 M295 93 L290 97" stroke="#ffffff" strokeLinecap="round" strokeWidth="1.2" />

            {/* College Bus Body */}
            <path d="M 75 118 L 75 88 Q 80 50 120 48 L 260 48 Q 265 48 265 55 L 265 118 Z" fill="#fff7ed" stroke="#374151" strokeLinejoin="round" strokeWidth="2" />
            <path d="M 85 86 Q 89 54 118 52 L 118 86 Z" fill="#4b5563" stroke="#374151" strokeLinejoin="round" strokeWidth="1.5" />
            <path d="M 124 52 L 258 52 L 258 86 L 124 86 Z" fill="#4b5563" stroke="#374151" strokeLinejoin="round" strokeWidth="1.5" />
            <line stroke="#e5e7eb" strokeWidth="1" x1="152" x2="152" y1="52" y2="86" />
            <line stroke="#e5e7eb" strokeWidth="1" x1="180" x2="180" y1="52" y2="86" />
            <line stroke="#e5e7eb" strokeWidth="1" x1="208" x2="208" y1="52" y2="86" />
            <line stroke="#e5e7eb" strokeWidth="1" x1="234" x2="234" y1="52" y2="86" />
            <line stroke="#ea580c" strokeWidth="2.5" x1="75" x2="265" y1="92" y2="92" />

            {/* Bus details */}
            <rect fill="none" height="12" rx="1" stroke="#6b7280" strokeWidth="1" width="16" x="135" y="102" />
            <line stroke="#6b7280" strokeWidth="1" x1="140" x2="146" y1="108" y2="108" />
            <rect fill="none" height="12" rx="1" stroke="#6b7280" strokeWidth="1" width="16" x="157" y="102" />
            <line stroke="#6b7280" strokeWidth="1" x1="162" x2="168" y1="108" y2="108" />
            <rect fill="none" height="12" rx="1" stroke="#6b7280" strokeWidth="1" width="16" x="179" y="102" />
            <line stroke="#6b7280" strokeWidth="1" x1="184" x2="190" y1="108" y2="108" />

            {/* Front Wheel */}
            <path d="M 98 122 A 12 12 0 0 1 122 122" fill="#fff7ed" stroke="#374151" strokeWidth="2" />
            <circle cx="110" cy="122" fill="#1f2937" r="8" />
            <circle cx="110" cy="122" fill="#f3f4f6" r="3.5" stroke="#374151" strokeWidth="1" />

            {/* Rear Wheels */}
            <path d="M 195 122 A 12 12 0 0 1 219 122" fill="#fff7ed" stroke="#374151" strokeWidth="2" />
            <circle cx="207" cy="122" fill="#1f2937" r="8" />
            <circle cx="207" cy="122" fill="#f3f4f6" r="3.5" stroke="#374151" strokeWidth="1" />
            <path d="M 221 122 A 12 12 0 0 1 245 122" fill="#fff7ed" stroke="#374151" strokeWidth="2" />
            <circle cx="233" cy="122" fill="#1f2937" r="8" />
            <circle cx="233" cy="122" fill="#f3f4f6" r="3.5" stroke="#374151" strokeWidth="1" />

            {/* Road lines */}
            <line stroke="#4b5563" strokeLinecap="round" strokeWidth="1.75" x1="10" x2="330" y1="126" y2="126" />
            <line stroke="#4b5563" strokeLinecap="round" strokeWidth="1.75" x1="2" x2="6" y1="126" y2="126" />
            <line stroke="#4b5563" strokeLinecap="round" strokeWidth="1.75" x1="334" x2="338" y1="126" y2="126" />
          </svg>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="w-full flex flex-col items-center pb-6 pt-2">
        <div className="flex items-center space-x-1.5 text-center" data-purpose="provider-branding">
          <span className="text-sm font-normal text-slate-800">Powered by</span>
          <div className="inline-flex items-center font-bold tracking-tight text-base leading-none">
            <span className="tracking-wider text-[#ea580c]">CAMPUS</span>
            <span className="text-amber-600 italic ml-1">Maps</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-4 px-6 py-2 rounded-full bg-[#ea580c] text-white text-xs font-semibold tracking-wider uppercase shadow-sm hover:bg-orange-600 active:scale-95 transition-all"
        >
          Tap to Open App
        </button>

        {/* Home Indicator */}
        <div className="w-36 h-1 bg-slate-300 rounded-full mt-4"></div>
      </footer>
    </div>
  );
};
