import React, { useState } from 'react';
import { ScreenId } from '../../types';

interface ReportAccidentScreenProps {
  categoryTitle?: string;
  onBack: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export const ReportAccidentScreen: React.FC<ReportAccidentScreenProps> = ({
  categoryTitle = 'Report Accident',
  onBack,
  onNavigate
}) => {
  const [mobileNumber, setMobileNumber] = useState('9876543210');
  const [serviceType, setServiceType] = useState<'service' | 'bus'>('service');
  const [serviceNumber, setServiceNumber] = useState('RT03 (3K)');
  const [submitted, setSubmitted] = useState(false);
  const [sosTriggered, setSosTriggered] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      alert(`Incident reported to CAMPUS FLEET Control Room!\nMobile: ${mobileNumber}\nService: ${serviceNumber}`);
      onNavigate('dashboard');
    }, 600);
  };

  const handleSos = () => {
    setSosTriggered(true);
    alert('🚨 HIGH-PRIORITY SOS DISPATCHED!\nYour live campus GPS coordinates have been sent to Campus Security QRT and Police Control Room.');
  };

  return (
    <div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 min-h-full h-full flex flex-col antialiased select-none overflow-y-auto">
      {/* BEGIN: MainHeader */}
      <header className="bg-[#EA580C] text-white pt-10 pb-4 px-4 flex items-center gap-4 shadow-sm z-10 sticky top-0" data-purpose="header">
        <button
          aria-label="Go Back"
          onClick={onBack}
          className="p-1.5 -ml-1 text-white hover:opacity-80 active:scale-95 transition-transform cursor-pointer"
          type="button"
        >
          <svg className="w-6 h-6 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-xl font-medium tracking-wide">{categoryTitle}</h1>
      </header>
      {/* END: MainHeader */}

      {/* Scrollable Content */}
      <div className="flex-1 px-5 pt-5 pb-8 flex flex-col space-y-5">
        {/* BEGIN: EmergencyBanner */}
        <section
          className={`rounded-xl p-4 shadow-sm border transition-all flex items-center justify-between relative overflow-hidden ${
            sosTriggered
              ? 'bg-red-600 text-white border-red-700 animate-pulse'
              : 'bg-[#FFECEC] border-rose-100 dark:bg-rose-950/40 dark:border-rose-900/50'
          }`}
          data-purpose="sos-alert-banner"
        >
          <div className="max-w-[58%] pr-1">
            <h2 className={`font-bold text-[17px] leading-tight mb-1 ${sosTriggered ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
              {sosTriggered ? 'SOS Signal Live!' : 'Are you in Emergency?'}
            </h2>
            <p className={`text-[13px] leading-[18px] ${sosTriggered ? 'text-red-100' : 'text-gray-800 dark:text-slate-200'}`}>
              Press <strong className="text-[#DC1422] dark:text-rose-400 font-semibold">SOS</strong> button and help will reach you soon
            </p>
          </div>

          {/* Red SOS Button with Tap Gesture Pointer */}
          <div className="relative flex-shrink-0">
            <button
              onClick={handleSos}
              className="bg-[#DC1422] hover:bg-red-700 active:scale-95 transition-transform text-white font-bold text-base px-6 py-3.5 rounded-xl shadow-md flex items-center justify-center min-w-[100px] min-h-[48px] cursor-pointer"
              type="button"
            >
              SOS
            </button>

            {/* Tap Pointer Graphic */}
            <div className="absolute -bottom-2 left-6 pointer-events-none drop-shadow-sm">
              <svg className="w-6 h-6 text-pink-200 fill-white stroke-gray-800 stroke-[1.2]" viewBox="0 0 24 24">
                <path d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.303-.553l-1.591 1.591M20.25 10.5H18M4.5 10.5h2.25M6.288 5.538L7.88 7.13" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </section>
        {/* END: EmergencyBanner */}

        {/* BEGIN: ReportForm */}
        <form className="space-y-4" onSubmit={handleSubmit} data-purpose="incident-form">
          {/* Mobile Number Field */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-900 dark:text-slate-200" htmlFor="mobile-number">
              Mobile Number
            </label>
            <input
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-white placeholder-gray-400 text-base focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none shadow-xs transition-colors"
              id="mobile-number"
              placeholder="Enter Mobile Number"
              type="tel"
              value={mobileNumber}
              onChange={e => setMobileNumber(e.target.value)}
              required
            />
          </div>

          {/* Choose Service Radio Selector */}
          <fieldset className="pt-1">
            <legend className="block text-sm font-semibold text-gray-900 dark:text-slate-200 mb-2.5">
              Choose Service
            </legend>
            <div className="flex items-center space-x-6">
              {/* Option 1: Service Number */}
              <label className="flex items-center cursor-pointer group">
                <input
                  checked={serviceType === 'service'}
                  onChange={() => setServiceType('service')}
                  className="w-5 h-5 text-[#EA580C] accent-[#EA580C] cursor-pointer"
                  name="service-type"
                  type="radio"
                  value="service"
                />
                <span className="ml-2 text-sm font-medium text-gray-800 dark:text-slate-200 group-hover:text-gray-900">
                  Service Number
                </span>
              </label>

              {/* Option 2: Bus Number */}
              <label className="flex items-center cursor-pointer group">
                <input
                  checked={serviceType === 'bus'}
                  onChange={() => setServiceType('bus')}
                  className="w-5 h-5 text-[#EA580C] accent-[#EA580C] cursor-pointer"
                  name="service-type"
                  type="radio"
                  value="bus"
                />
                <span className="ml-2 text-sm font-medium text-gray-800 dark:text-slate-200 group-hover:text-gray-900">
                  Bus Number
                </span>
              </label>
            </div>
          </fieldset>

          {/* Service / Vehicle Identifier Input Field */}
          <div className="space-y-1 pt-1">
            <input
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-white placeholder-gray-400 text-base focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none shadow-xs transition-colors"
              id="service-number"
              placeholder={serviceType === 'bus' ? 'Enter Bus Number (e.g. AP23Z0073)' : 'Enter Service Number (e.g. RT03)'}
              type="text"
              value={serviceNumber}
              onChange={e => setServiceNumber(e.target.value)}
              required
            />
          </div>

          {/* Primary Action Submission Button */}
          <div className="pt-2">
            <button
              className="w-full py-3.5 px-4 bg-[#EA580C] hover:bg-[#C2410C] active:scale-[0.99] transition-all text-white font-medium text-base rounded-xl shadow-sm text-center cursor-pointer"
              type="submit"
            >
              Submit To CAMPUS FLEET
            </button>
          </div>
        </form>
        {/* END: ReportForm */}

        <div className="flex-grow min-h-6"></div>

        {/* BEGIN: EmergencyQuickActions */}
        <section className="pt-2" data-purpose="quick-contacts">
          <h3 className="text-center text-xs font-semibold text-gray-900 dark:text-slate-300 tracking-wide mb-5">
            Call Central Complaint Cell (TGSBRTC)
          </h3>

          <div className="grid grid-cols-3 gap-2.5 items-end">
            {/* Quick Action: Campus Security */}
            <div className="relative pt-3.5 flex flex-col items-center">
              <div className="absolute top-0 w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-[#EA580C] flex items-center justify-center shadow-xs z-10">
                <svg className="w-4 h-4 text-[#EA580C]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <a
                className="w-full pt-4 pb-2.5 px-1 rounded-xl border border-[#EA580C] text-center bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-700 active:scale-95 transition-all block"
                href="tel:04069440000"
              >
                <span className="text-[#EA580C] font-semibold text-xs leading-tight block">Campus Security</span>
              </a>
            </div>

            {/* Quick Action: Ambulance */}
            <div className="relative pt-3.5 flex flex-col items-center">
              <div className="absolute top-0 w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-[#EA580C] flex items-center justify-center shadow-xs z-10">
                <svg className="w-4 h-4 text-[#EA580C]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <a
                className="w-full pt-4 pb-2.5 px-1 rounded-xl border border-[#EA580C] text-center bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-700 active:scale-95 transition-all block"
                href="tel:108"
              >
                <span className="text-[#EA580C] font-semibold text-xs leading-tight block">Ambulance</span>
              </a>
            </div>

            {/* Quick Action: Send SMS */}
            <div className="relative pt-3.5 flex flex-col items-center">
              <div className="absolute top-0 w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-[#EA580C] flex items-center justify-center shadow-xs z-10">
                <svg className="w-4 h-4 text-[#EA580C]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <a
                className="w-full pt-4 pb-2.5 px-1 rounded-xl border border-[#EA580C] text-center bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-700 active:scale-95 transition-all block"
                href="sms:04069440000?body=Emergency assistance required on Campus Route"
              >
                <span className="text-[#EA580C] font-semibold text-xs leading-tight block">Send SMS</span>
              </a>
            </div>
          </div>
        </section>
        {/* END: EmergencyQuickActions */}

        {/* Bottom Home Indicator */}
        <div className="pt-3 flex justify-center items-center">
          <div className="w-32 h-1 bg-gray-300 dark:bg-slate-700 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};
