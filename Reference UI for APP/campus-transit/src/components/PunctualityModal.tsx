import React from 'react';
import { X, TrendingUp, CheckCircle, Clock } from 'lucide-react';

interface PunctualityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PunctualityModal: React.FC<PunctualityModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const days = [
    { day: 'Mon', onTime: 98, delay: '2m avg' },
    { day: 'Tue', onTime: 95, delay: '4m avg' },
    { day: 'Wed', onTime: 99, delay: '1m avg' },
    { day: 'Thu', onTime: 96, delay: '3m avg' },
    { day: 'Fri', onTime: 94, delay: '5m avg' },
    { day: 'Sat', onTime: 97, delay: '2m avg' },
    { day: 'Sun', onTime: 100, delay: '0m avg' },
  ];

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
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold">Arrival Punctuality</h3>
            <p className="text-xs text-slate-400">Route RT03 (3K) • Last 7 Days</p>
          </div>
        </div>

        {/* Big Stat Pill */}
        <div className="bg-[#0E141C] border border-[#283545] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Overall On-Time Score</span>
            <span className="text-3xl font-extrabold text-[#EA580C]">96.8%</span>
          </div>
          <div className="text-right">
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>EXCELLENT</span>
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Avg dev: ±2.4 mins</span>
          </div>
        </div>

        {/* Daily Breakdown Bars */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Daily Performance</div>
          <div className="grid grid-cols-7 gap-1.5 items-end h-24 pt-2">
            {days.map((item) => (
              <div key={item.day} className="flex flex-col items-center h-full justify-end group">
                <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                  {item.onTime}%
                </span>
                <div
                  className="w-full bg-[#EA580C] rounded-t-md hover:brightness-110 transition-all"
                  style={{ height: `${(item.onTime - 80) * 4.5}%` }}
                ></div>
                <span className="text-[10px] font-semibold text-slate-400 mt-1.5">{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-[#EA580C] hover:bg-[#c2410c] text-white font-bold rounded-xl text-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
};
