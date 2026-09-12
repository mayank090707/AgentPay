import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function SpendingChart({ data }) {
  return (
    <div className="bg-[#FFF9F5] rounded-2xl p-5 border border-[#E9D8CC] shadow-card flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-[#343434]">Spending Overview</h3>
        <div className="flex items-center space-x-4 text-xs font-medium">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#60A5FA]"></span>
            <span className="text-gray-600">Successful</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FCA5A5]"></span>
            <span className="text-gray-600 flex items-center">
              Blocked <span className="ml-1 text-gray-400">▾</span>
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0E2D8" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#737373', fontSize: 11 }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#737373', fontSize: 11 }}
              domain={[0, 200]}
              ticks={[0, 50, 100, 150, 200]}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(250, 210, 192, 0.2)' }}
              contentStyle={{ 
                backgroundColor: '#FFF9F5', 
                borderColor: '#E9D8CC', 
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                fontSize: '12px',
                color: '#343434'
              }}
              formatter={(value, name) => [`₹${value}`, name === 'successful' ? 'Successful' : 'Blocked']}
            />
            <Bar dataKey="successful" stackId="a" fill="#60A5FA" radius={[0, 0, 4, 4]} barSize={28} />
            <Bar dataKey="blocked" stackId="a" fill="#FCA5A5" radius={[6, 6, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
