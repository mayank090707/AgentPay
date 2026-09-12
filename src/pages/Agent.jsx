import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Search, 
  CreditCard, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  FileCheck2, 
  Play, 
  RotateCcw, 
  ArrowRight,
  ShieldAlert,
  Clock,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  mockAgentDetails, 
  mockCurrentTask, 
  mockPipelineSteps, 
  mockAgentLogs,
  mockRetryState 
} from '../data/mockData';

export default function Agent() {
  const [activeStep, setActiveStep] = useState(7); // Default to Step 7 (Delivered)
  const [isSimulating, setIsSimulating] = useState(false);
  const [logs, setLogs] = useState(mockAgentLogs);

  // Auto-play demo controller
  useEffect(() => {
    let timer;
    if (isSimulating) {
      if (activeStep < 7) {
        timer = setTimeout(() => {
          setActiveStep((prev) => prev + 1);
        }, 1200);
      } else {
        setIsSimulating(false);
      }
    }
    return () => clearTimeout(timer);
  }, [isSimulating, activeStep]);

  const handleStartDemo = () => {
    setActiveStep(1);
    setIsSimulating(true);
  };

  const handleSimulatePayment = () => {
    setIsSimulating(false);
    setActiveStep(6);
  };

  const handleSimulateDelivery = () => {
    setIsSimulating(false);
    setActiveStep(7);
  };

  const handleReset = () => {
    setIsSimulating(false);
    setActiveStep(1);
  };

  const getStepIcon = (iconName) => {
    switch (iconName) {
      case 'Send': return Send;
      case 'Search': return Search;
      case 'CreditCard': return CreditCard;
      case 'KeyRound': return KeyRound;
      case 'ShieldCheck': return ShieldCheck;
      case 'CheckCircle': return CheckCircle2;
      case 'FileCheck': return FileCheck2;
      default: return Bot;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn select-none">
      {/* 1. Page Header & Agent Status Card */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 sm:p-8 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FAD2C0]/40 border border-[#FAD2C0] flex items-center justify-center text-[#d97d54]">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black text-[#343434]">AI Agent</h1>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                  <span className="w-2 h-2 rounded-full bg-[#3E8C5A] animate-pulse"></span>
                  <span>ONLINE</span>
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Monitor what your autonomous agent is doing in real time.
              </p>
            </div>
          </div>
        </div>

        {/* Agent Metadata Stats Pill */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto text-xs">
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl">
            <span className="text-gray-400 font-medium block text-[10px] uppercase">Agent Name</span>
            <span className="font-bold text-[#343434]">{mockAgentDetails.name}</span>
          </div>
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl">
            <span className="text-gray-400 font-medium block text-[10px] uppercase">Network</span>
            <span className="font-bold text-[#3B82F6]">{mockAgentDetails.network}</span>
          </div>
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl">
            <span className="text-gray-400 font-medium block text-[10px] uppercase">Spent / Budget</span>
            <span className="font-extrabold text-[#343434]">₹{mockAgentDetails.totalSpent} / ₹{mockAgentDetails.totalBudget}</span>
          </div>
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl">
            <span className="text-gray-400 font-medium block text-[10px] uppercase">Remaining Cap</span>
            <span className="font-extrabold text-[#3E8C5A]">₹{mockAgentDetails.remainingBudget}</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Demo Controls & Current Task */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CURRENT TASK CARD (8 Cols) */}
        <div className="lg:col-span-8 bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400">
              CURRENT TASK
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              activeStep === 7 
                ? 'bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]' 
                : 'bg-[#FAD2C0]/40 text-[#d97d54] border border-[#FAD2C0]'
            }`}>
              {activeStep === 7 ? '✓ Delivered' : `Step ${activeStep} of 7: Processing`}
            </span>
          </div>

          <div className="bg-white border border-[#E9D8CC] p-4 rounded-2xl space-y-3">
            <h3 className="text-base font-extrabold text-[#343434]">
              &ldquo;{mockCurrentTask.prompt}&rdquo;
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div>
                <span className="text-gray-400 block text-[10px]">Service</span>
                <span className="font-bold text-[#343434]">{mockCurrentTask.service}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">Provider</span>
                <span className="font-bold text-[#343434]">{mockCurrentTask.provider}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">Requested Amount</span>
                <span className="font-extrabold text-[#343434]">₹{mockCurrentTask.requestedAmount}.00</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">Request ID</span>
                <code className="font-mono text-[#55705C] bg-[#FDF8F5] px-1.5 py-0.5 rounded border border-[#E9D8CC]">
                  #{mockCurrentTask.request_id}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* DEMO CONTROLS (4 Cols) */}
        <div className="lg:col-span-4 bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-widest font-bold text-gray-400 mb-1">
              DEMO CONTROLS
            </h3>
            <p className="text-xs text-gray-500">Simulate agent lifecycle execution steps for judges.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={handleStartDemo}
              disabled={isSimulating}
              className="py-2.5 px-3 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-[#343434]" />
              <span>Start Demo</span>
            </button>

            <button
              onClick={handleSimulatePayment}
              className="py-2.5 px-3 bg-white hover:bg-gray-50 border border-[#E9D8CC] text-[#343434] font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1 transition-all cursor-pointer"
            >
              <span>Simulate Payment</span>
            </button>

            <button
              onClick={handleSimulateDelivery}
              className="py-2.5 px-3 bg-white hover:bg-gray-50 border border-[#E9D8CC] text-[#343434] font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1 transition-all cursor-pointer"
            >
              <span>Simulate Delivery</span>
            </button>

            <button
              onClick={handleReset}
              className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center space-x-1 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. SERVICE EXECUTION PIPELINE */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-4">
          <div>
            <h2 className="text-lg font-black text-[#343434] flex items-center space-x-2">
              <Layers className="w-5 h-5 text-[#3B82F6]" />
              <span>Service Execution Lifecycle Pipeline</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Visualizing the 7-stage HTTP 402 autonomous payment and delivery process.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-gray-400 hidden sm:block">
            Step {activeStep} / 7
          </span>
        </div>

        {/* Horizontal Pipeline Steps */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 relative">
          {mockPipelineSteps.map((step) => {
            const Icon = getStepIcon(step.icon);
            const isCompleted = step.step < activeStep;
            const isCurrent = step.step === activeStep;
            const isPending = step.step > activeStep;

            return (
              <div 
                key={step.id} 
                onClick={() => setActiveStep(step.step)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                  isCompleted 
                    ? 'bg-[#E8F5E9]/60 border-[#C8E6C9] text-[#343434]' 
                    : isCurrent 
                    ? 'bg-[#FAD2C0]/40 border-[#FAD2C0] ring-2 ring-[#FAD2C0]/50 text-[#343434] shadow-sm' 
                    : 'bg-white/60 border-[#E9D8CC] text-gray-400'
                }`}
              >
                <div>
                  {/* Step Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isCompleted 
                        ? 'bg-[#3E8C5A] text-white' 
                        : isCurrent 
                        ? 'bg-[#d97d54] text-white' 
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-gray-400">0{step.step}</span>
                  </div>

                  {/* Title & Desc */}
                  <h4 className="text-xs font-extrabold text-[#343434] leading-tight mb-1">
                    {step.title}
                  </h4>
                  <p className="text-[10px] text-gray-500 leading-normal line-clamp-2">
                    {step.description}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="mt-4 pt-2 border-t border-[#E9D8CC]/50 flex items-center justify-between text-[10px]">
                  <span className={`font-bold ${
                    isCompleted ? 'text-[#3E8C5A]' : isCurrent ? 'text-[#d97d54]' : 'text-gray-400'
                  }`}>
                    {isCompleted ? '✓ Done' : isCurrent ? '● Active' : 'Waiting'}
                  </span>
                  <span className="text-gray-400 font-mono text-[9px]">{step.timestamp}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. IMPORTANT SECURITY NOTICE BANNER */}
      <div className="p-4 bg-[#E3F2FD] border border-[#BBDEFB] rounded-2xl flex items-start space-x-3 text-xs text-[#1E3A8A]">
        <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold text-sm block text-[#1E293B] mb-0.5">
            🔒 Smart Contract Enforced Budget Security
          </span>
          <p className="text-gray-700 leading-relaxed">
            Budget authorization for Step 5 is strictly enforced on-chain by the Sepolia Solidity smart contract. 
            The frontend and AI prompt do not possess payment override authority; spending limit checks are executed independently by the contract.
          </p>
        </div>
      </div>

      {/* 5. ACTIVITY LOG & PAYMENT INFORMATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* REAL-TIME ACTIVITY LOG (6 Cols) */}
        <div className="lg:col-span-6 bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4">
          <h3 className="text-sm font-extrabold text-[#343434] flex items-center space-x-2">
            <Clock className="w-4 h-4 text-[#3B82F6]" />
            <span>Real-time Activity Feed</span>
          </h3>

          <div className="space-y-2.5 font-mono text-xs max-h-64 overflow-y-auto pr-1">
            {logs.map((log, idx) => (
              <div key={idx} className="p-2.5 bg-white border border-[#E9D8CC] rounded-xl flex items-start space-x-3">
                <span className="text-[11px] font-bold text-[#3B82F6] bg-[#E3F2FD] px-1.5 py-0.5 rounded shrink-0">
                  {log.time}
                </span>
                <span className="text-gray-700 text-[11px] font-sans">{log.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PAYMENT & DELIVERY INFORMATION (6 Cols) */}
        <div className="lg:col-span-6 bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4">
          <h3 className="text-sm font-extrabold text-[#343434] flex items-center space-x-2">
            <CreditCard className="w-4 h-4 text-[#3E8C5A]" />
            <span>Transaction Details (Request #A104)</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white border border-[#E9D8CC] rounded-xl">
              <span className="text-gray-400 block text-[10px]">Payment Status</span>
              <span className="font-bold text-[#3E8C5A]">● Confirmed (Sepolia)</span>
            </div>
            <div className="p-3 bg-white border border-[#E9D8CC] rounded-xl">
              <span className="text-gray-400 block text-[10px]">Delivery Status</span>
              <span className="font-bold text-[#3E8C5A]">✓ Delivered</span>
            </div>
            <div className="p-3 bg-white border border-[#E9D8CC] rounded-xl col-span-2">
              <span className="text-gray-400 block text-[10px]">Payment Tx Hash</span>
              <code className="font-mono text-[#55705C] bg-[#FDF8F5] px-2 py-0.5 rounded border border-[#E9D8CC] text-[11px] block truncate">
                0x89f2a1b0c9e8d7f6a5b4c3d2e1f0
              </code>
            </div>
            <div className="p-3 bg-white border border-[#E9D8CC] rounded-xl col-span-2">
              <span className="text-gray-400 block text-[10px]">Payload Content Hash</span>
              <code className="font-mono text-gray-700 bg-[#FDF8F5] px-2 py-0.5 rounded border border-[#E9D8CC] text-[11px] block truncate">
                0x4e8d2a1b9c8f7e6d5c4b3a21
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* 6. RETRY STATE & DUPLICATE PROTECTION DEMO */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-[#343434] flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-[#d97d54]" />
            <span>Network Interruption & On-Chain Retry Protection</span>
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
            Protected
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs bg-white border border-[#E9D8CC] p-4 rounded-2xl">
          <div>
            <span className="text-gray-400 block text-[10px]">Payment Attempt</span>
            <span className="font-bold text-[#343434]">{mockRetryState.attemptStatus}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">Network State</span>
            <span className="font-bold text-amber-600">{mockRetryState.networkState}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">Retry Lock</span>
            <span className="font-bold text-[#3B82F6]">Detected</span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">Request ID</span>
            <code className="font-mono text-[#55705C] bg-[#FDF8F5] px-1 py-0.5 rounded border border-[#E9D8CC]">
              #{mockRetryState.request_id}
            </code>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">Additional Charge</span>
            <span className="font-extrabold text-[#3E8C5A]">₹0.00 (Prevented)</span>
          </div>
        </div>

        <p className="text-[11px] text-gray-500 font-serif italic pt-1">
          * Note: On-chain smart contract maps Request ID #A104 to completed transaction state. Any duplicate network retry re-uses the existing hash without deducting additional funds.
        </p>
      </div>
    </div>
  );
}
