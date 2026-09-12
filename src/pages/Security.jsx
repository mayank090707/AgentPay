import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  RefreshCw, 
  FileCheck2, 
  KeyRound, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Cpu,
  Bot,
  Send,
  CreditCard,
  Building,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { useBlockchain } from '../context/BlockchainContext';
import { fetchAuditLogs, parseAuditLogsToTransactions } from '../services/api';
import { 
  mockSecurityState, 
  mockSecurityEvents, 
  mockSpendingCapDemo, 
  mockAgentVsContractComparison, 
  mockSecurityGuarantees 
} from '../data/mockData';
import StatusBadge from '../components/common/StatusBadge';

export default function Security() {
  // Live Blockchain Context Read
  const { budget } = useBlockchain();

  // Audit Logs State
  const [events, setEvents] = useState(mockSecurityEvents);
  const [liveBlockedCount, setLiveBlockedCount] = useState(2);
  const [isBackendLive, setIsBackendLive] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadSecurityLogs() {
      try {
        const res = await fetchAuditLogs({ limit: 50 });
        if (!isMounted) return;
        if (res && Array.isArray(res.logs) && res.logs.length > 0) {
          const parsed = parseAuditLogsToTransactions(res.logs);
          const formattedEvents = res.logs.map((log) => ({
            timestamp: log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A',
            request_id: log.request_id,
            eventType: log.event_type,
            amount: log.details?.amount || 0,
            status: log.event_type.includes('EXCEEDED') || log.event_type.includes('BLOCKED') || log.event_type.includes('REJECTED')
              ? 'BLOCKED'
              : log.event_type.includes('DUPLICATE')
              ? 'PREVENTED'
              : 'APPROVED',
            details: typeof log.details === 'object' ? JSON.stringify(log.details) : log.details,
          }));
          setEvents(formattedEvents);
          setLiveBlockedCount(parsed.filter(t => t.delivery_status === 'Blocked').length);
          setIsBackendLive(true);
        }
      } catch (err) {
        // keep default mock security events if offline
      }
    }
    loadSecurityLogs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Demo Control Handlers (purely updates frontend presentation simulation)
  const [demoState, setDemoState] = useState({
    budgetDisplay: budget ? `${budget.budgetEth} ETH` : `₹500.00`,
    spentDisplay: budget ? `${budget.totalSpentEth} ETH` : `₹320.00`,
    remainingDisplay: budget ? `${budget.remainingEth} ETH` : `₹180.00`,
    blockedAttempts: liveBlockedCount,
    duplicatesPrevented: 0,
    activeNotice: null
  });

  // Update demoState when contract budget loads
  useEffect(() => {
    if (budget) {
      setDemoState((prev) => ({
        ...prev,
        budgetDisplay: `${budget.budgetEth} ETH`,
        spentDisplay: `${budget.totalSpentEth} ETH`,
        remainingDisplay: `${budget.remainingEth} ETH`,
      }));
    }
  }, [budget]);

  const handleSimulateApproved = () => {
    const newTx = {
      timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
      request_id: 'A' + Math.floor(100 + Math.random() * 900),
      eventType: 'Payment Authorized',
      amount: '0.00005 ETH',
      status: 'APPROVED',
      details: 'Approved by Sepolia contract: 0.00005 ETH within remaining budget cap'
    };
    setEvents([newTx, ...events]);
    setDemoState(prev => ({
      ...prev,
      activeNotice: `PAYMENT AUTHORIZED — Approved ${newTx.amount} by contract state`
    }));
  };

  const handleSimulateBlocked = () => {
    const newTx = {
      timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
      request_id: 'A' + Math.floor(100 + Math.random() * 900),
      eventType: 'Budget Exceeded',
      amount: '10.0 ETH',
      status: 'BLOCKED',
      details: 'Rejected by contract: Attempted 10.0 ETH exceeds remaining budget cap'
    };
    setEvents([newTx, ...events]);
    setDemoState(prev => ({
      ...prev,
      blockedAttempts: prev.blockedAttempts + 1,
      activeNotice: `PAYMENT BLOCKED — Contract rejected request: BUDGET_EXCEEDED`
    }));
  };

  const handleSimulateRetry = () => {
    const newTx = {
      timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
      request_id: 'A104',
      eventType: 'Duplicate Retry',
      amount: '0 ETH',
      status: 'PREVENTED',
      details: 'DUPLICATE PAYMENT PREVENTED: Replay attack blocked on-chain (Additional Charge: 0.00 ETH)'
    };
    setEvents([newTx, ...events]);
    setDemoState(prev => ({
      ...prev,
      duplicatesPrevented: prev.duplicatesPrevented + 1,
      activeNotice: `DUPLICATE PAYMENT PREVENTED — Additional Charge: 0.00 ETH`
    }));
  };

  const handleResetDemo = () => {
    setEvents(mockSecurityEvents);
    setDemoState({
      budgetDisplay: budget ? `${budget.budgetEth} ETH` : `₹500.00`,
      spentDisplay: budget ? `${budget.totalSpentEth} ETH` : `₹320.00`,
      remainingDisplay: budget ? `${budget.remainingEth} ETH` : `₹180.00`,
      blockedAttempts: liveBlockedCount,
      duplicatesPrevented: 0,
      activeNotice: 'Demo state reset to initial contract state values.'
    });
  };

  return (
    <div className="space-y-8 animate-fadeIn select-none">
      
      {/* 1. Page Header & Security Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-[#343434] tracking-tight">Security Center</h1>
            {budget ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3E8C5A] animate-pulse"></span>
                <span>Sepolia Solidity Guard Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
                <span>⚡ Offline / Demo Mode</span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Budget limits & payments are strictly enforced on-chain by Solidity smart contract <code className="font-mono text-[#2563EB]">0x220b...99B6</code>.
          </p>
        </div>

        {/* Prominent Security Banner */}
        <div className="bg-[#E8F5E9] border border-[#C8E6C9] px-4 py-3 rounded-2xl flex items-center space-x-3 text-xs text-[#2E7D32] max-w-xl shadow-xs">
          <ShieldCheck className="w-6 h-6 text-[#3E8C5A] shrink-0" />
          <div>
            <div className="flex items-center space-x-2 font-bold">
              <span className="w-2 h-2 rounded-full bg-[#3E8C5A]"></span>
              <span>Solidity Smart Contract Enforcement</span>
            </div>
            <p className="text-[11px] text-[#3E8C5A] leading-tight font-medium mt-0.5">
              Payment authorization is NOT enforced by React code. Hard budget limits are executed immutably by AgentPay.sol on Sepolia.
            </p>
          </div>
        </div>
      </div>

      {/* Demo State Interactive Toast Notice */}
      {demoState.activeNotice && (
        <div className="p-3 bg-[#E3F2FD] border border-[#BBDEFB] text-[#1E3A8A] rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <span>🛡️ {demoState.activeNotice}</span>
          <button onClick={() => setDemoState(prev => ({ ...prev, activeNotice: null }))} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 2. Security Overview Cards — LIVE VALUES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Hard Contract Limit
          </span>
          <div className="text-2xl font-black text-[#343434]">
            {demoState.budgetDisplay}
          </div>
          <span className="text-[10px] text-gray-500 font-semibold mt-1 block">Solidity Enforced (Sepolia)</span>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Current Contract Spend
          </span>
          <div className="text-2xl font-black text-[#55705C]">
            {demoState.spentDisplay}
          </div>
          <span className="text-[10px] text-gray-500 font-semibold mt-1 block">Remaining: {demoState.remainingDisplay}</span>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Rejected by Contract
          </span>
          <div className="text-2xl font-black text-[#C94C4C]">
            {demoState.blockedAttempts}
          </div>
          <span className="text-[10px] text-red-500 font-semibold mt-1 block">Budget Exceeded Cap</span>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Prevented Duplicates
          </span>
          <div className="text-2xl font-black text-[#2563EB]">
            {demoState.duplicatesPrevented}
          </div>
          <span className="text-[10px] text-blue-600 font-semibold mt-1 block">On-Chain Idempotency</span>
        </div>
      </div>

      {/* 3. MAIN PAYMENT AUTHORIZATION FLOW */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block">
            ARCHITECTURE SECURITY MODEL
          </span>
          <h2 className="text-base font-black text-[#343434] mt-0.5">
            Payment Authorization Flow
          </h2>
          <p className="text-xs text-gray-500">
            The AI Agent requests services, but payment authorization is enforced independently on-chain by the Solidity Smart Contract.
          </p>
        </div>

        {/* Responsive Horizontal / Vertical Node Flow */}
        <div className="grid grid-cols-1 md:grid-cols-8 gap-2 text-xs relative">
          
          {/* Node 1: AI Agent */}
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl text-center space-y-1 relative shadow-xs">
            <Bot className="w-5 h-5 mx-auto text-[#2563EB]" />
            <span className="font-extrabold text-[#343434] block text-[11px]">AI AGENT</span>
            <span className="text-[9px] text-[#2563EB] bg-[#E3F2FD] px-1.5 py-0.5 rounded-full font-bold block">
              Can request payments
            </span>
          </div>

          {/* Node 2: Service Request */}
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl text-center space-y-1 shadow-xs flex flex-col justify-center">
            <Send className="w-4 h-4 mx-auto text-gray-500" />
            <span className="font-bold text-gray-700 text-[10px]">SERVICE REQUEST</span>
          </div>

          {/* Node 3: 402 Payment Required */}
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl text-center space-y-1 shadow-xs flex flex-col justify-center">
            <CreditCard className="w-4 h-4 mx-auto text-[#d97d54]" />
            <span className="font-bold text-[#d97d54] text-[10px]">402 PAYMENT REQUIRED</span>
          </div>

          {/* Node 4: Payment Protocol */}
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl text-center space-y-1 shadow-xs flex flex-col justify-center">
            <Layers className="w-4 h-4 mx-auto text-[#55705C]" />
            <span className="font-bold text-gray-700 text-[10px]">PAYMENT PROTOCOL</span>
          </div>

          {/* Node 5: SMART CONTRACT (Emphasized) */}
          <div className="bg-[#E8F5E9] border-2 border-[#3E8C5A] p-3 rounded-2xl text-center space-y-1 shadow-md relative">
            <Building className="w-5 h-5 mx-auto text-[#3E8C5A]" />
            <span className="font-black text-[#3E8C5A] block text-[11px]">SMART CONTRACT</span>
            <span className="text-[9px] text-[#3E8C5A] bg-white px-1.5 py-0.5 rounded-full font-extrabold block border border-[#C8E6C9]">
              Hard enforcement layer
            </span>
          </div>

          {/* Node 6: BUDGET CHECK (Emphasized) */}
          <div className="bg-[#FFF9F5] border-2 border-[#FAD2C0] p-3 rounded-2xl text-center space-y-1 shadow-xs relative flex flex-col justify-center">
            <Lock className="w-4 h-4 mx-auto text-[#343434]" />
            <span className="font-black text-[#343434] text-[10px]">BUDGET CHECK</span>
            <span className="text-[8px] text-gray-600 font-bold block">Can approve or reject</span>
          </div>

          {/* Node 7: Approved / Blocked */}
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl text-center space-y-1 shadow-xs flex flex-col justify-center">
            <ShieldAlert className="w-4 h-4 mx-auto text-amber-600" />
            <span className="font-bold text-gray-800 text-[10px]">APPROVED / BLOCKED</span>
          </div>

          {/* Node 8: Service Delivery */}
          <div className="bg-white border border-[#E9D8CC] p-3 rounded-2xl text-center space-y-1 shadow-xs flex flex-col justify-center">
            <FileCheck2 className="w-4 h-4 mx-auto text-[#3E8C5A]" />
            <span className="font-bold text-[#3E8C5A] text-[10px]">SERVICE DELIVERY</span>
          </div>
        </div>
      </div>

      {/* 4 & 5. HARD SPENDING CAP DEMO */}
      <div className="space-y-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block">
            DEMONSTRATION OF CONTRACT ENFORCEMENT
          </span>
          <h2 className="text-base font-black text-[#343434]">Hard Spending Cap Demo</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* BLOCKED PAYMENT EXAMPLE */}
          <div className="bg-[#FFF9F5] border-2 border-[#FFCDD2] rounded-3xl p-6 shadow-card space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#FFCDD2] pb-3">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-[#C94C4C]" />
                <h3 className="font-black text-sm text-[#343434]">Blocked Request Example</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFEBEE] text-[#C94C4C] border border-[#FFCDD2]">
                PAYMENT BLOCKED
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-2xl border border-[#FFCDD2] text-xs">
              <div>
                <span className="text-[10px] text-gray-400 block">Requested</span>
                <span className="font-extrabold text-sm text-[#C94C4C]">10.0 ETH</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Available</span>
                <span className="font-bold text-sm text-gray-700">{demoState.remainingDisplay}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Reason</span>
                <span className="font-mono font-bold text-[10px] text-[#C94C4C]">BUDGET_EXCEEDED</span>
              </div>
            </div>

            <div className="p-3.5 bg-white border border-[#FFCDD2] rounded-2xl text-xs space-y-1">
              <span className="font-extrabold text-[#C94C4C] block text-[11px]">Contract Enforcement Detail:</span>
              <p className="text-gray-600 leading-relaxed text-[11px]">
                "Attempted payment exceeds remaining smart contract budget. Transaction reverted on Sepolia."
              </p>
            </div>
          </div>

          {/* APPROVED PAYMENT EXAMPLE */}
          <div className="bg-[#FFF9F5] border-2 border-[#C8E6C9] rounded-3xl p-6 shadow-card space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#C8E6C9] pb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-[#3E8C5A]" />
                <h3 className="font-black text-sm text-[#343434]">Approved Request Example</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                PAYMENT AUTHORIZED
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-2xl border border-[#C8E6C9] text-xs">
              <div>
                <span className="text-[10px] text-gray-400 block">Requested</span>
                <span className="font-extrabold text-sm text-[#3E8C5A]">0.001 ETH</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Cap Limit</span>
                <span className="font-bold text-sm text-gray-700">{demoState.budgetDisplay}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Remaining After</span>
                <span className="font-extrabold text-sm text-[#55705C]">{demoState.remainingDisplay}</span>
              </div>
            </div>

            <div className="p-3.5 bg-white border border-[#C8E6C9] rounded-2xl text-xs space-y-1">
              <span className="font-extrabold text-[#3E8C5A] block text-[11px]">Contract State Result:</span>
              <p className="text-gray-600 leading-relaxed text-[11px]">
                "Payment authorized within budget cap. On-chain state updated and ETH transferred to provider."
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. RETRY / DOUBLE PAYMENT PROTECTION */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-3">
          <div>
            <h2 className="text-base font-black text-[#343434] flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 text-[#2563EB]" />
              <span>Retry & Double Payment Protection</span>
            </h2>
            <p className="text-xs text-gray-500">
              Network failures will never result in duplicate payments.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#E3F2FD] text-[#2563EB] border border-[#BBDEFB]">
            On-Chain Lock Active
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs bg-white p-4 rounded-2xl border border-[#E9D8CC]">
          <div>
            <span className="text-gray-400 text-[10px] block">Request ID</span>
            <code className="font-mono font-bold text-[#343434]">#keccak256(...)</code>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">First Attempt</span>
            <span className="font-semibold text-gray-700">Payment Submitted</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">Network State</span>
            <span className="font-bold text-amber-600">Timeout Detected</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">Contract State</span>
            <span className="font-bold text-[#55705C]">isProcessed(requestId) = true</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">Second Payment</span>
            <span className="font-extrabold text-[#3E8C5A]">0.00 ETH</span>
          </div>
        </div>

        <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] rounded-2xl text-xs text-[#3E8C5A] font-bold flex items-center justify-between">
          <span>✓ Final Result: Duplicate payment prevented</span>
          <span className="font-serif italic text-[11px] text-gray-600 font-normal">
            Retrying an already processed request ID causes the smart contract to revert with AlreadyProcessed(requestId).
          </span>
        </div>
      </div>

      {/* 7. AGENT VS CONTRACT CONTROL */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block">
            RESPONSIBILITY MATRIX
          </span>
          <h2 className="text-base font-black text-[#343434] mt-0.5">
            Who Controls What?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* AI AGENT COLUMN */}
          <div className="bg-white border border-[#E9D8CC] p-5 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2 border-b border-[#E9D8CC] pb-2">
              <Bot className="w-5 h-5 text-[#2563EB]" />
              <h3 className="font-extrabold text-sm text-[#343434]">AI AGENT</h3>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#3E8C5A] uppercase tracking-wider block mb-1">
                CAN:
              </span>
              <ul className="space-y-1 text-xs text-gray-700">
                {mockAgentVsContractComparison.agentCapabilities.can.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-1.5">
                    <span className="text-[#3E8C5A] font-bold">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#C94C4C] uppercase tracking-wider block mb-1">
                CANNOT:
              </span>
              <ul className="space-y-1 text-xs text-gray-700">
                {mockAgentVsContractComparison.agentCapabilities.cannot.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-1.5">
                    <span className="text-[#C94C4C] font-bold">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* SMART CONTRACT COLUMN */}
          <div className="bg-[#E8F5E9]/50 border border-[#C8E6C9] p-5 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2 border-b border-[#C8E6C9] pb-2">
              <Building className="w-5 h-5 text-[#3E8C5A]" />
              <h3 className="font-extrabold text-sm text-[#343434]">SOLIDITY SMART CONTRACT (AgentPay.sol)</h3>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#3E8C5A] uppercase tracking-wider block mb-1">
                CONTROLS:
              </span>
              <ul className="space-y-1 text-xs text-gray-700">
                {mockAgentVsContractComparison.contractCapabilities.controls.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#3E8C5A] shrink-0 mt-0.5" />
                    <span className="font-semibold">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 8. SECURITY EVENT LOG TABLE */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-[#343434]">Recent Security Audit Events</h2>
          <span className="text-xs text-gray-500 font-mono">{events.length} events logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E9D8CC] text-gray-400 text-[10px] font-mono uppercase tracking-wider">
                <th className="pb-3 font-semibold">Timestamp</th>
                <th className="pb-3 font-semibold">Request ID</th>
                <th className="pb-3 font-semibold">Event Type</th>
                <th className="pb-3 font-semibold">Amount</th>
                <th className="pb-3 font-semibold">Contract Result</th>
                <th className="pb-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9D8CC]/60">
              {events.map((evt, idx) => (
                <tr key={idx} className="hover:bg-white/80 transition-colors">
                  <td className="py-3 text-gray-500 font-mono text-[11px]">{evt.timestamp}</td>
                  <td className="py-3 font-mono font-bold text-[#343434]">#{evt.request_id}</td>
                  <td className="py-3 font-semibold text-gray-700">{evt.eventType}</td>
                  <td className="py-3 font-extrabold text-[#343434]">{evt.amount}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      evt.status === 'APPROVED' 
                        ? 'bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]' 
                        : evt.status === 'BLOCKED'
                        ? 'bg-[#FFEBEE] text-[#C94C4C] border border-[#FFCDD2]'
                        : 'bg-[#E3F2FD] text-[#2563EB] border border-[#BBDEFB]'
                    }`}>
                      {evt.status}
                    </span>
                  </td>
                  <td className="py-3 text-gray-600 text-[11px] max-w-xs truncate">{evt.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 9. DEMO CONTROLS */}
      <div className="bg-[#FFF9F5] border-2 border-[#FAD2C0] rounded-3xl p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-[#343434] flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-[#d97d54]" />
              <span>Security Simulation Controls</span>
            </h2>
            <p className="text-xs text-gray-500">
              Test contract enforcement behaviors interactively.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSimulateApproved}
            className="px-4 py-2.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] text-[#3E8C5A] border border-[#C8E6C9] rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Simulate Approved Payment</span>
          </button>

          <button
            onClick={handleSimulateBlocked}
            className="px-4 py-2.5 bg-[#FFEBEE] hover:bg-[#FFCDD2] text-[#C94C4C] border border-[#FFCDD2] rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>Simulate Budget Rejection</span>
          </button>

          <button
            onClick={handleSimulateRetry}
            className="px-4 py-2.5 bg-[#E3F2FD] hover:bg-[#BBDEFB] text-[#2563EB] border border-[#BBDEFB] rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Simulate Duplicate Retry</span>
          </button>

          <button
            onClick={handleResetDemo}
            className="px-4 py-2.5 bg-white hover:bg-[#FDF8F5] text-gray-600 border border-[#E9D8CC] rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer ml-auto"
          >
            Reset Demo
          </button>
        </div>
      </div>
    </div>
  );
}
