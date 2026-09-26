import React, { useState } from 'react';
import { Bell, ChevronDown, Check } from 'lucide-react';

interface RemindMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (station: string, minutes: number) => void;
  currentStation?: string;
}

const STATIONS = [
  'CBS',
  'LALAPET twd Moula Ali',
  'INDUSTRIAL Estate twd Kushaiguda',
  'CHADARGHAT(M) twd Koti',
  'KOTI MATERNITY HOSPITAL',
  'ECIL Terminal',
];

export const RemindMeModal: React.FC<RemindMeModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  currentStation = 'CBS',
}) => {
  const [selectedStation, setSelectedStation] = useState(currentStation);
  const [minutes, setMinutes] = useState(1);
  const [showDropdown, setShowDropdown] = useState(false);

  if (!isOpen) return null;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinutes(parseInt(e.target.value, 10));
  };

  const handleCreate = () => {
    onCreated(selectedStation, minutes);
    onClose();
  };

  const sliderPercentage = ((minutes - 1) / (5 - 1)) * 100;

  return (
    <div
      id="modal-overlay"
      className="absolute inset-0 bg-[#090F16]/65 backdrop-blur-[2px] z-50 flex items-center justify-center px-4"
    >
      {/* Remind Me Modal Card */}
      <div
        id="remind-me-dialog"
        className="w-full max-w-[342px] bg-[#161C24] border border-[#283545] rounded-2xl p-5 shadow-2xl transition-all"
      >
        {/* Header: Bell Badge & Title */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-[#3D2114] flex items-center justify-center shrink-0 border border-[#5A2A1A]/60 shadow-inner">
            <Bell className="w-5 h-5 text-[#EA580C] fill-current" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Remind Me</h2>
        </div>

        {/* Station Dropdown Selector */}
        <div className="mb-5 relative" id="station-selector">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full flex items-center justify-between bg-[#1C2430] hover:bg-[#202937] active:bg-[#222C3A] text-slate-100 font-semibold px-4 py-3 rounded-xl border border-[#283545] focus:outline-none focus:ring-2 focus:ring-orange-500/60 transition-all text-sm cursor-pointer"
            type="button"
          >
            <span className="tracking-wide">{selectedStation}</span>
            <ChevronDown className={`w-4 h-4 text-slate-300 stroke-[2.5] transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1C2430] border border-[#283545] rounded-xl shadow-2xl py-1 z-30 max-h-48 overflow-y-auto">
              {STATIONS.map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setSelectedStation(st);
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-[#283545] flex items-center justify-between transition-colors"
                >
                  <span>{st}</span>
                  {selectedStation === st && <Check className="w-3.5 h-3.5 text-[#EA580C]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Range Slider Section */}
        <div className="mb-5 px-1" id="time-range-section">
          {/* Track & thumb */}
          <div className="relative py-2 flex items-center">
            {/* Dots */}
            <div className="absolute inset-x-2 flex justify-between pointer-events-none px-1">
              {[1, 2, 3, 4, 5].map((step) => (
                <span
                  key={step}
                  className={`w-1.5 h-1.5 rounded-full ${step <= minutes ? 'bg-[#EA580C]' : 'bg-slate-600'}`}
                ></span>
              ))}
            </div>

            <input
              id="timeSlider"
              type="range"
              min={1}
              max={5}
              step={1}
              value={minutes}
              onChange={handleSliderChange}
              aria-label="Reminder time in minutes"
              className="w-full h-1.5 bg-slate-700 appearance-none cursor-pointer focus:outline-none z-10 rounded-full"
              style={{
                accentColor: '#EA580C',
                background: `linear-gradient(to right, #EA580C 0%, #EA580C ${sliderPercentage}%, #283545 ${sliderPercentage}%, #283545 100%)`,
              }}
            />
          </div>

          {/* Slider Labels */}
          <div className="flex justify-between text-[11px] font-medium text-slate-400 mt-1 select-none">
            <span>1 min</span>
            <span className="text-[#EA580C] font-bold">{minutes} min selected</span>
            <span>5 min</span>
          </div>
        </div>

        {/* Informational Helper Pill */}
        <div
          id="helper-pill"
          className="mb-5 bg-gradient-to-r from-[#251A14] to-[#3D2114] border border-[#5A2A1A] rounded-xl py-2.5 px-3 text-center text-xs text-slate-200"
        >
          <p className="leading-snug">
            Minutes before getting down at{' '}
            <span className="text-[#EA580C] font-bold">{selectedStation}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3" id="action-buttons">
          <button
            id="cancel-reminder-btn"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[#334155] bg-transparent text-white font-semibold text-sm hover:bg-slate-800/60 active:bg-slate-800 transition-colors focus:outline-none text-center cursor-pointer"
            type="button"
          >
            Cancel
          </button>
          <button
            id="create-reminder-btn"
            onClick={handleCreate}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#EA580C] hover:bg-[#c2410c] active:bg-orange-700 text-white font-bold text-sm shadow-lg shadow-orange-900/30 transition-all focus:outline-none text-center cursor-pointer"
            type="button"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};
