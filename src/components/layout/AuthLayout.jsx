import React from 'react';
import { Outlet } from 'react-router-dom';
import AgentPayLogo from '../common/AgentPayLogo';
import { Bot, ShieldCheck, TrendingUp } from 'lucide-react';
import authBg from '../../assets/auth-bg.png';

export default function AuthLayout() {
  return (
    <div 
      className="min-h-screen flex flex-col justify-between p-6 md:p-10 relative overflow-hidden font-sans select-none bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${authBg})` }}
    >
      {/* Soft overlay blend for backdrop readability */}
      <div className="absolute inset-0 bg-[#FFF9F5]/30 pointer-events-none"></div>

      {/* Decorative Vector Liquid Accent Shapes */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#FAD2C0]/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-[30rem] h-[30rem] bg-[#A8BFA3]/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-[#E3F2FD]/40 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header Tag (Right Aligned) */}
      <div className="w-full flex justify-end relative z-10">
        <div className="text-right hidden sm:block">
          <span className="text-xs font-serif italic text-gray-600 tracking-wide bg-white/60 px-3 py-1 rounded-full border border-[#E9D8CC]">
            Trusted by builders of a safer AI economy
          </span>
        </div>
      </div>

      {/* Main Two-Column Container (Symmetrical Grid) */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-6 relative z-10 my-auto">
        
        {/* LEFT COLUMN: Brand & Marketing Section */}
        <div className="lg:col-span-6 flex flex-col items-center text-center space-y-8 lg:pl-12 lg:pr-4">
          {/* Logo */}
          <AgentPayLogo size="lg" showTagline={false} />

          {/* 3 Feature Badges */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-md pt-2">
            <div className="bg-white/85 border border-[#E9D8CC] backdrop-blur-md p-3.5 rounded-2xl flex flex-col items-center text-center shadow-xs hover:border-[#FAD2C0] transition-colors">
              <div className="w-10 h-10 rounded-full bg-[#E3F2FD] border border-[#BBDEFB] flex items-center justify-center text-[#2563EB] mb-2">
                <Bot className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-[#343434] leading-tight">Autonomous AI Agents</span>
            </div>

            <div className="bg-white/85 border border-[#E9D8CC] backdrop-blur-md p-3.5 rounded-2xl flex flex-col items-center text-center shadow-xs hover:border-[#FAD2C0] transition-colors">
              <div className="w-10 h-10 rounded-full bg-[#E8F5E9] border border-[#C8E6C9] flex items-center justify-center text-[#3E8C5A] mb-2">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-[#343434] leading-tight">Secure Payments</span>
            </div>

            <div className="bg-white/85 border border-[#E9D8CC] backdrop-blur-md p-3.5 rounded-2xl flex flex-col items-center text-center shadow-xs hover:border-[#FAD2C0] transition-colors">
              <div className="w-10 h-10 rounded-full bg-[#FAD2C0]/40 border border-[#FAD2C0] flex items-center justify-center text-[#d97d54] mb-2">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-[#343434] leading-tight">Real Value</span>
            </div>
          </div>

          {/* Quote Block */}
          <div className="pt-1 bg-white/60 backdrop-blur-xs px-4 py-2 rounded-2xl border border-[#E9D8CC]/60">
            <p className="text-sm font-serif italic text-gray-700">
              &ldquo;Autonomous agents. Accountable spending.&rdquo;
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Authentication Form Card */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end w-full lg:pr-6">
          <div className="w-full max-w-md bg-white/95 border border-[#E9D8CC] rounded-[32px] p-8 sm:p-10 shadow-card backdrop-blur-md relative">
            <Outlet />
          </div>
        </div>
      </div>

      {/* Bottom Left Watermark Text */}
      <div className="relative z-10 text-left hidden sm:block">
        <p className="text-[10px] font-mono tracking-widest text-gray-500 uppercase leading-tight bg-white/60 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-[#E9D8CC] w-fit">
          SMARTER PAYMENTS • BRIGHTER POSSIBILITIES
        </p>
      </div>
    </div>
  );
}
