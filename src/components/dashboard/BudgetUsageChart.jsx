import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function BudgetUsageChart({ spent = 0, remaining = 0, total = 0, unit = '₹' }) {
  const safeSpent = Number(spent) || 0;
  const safeRemaining = Number(remaining) || 0;
  const safeTotal = Number(total) || (safeSpent + safeRemaining);

  const data = [
    { name: 'Spent', value: safeSpent, color: '#3B82F6' },
    { name: 'Remaining', value: safeRemaining, color: '#FCA5A5' }
  ];

  const spentPercentage = safeTotal > 0 
    ? Math.min(100, Math.max(0, Math.round((safeSpent / safeTotal) * 100))) 
    : 0;

  const formatValue = (val) => {
    if (unit === 'ETH') {
      return `${val} ETH`;
    }
    return `₹${Number(val).toFixed(2)}`;
  };

  return (
    <div className="bg-[#FFF9F5] rounded-2xl p-5 border border-[#E9D8CC] shadow-card flex flex-col justify-between h-full">
      <h3 className="text-base font-bold text-[#343434]">Budget Usage</h3>

      {/* Donut Chart with Center Text */}
      <div className="relative w-full h-44 flex items-center justify-center my-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={72}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black text-[#343434]">{spentPercentage}%</span>
          <span className="text-[11px] text-gray-500 font-medium">Spent</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-xs font-medium">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]"></span>
            <span className="text-[#343434]">{formatValue(safeSpent)}</span>
          </div>
          <span className="text-gray-500">Spent</span>
        </div>

        <div className="flex items-center justify-between text-xs font-medium">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FCA5A5]"></span>
            <span className="text-[#343434]">{formatValue(safeRemaining)}</span>
          </div>
          <span className="text-gray-500">Remaining</span>
        </div>
      </div>

      {/* Smart Contract Enforced Banner */}
      <div className="w-full bg-[#E3F2FD] border border-[#BBDEFB] rounded-xl p-3 flex items-center justify-between text-xs text-[#1E40AF] font-semibold">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
          <span>Enforced by Smart Contract</span>
        </div>
        <ArrowRight className="w-4 h-4 text-[#2563EB]" />
      </div>
    </div>
  );
}
