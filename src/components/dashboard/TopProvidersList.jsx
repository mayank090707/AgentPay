import React from 'react';
import { ArrowRight, Languages, Database, Cloud, Star } from 'lucide-react';

export default function TopProvidersList({ providers, onViewAll }) {
  const getProviderIcon = (type) => {
    switch (type) {
      case 'translation':
        return (
          <div className="w-10 h-10 rounded-full bg-[#E8F5E9] border border-[#C8E6C9] flex items-center justify-center text-[#3E8C5A] shrink-0">
            <Languages className="w-5 h-5" />
          </div>
        );
      case 'storage':
        return (
          <div className="w-10 h-10 rounded-full bg-[#E3F2FD] border border-[#BBDEFB] flex items-center justify-center text-[#2563EB] shrink-0">
            <Database className="w-5 h-5" />
          </div>
        );
      case 'compute':
        return (
          <div className="w-10 h-10 rounded-full bg-[#E3F2FD] border border-[#BBDEFB] flex items-center justify-center text-[#2563EB] shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
            <Database className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <div className="bg-[#FFF9F5] rounded-2xl p-5 border border-[#E9D8CC] shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-[#343434]">Top Providers</h3>
        <button 
          onClick={onViewAll}
          className="text-xs font-semibold text-gray-600 hover:text-[#343434] flex items-center space-x-1 group transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <div className="space-y-3.5">
        {providers.map((p) => (
          <div 
            key={p.id}
            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#FDF8F5] transition-colors border border-transparent hover:border-[#E9D8CC]"
          >
            <div className="flex items-center space-x-3">
              {getProviderIcon(p.iconType)}
              <div>
                <div className="text-xs font-bold text-[#343434]">{p.name}</div>
                <div className="text-[11px] text-gray-500 font-medium">{p.service}</div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold text-[#343434]">
                ₹{p.pricePerRequest} <span className="text-[10px] text-gray-400 font-normal">/ request</span>
              </div>
              <div className="flex items-center justify-end space-x-1 text-[11px] text-amber-500 font-semibold mt-0.5">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{p.rating}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
