import React from 'react';
import logoSrc from '../../assets/agentpay-logo.png';

export default function AgentPayLogo({ size = 'md', showTagline = false }) {
  const sizeClasses = {
    sm: 'h-10',
    md: 'h-14',
    lg: 'h-52',
  };

  return (
    <div className={`flex items-center select-none ${size === 'lg' ? 'flex-col' : ''}`}>
      <img
        src={logoSrc}
        alt="AgentPay Logo"
        className={`${sizeClasses[size] || sizeClasses.md} w-auto object-contain`}
        draggable={false}
      />
      {showTagline && (
        <p className={`${size === 'lg' ? 'text-sm mt-2 text-center' : 'text-sm ml-2'} font-extrabold tracking-tight`}>
          <span className="text-[#2D523E]">Agent</span><span className="text-[#F88D68]">Pay</span>
        </p>
      )}
    </div>
  );
}
