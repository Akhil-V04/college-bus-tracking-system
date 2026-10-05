import React, { useState } from 'react';
import { ScreenType } from '../types';
import { ArrowLeft, Sun, Moon, Phone, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface EmergencyReportScreenProps {
  onNavigate: (screen: ScreenType) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const EmergencyReportScreen: React.FC<EmergencyReportScreenProps> = ({
  onNavigate,
  theme,
  onToggleTheme,
}) => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [serviceType, setServiceType] = useState<'service' | 'bus'>('service');
  const [serviceValue, setServiceValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sosActive, setSosActive] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber) {
      alert('Please enter your mobile number for emergency dispatch callback.');
      return;
    }
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onNavigate('home');
    }, 2800);
  };

  const handleSos = () => {
    setSosActive(true);
  };

  return (
    <div className="w-full min-h-full flex flex-col justify-between bg-[#090F16] text-white select-none antialiased">
      {/* Main Header */}
      <header
        id="mobile-header"
        className="bg-[#EA580C] px-4 pt-10 pb-4 shadow-md flex items-center justify-between sticky top-0 z-30"
      >
        <div className="flex items-center space-x-3">
          <button
            id="emergency-back-btn"
            aria-label="Go Back"
            onClick={() => onNavigate('home')}
            className="p-1 rounded-full text-white hover:bg-black/10 transition-colors focus:outline-none cursor-pointer"
            type="button"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
          </button>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Report Accident
          </h1>
        </div>

        <button
          id="theme-toggle"
          aria-label="Toggle Theme"
          onClick={onToggleTheme}
          className="p-1.5 rounded-full text-white hover:bg-black/10 transition-colors focus:outline-none cursor-pointer"
          type="button"
        >
          {theme === 'dark' ? (
            <Sun className="w-6 h-6 stroke-[2]" />
          ) : (
            <Moon className="w-6 h-6 stroke-[2]" />
          )}
        </button>
      </header>

      {/* Content Area */}
      <main id="emergency-report-form" className="flex-1 px-5 py-4 flex flex-col space-y-5 max-w-md w-full mx-auto">
        {/* SOS Alert Card */}
        <div
          id="sos-card"
          className="bg-[#2A1418] border border-[#5A1E24] rounded-xl p-4 flex items-center justify-between shadow-lg"
        >
          <div className="pr-2">
            <h2 className="text-base font-bold text-white tracking-wide">
              Are you in Emergency?
            </h2>
            <p className="text-xs text-gray-300 mt-1 leading-relaxed">
              Press <span className="text-red-400 font-bold">SOS</span> button and help will reach you soon
            </p>
          </div>

          <button
            id="sos-trigger-btn"
            aria-label="Emergency SOS"
            onClick={handleSos}
            className="bg-[#DC2626] hover:bg-red-700 active:scale-95 transition-all text-white font-black text-sm tracking-wider px-5 py-3.5 rounded-xl shadow-lg flex-shrink-0 cursor-pointer animate-pulse"
            type="button"
          >
            SOS
          </button>
        </div>

        {/* Report Form */}
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          {/* Mobile Number Field */}
          <div className="flex flex-col space-y-1.5">
            <label htmlFor="mobile-number" className="text-sm font-semibold text-gray-200">
              Mobile Number
            </label>
            <input
              id="mobile-number"
              name="mobile-number"
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="Enter Mobile Number"
              className="w-full bg-[#161F2C] border border-[#283545] rounded-xl px-4 py-3.5 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] transition"
              required
            />
          </div>

          {/* Choose Service Radio Group */}
          <div className="flex flex-col space-y-2 pt-1">
            <span className="text-sm font-semibold text-gray-200">
              Choose Service
            </span>
            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="service_selection"
                  value="service"
                  checked={serviceType === 'service'}
                  onChange={() => setServiceType('service')}
                  className="w-5 h-5 text-[#EA580C] bg-[#161F2C] border-[#283545] focus:ring-[#EA580C] cursor-pointer"
                />
                <span className="text-sm font-medium text-white">
                  Service Number
                </span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="service_selection"
                  value="bus"
                  checked={serviceType === 'bus'}
                  onChange={() => setServiceType('bus')}
                  className="w-5 h-5 text-[#EA580C] bg-[#161F2C] border-[#283545] focus:ring-[#EA580C] cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-300">
                  Bus Number
                </span>
              </label>
            </div>
          </div>

          {/* Service / Bus Number Input Field */}
          <div>
            <input
              id="service-number"
              name="service-number"
              type="text"
              value={serviceValue}
              onChange={(e) => setServiceValue(e.target.value)}
              placeholder={serviceType === 'service' ? 'Enter Service Number (e.g. RT03)' : 'Enter Bus Number (e.g. AP23Z0073)'}
              className="w-full bg-[#161F2C] border border-[#283545] rounded-xl px-4 py-3.5 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] transition"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              id="submit-fleet-btn"
              type="submit"
              className="w-full bg-[#EA580C] hover:bg-[#c2410c] active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl text-center text-sm uppercase tracking-wide transition shadow cursor-pointer"
            >
              Submit To CAMPUS FLEET
            </button>
          </div>
        </form>

        {submitted && (
          <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-xl p-4 flex items-center space-x-3 text-emerald-200">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold block text-emerald-100">Emergency Incident Dispatched!</span>
              Campus Fleet Central Complaint Cell and Security patrol have received your report.
            </div>
          </div>
        )}
      </main>

      {/* Quick Call Footer */}
      <footer id="quick-call-footer" className="w-full max-w-md mx-auto px-4 pb-6 pt-4 flex flex-col items-center space-y-4">
        <p className="text-xs font-semibold text-gray-300 tracking-normal text-center">
          Call Central Complaint Cell (TGSBRTC)
        </p>

        {/* Quick Action Contact Buttons */}
        <div className="w-full grid grid-cols-3 gap-2.5">
          {/* Action 1: Campus Security */}
          <a
            href="tel:040-27201234"
            className="relative group flex flex-col items-center justify-center bg-[#0E141C] border border-[#EA580C] rounded-2xl py-3 px-1 text-center transition active:scale-95"
          >
            <div className="absolute -top-3.5 bg-[#090F16] border border-[#EA580C] p-1.5 rounded-full text-[#EA580C]">
              <Phone className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-[#EA580C] mt-2.5 leading-tight">
              Campus Security
            </span>
          </a>

          {/* Action 2: Ambulance */}
          <a
            href="tel:108"
            className="relative group flex flex-col items-center justify-center bg-[#0E141C] border border-[#EA580C] rounded-2xl py-3 px-1 text-center transition active:scale-95"
          >
            <div className="absolute -top-3.5 bg-[#090F16] border border-[#EA580C] p-1.5 rounded-full text-[#EA580C]">
              <Phone className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-[#EA580C] mt-2.5 leading-tight">
              Ambulance
            </span>
          </a>

          {/* Action 3: Send SMS */}
          <a
            href="sms:112?body=Emergency%20assistance%20needed%20at%20Campus%20Transit"
            className="relative group flex flex-col items-center justify-center bg-[#0E141C] border border-[#EA580C] rounded-2xl py-3 px-1 text-center transition active:scale-95"
          >
            <div className="absolute -top-3.5 bg-[#090F16] border border-[#EA580C] p-1.5 rounded-full text-[#EA580C]">
              <Send className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-[#EA580C] mt-2.5 leading-tight">
              Send SMS
            </span>
          </a>
        </div>

        {/* Home Indicator */}
        <div className="w-32 h-1 bg-slate-700 rounded-full mt-3"></div>
      </footer>

      {/* SOS Active Modal */}
      {sosActive && (
        <div className="fixed inset-0 bg-red-950/90 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1C0F12] border-2 border-red-500 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 bg-red-600/30 rounded-full flex items-center justify-center mx-auto border-2 border-red-500 animate-bounce">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider">
              SOS Signal Transmitted!
            </h3>
            <p className="text-xs text-red-200">
              Campus Security Patrol and Quick Response Ambulance have pinpointed your GPS coordinates at Hyderabad Campus Transit Station.
            </p>
            <div className="bg-red-950/60 p-3 rounded-xl text-xs font-mono text-white">
              Dispatch Ref: #EMG-9024 • Unit en route (ETA ~2 min)
            </div>
            <button
              onClick={() => setSosActive(false)}
              className="w-full py-3 bg-red-600 text-white font-bold rounded-xl text-sm uppercase hover:bg-red-700 active:scale-95 transition-all"
            >
              Dismiss / Cancel False Alarm
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
