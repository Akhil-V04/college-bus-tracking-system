import React, { useState } from 'react';
import { X, HandMetal, CheckCircle2, Bus, MapPin } from 'lucide-react';

interface FlagBusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FlagBusModal: React.FC<FlagBusModalProps> = ({ isOpen, onClose }) => {
  const [stop, setStop] = useState('CBS Station');
  const [busRoute, setBusRoute] = useState('RT03 (3K) - ECIL to Campus');
  const [flagged, setFlagged] = useState(false);

  if (!isOpen) return null;

  const handleFlag = () => {
    setFlagged(true);
    setTimeout(() => {
      setFlagged(false);
      onClose();
    }, 2400);
  };

  return (
    <div className="absolute inset-0 bg-[#090F16]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#161C24] border border-[#283545] rounded-3xl p-5 shadow-2xl relative text-white space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#1F2937] flex items-center justify-center text-slate-300 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#EA580C] flex items-center justify-center shadow">
            <HandMetal className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold">Flag an Approaching Bus</h3>
            <p className="text-xs text-slate-400">Signal the driver to halt at your stop</p>
          </div>
        </div>

        {!flagged ? (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Your Current Stop</label>
              <div className="flex items-center space-x-2 bg-[#0E141C] border border-[#283545] p-3 rounded-xl">
                <MapPin className="w-4 h-4 text-[#EA580C]" />
                <span className="font-semibold text-white">{stop}</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Select Approaching Route</label>
              <select
                value={busRoute}
                onChange={(e) => setBusRoute(e.target.value)}
                className="w-full bg-[#0E141C] border border-[#283545] p-3 rounded-xl text-white font-medium focus:outline-none focus:border-[#EA580C]"
              >
                <option value="RT03 (3K) - ECIL to Campus">RT03 (3K) - ECIL to Campus (ETA 3m)</option>
                <option value="RT01 (222P) - Central Hub">RT01 (222P) - Central Hub (ETA 6m)</option>
                <option value="RT07 (100B) - City Square">RT07 (100B) - City Square (ETA 9m)</option>
              </select>
            </div>

            <p className="text-[11px] text-slate-400 leading-tight">
              Signaling alerts the driver's cockpit console that passengers are waiting at {stop}.
            </p>

            <button
              onClick={handleFlag}
              className="w-full mt-2 py-3.5 bg-[#EA580C] hover:bg-[#c2410c] text-white font-bold rounded-xl text-sm uppercase tracking-wide flex items-center justify-center space-x-2 shadow-lg cursor-pointer"
            >
              <HandMetal className="w-4 h-4" />
              <span>Flag This Bus Now</span>
            </button>
          </div>
        ) : (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <div className="text-base font-bold text-white">Signal Transmitted to Driver!</div>
            <p className="text-xs text-slate-300">
              Driver Mr. P.Sataiah has acknowledged the stop request at <span className="text-[#EA580C] font-semibold">{stop}</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
