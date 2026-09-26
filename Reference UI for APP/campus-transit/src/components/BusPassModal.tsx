import React from 'react';
import { X, QrCode, ShieldCheck, Bus, Sparkles } from 'lucide-react';

interface BusPassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BusPassModal: React.FC<BusPassModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-[#090F16]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#161C24] border border-[#283545] rounded-3xl p-5 shadow-2xl relative text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#1F2937] flex items-center justify-center text-slate-300 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#EA580C] flex items-center justify-center shadow">
            <Bus className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">Digital Bus Pass</h3>
            <p className="text-[11px] text-[#F97316] font-semibold uppercase tracking-wider">
              Campus Transit Authorized
            </p>
          </div>
        </div>

        {/* Digital Pass Card */}
        <div className="bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E293B] border-2 border-[#EA580C]/60 rounded-2xl p-4 relative overflow-hidden shadow-inner">
          {/* Hologram strip */}
          <div className="flex justify-between items-center pb-3 border-b border-slate-700/60">
            <div className="flex items-center space-x-1 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>VERIFIED ACTIVE PASS</span>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
              FALL SEM 2026
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400">STUDENT / COMMUTER</div>
              <div className="text-base font-extrabold text-white">V. Akhil</div>
              <div className="text-xs text-slate-300 font-mono mt-0.5">ID: CS-2024-8842</div>
            </div>
            <div className="w-14 h-14 bg-white p-1 rounded-xl shadow">
              <QrCode className="w-full h-full text-slate-900" />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">AUTHORIZED ZONE</span>
              <span className="font-bold text-slate-100">ALL CAMPUS GATES</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">VALID THRU</span>
              <span className="font-bold text-[#EA580C]">31 DEC 2026</span>
            </div>
          </div>

          <div className="mt-3 bg-[#EA580C]/10 border border-[#EA580C]/30 rounded-lg p-2 text-center text-[11px] text-orange-200 flex items-center justify-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>Tap NFC or show QR to transit conductor</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 bg-[#EA580C] hover:bg-[#c2410c] text-white font-bold rounded-xl text-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
};
