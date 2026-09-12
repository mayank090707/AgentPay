import React from 'react';
import { FileText, Database, Cpu, ArrowRight } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

export default function RecentActivityTable({ transactions, onSelectTransaction, onViewAll }) {
  const getServiceIcon = (service) => {
    const name = (service || '').toLowerCase();
    if (name.includes('translation')) {
      return <FileText className="w-4 h-4 text-gray-600" />;
    }
    if (name.includes('storage')) {
      return <Database className="w-4 h-4 text-gray-600" />;
    }
    if (name.includes('compute')) {
      return <Cpu className="w-4 h-4 text-gray-600" />;
    }
    return <FileText className="w-4 h-4 text-gray-600" />;
  };

  return (
    <div className="bg-[#FFF9F5] rounded-2xl p-5 border border-[#E9D8CC] shadow-card flex flex-col justify-between h-full">
      {/* Table Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-[#343434]">Recent Activity</h3>
        <button 
          onClick={onViewAll}
          className="text-xs font-semibold text-gray-600 hover:text-[#343434] flex items-center space-x-1 group transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E9D8CC] text-gray-400 font-medium">
              <th className="pb-3 pr-2 font-normal">#</th>
              <th className="pb-3 px-2 font-normal">Service</th>
              <th className="pb-3 px-2 font-normal">Provider</th>
              <th className="pb-3 px-2 font-normal">Amount</th>
              <th className="pb-3 px-2 font-normal">Status</th>
              <th className="pb-3 pl-2 text-right font-normal">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5E6DC]">
            {transactions.map((tx) => (
              <tr 
                key={tx.request_id}
                onClick={() => onSelectTransaction(tx)}
                className="hover:bg-[#FDF8F5] cursor-pointer transition-colors group"
              >
                <td className="py-3.5 pr-2 font-semibold text-gray-700">
                  {tx.request_id}
                </td>
                <td className="py-3.5 px-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-gray-100 border border-gray-200 group-hover:bg-[#FAD2C0]/30 transition-colors">
                      {getServiceIcon(tx.service)}
                    </div>
                    <span className="font-semibold text-[#343434]">{tx.service}</span>
                  </div>
                </td>
                <td className="py-3.5 px-2 font-medium text-gray-600">
                  {tx.provider}
                </td>
                <td className="py-3.5 px-2 font-bold text-[#343434]">
                  ₹{tx.amount.toFixed(2)}
                </td>
                <td className="py-3.5 px-2">
                  <StatusBadge status={tx.delivery_status} />
                </td>
                <td className="py-3.5 pl-2 text-right text-gray-500 font-medium whitespace-nowrap">
                  {tx.timestamp}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
