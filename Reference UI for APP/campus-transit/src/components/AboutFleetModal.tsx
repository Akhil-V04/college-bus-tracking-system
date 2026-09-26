import React from 'react';
import { X, Info, Bus, Shield, Phone, Clock } from 'lucide-react';

interface AboutFleetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutFleetModal: React.FC<AboutFleetModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

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
          <div className="w-10 h-10 rounded-xl bg-[#EA580C] flex items-center justify-center">
            <Info className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold">About Campus Fleet</h3>
            <p className="text-xs text-slate-400">Integrated University Transportation</p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs text-slate-300">
          <div className="p-3 bg-[#0E141C] border border-[#283545] rounded-xl">
            <div className="flex items-center space-x-2 text-white font-bold mb-1">
              <Bus className="w-4 h-4 text-[#EA580C]" />
              <span>Fleet Overview</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Operating 45+ eco-friendly shuttle coaches connecting student hostels, academic blocks, research libraries, and metropolitan terminals.
            </p>
          </div>

          <div className="p-3 bg-[#0E141C] border border-[#283545] rounded-xl">
            <div className="flex items-center space-x-2 text-white font-bold mb-1">
              <Clock className="w-4 h-4 text-[#EA580C]" />
              <span>Service Hours</span>
            </div>
            <p className="text-slate-400">
              Monday to Sunday: 06:00 AM – 11:30 PM<br/>
              Night Shift Research Escort: 24/7 on call
            </p>
          </div>

          <div className="p-3 bg-[#0E141C] border border-[#283545] rounded-xl">
            <div className="flex items-center space-x-2 text-white font-bold mb-1">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Safety &amp; Compliance</span>
            </div>
            <p className="text-slate-400">
              Monitored by TGSBRTC &amp; Campus Security Dispatch with live GPS telemetry, dual emergency brakes, and panic alarms.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-[#EA580C] hover:bg-[#c2410c] text-white font-bold rounded-xl text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
};
