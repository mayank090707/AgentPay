import React from 'react';

export default function StatusBadge({ status }) {
  const normalized = (status || '').toLowerCase();
  
  if (normalized === 'delivered' || normalized === 'success' || normalized === 'successful') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
        Delivered
      </span>
    );
  }

  if (normalized === 'blocked' || normalized === 'failed' || normalized === 'rejected') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFEBEE] text-[#C94C4C] border border-[#FFCDD2]">
        Blocked
      </span>
    );
  }

  if (normalized === 'processing' || normalized === 'waiting') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#1976D2] border border-[#BBDEFB]">
        Processing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
      {status}
    </span>
  );
}
