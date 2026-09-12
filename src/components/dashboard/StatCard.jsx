import React from 'react';
import { Wallet, Coins, PieChart, FileText } from 'lucide-react';

export default function StatCard({ type, title, value, subtitle, badgeText, progress }) {
  const renderIcon = () => {
    switch (type) {
      case 'budget':
        return (
          <div className="w-11 h-11 rounded-full bg-[#FAD2C0]/40 flex items-center justify-center text-[#d97d54] shrink-0 border border-[#FAD2C0]">
            <Wallet className="w-5 h-5" />
          </div>
        );
      case 'spent':
        return (
          <div className="w-11 h-11 rounded-full bg-[#E3F2FD] flex items-center justify-center text-[#2563EB] shrink-0 border border-[#BBDEFB]">
            <Coins className="w-5 h-5" />
          </div>
        );
      case 'remaining':
        return (
          <div className="w-11 h-11 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#3E8C5A] shrink-0 border border-[#C8E6C9]">
            <PieChart className="w-5 h-5" />
          </div>
        );
      case 'transactions':
        return (
          <div className="w-11 h-11 rounded-full bg-[#E3F2FD] flex items-center justify-center text-[#2563EB] shrink-0 border border-[#BBDEFB]">
            <FileText className="w-5 h-5" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#FFF9F5] rounded-2xl p-5 border border-[#E9D8CC] shadow-card flex items-start space-x-4 hover:border-[#FAD2C0] transition-all">
      {renderIcon()}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-500 tracking-tight">{title}</div>
        <div className="text-2xl font-bold text-[#343434] mt-0.5 tracking-tight">
          {value}
        </div>
        
        {subtitle && (
          <div className="text-xs text-gray-400 mt-1 font-normal">
            {subtitle}
          </div>
        )}

        {badgeText && (
          <div className="text-xs text-[#3E8C5A] font-semibold mt-1">
            {badgeText}
          </div>
        )}

        {progress !== undefined && (
          <div className="mt-2 flex items-center space-x-2">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-[#3B82F6] h-2 rounded-full transition-all duration-500" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-[#3B82F6] shrink-0">{progress}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
