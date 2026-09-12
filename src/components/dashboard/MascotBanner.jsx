import React from 'react';
import { ArrowRight, Bot } from 'lucide-react';

export default function MascotBanner({ onAction }) {
  return (
    <div className="bg-gradient-to-r from-[#E3F2FD] to-[#E8F0FE] border border-[#BBDEFB] rounded-2xl p-4 flex items-center justify-between shadow-card relative overflow-hidden">
      <div className="flex items-center space-x-3 z-10">
        <div className="w-12 h-12 rounded-full bg-white border border-[#90CAF9] flex items-center justify-center text-[#2563EB] shadow-xs shrink-0">
          <Bot className="w-7 h-7 text-[#2563EB]" />
        </div>
        <div>
          <p className="text-xs font-semibold text-[#1E3A8A] leading-snug">
            Let your agent do the work.
          </p>
          <p className="text-xs font-medium text-[#2563EB]">
            You stay in control.
          </p>
        </div>
      </div>

      <button
        onClick={onAction}
        className="w-9 h-9 rounded-full bg-[#3B82F6] hover:bg-[#2563EB] text-white flex items-center justify-center shadow-md transition-transform hover:scale-105 shrink-0 z-10"
        title="View Agent Settings"
      >
        <ArrowRight className="w-4 h-4" />
      </button>

      {/* Subtle background decoration */}
      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/40 rounded-full blur-xl pointer-events-none"></div>
    </div>
  );
}
