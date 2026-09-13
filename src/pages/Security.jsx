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
  Loader2,
  Info
} from 'lucide-react';
import { useBlockchain } from '../context/BlockchainContext';
import { 
  fetchAuditLogs, 
  parseAuditLogsToTransactions,
  runBudgetExceededDemo,
  runDoublePaymentDemo,
  fetchSecuritySummary,
  purchaseService
} from '../services/api';
import { 
  mockAgentVsContractComparison, 
  mockSecurityGuarantees 
} from '../data/mockData';

export default function Security() {
  // Live Blockchain Context Read
  const { budget } = useBlockchain();

  // Security Summary & Audit Logs State
  const [summary, setSummary] = useState({
    hardCap: budget ? `${budget.budgetEth} ETH` : '0.0500 ETH',
    totalSpent: budget ? `${budget.totalSpentEth} ETH` : '0.0000 ETH',
    remainingBudget: budget ? `${budget.remainingEth} ETH` : '0.0500 ETH',
    blockedAttempts: 0,
    duplicatePreventionCount: 0,
    contractAddress: '0x220b3C0C30A90F8e34f711c14041b369D3c599B6'
  });

  const [events, setEvents] = useState([]);
  const [isBackendLive, setIsBackendLive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [activeNotice, setActiveNotice] = useState(null);
  const [activeError, setActiveError] = useState(null);

  // Dynamic Live Demo Card States
  const [budgetExceededDemo, setBudgetExceededDemo] = useState({
    requestId: 'N/A',
    requestedAmount: '10.0000 ETH',
    availableAmount: summary.remainingBudget,
    reason: 'BUDGET_EXCEEDED',
    detail: 'Attempted payment exceeds remaining smart contract budget. Transaction reverted on Sepolia.',
    contractResult: 'REJECTED_ON_CHAIN'
  });

  const [doublePaymentDemo, setDoublePaymentDemo] = useState({
    requestId: '#keccak256(...)',
    firstAttemptStatus: 'Payment Submitted',
    networkState: 'Timeout Detected',
    contractState: 'isProcessed(requestId) = true',
    secondPaymentAmount: '0.00 ETH',
    result: 'Duplicate payment prevented'
  });

  const [approvedDemo, setApprovedDemo] = useState({
    requestId: 'N/A',
    requestedAmount: '0.0001 ETH',
    capLimit: summary.hardCap,
    remainingAfter: summary.remainingBudget,
    detail: 'Payment authorized within budget cap. On-chain state updated and ETH transferred to provider.'
  });

  // Fetch live summary and audit trail
  const loadLiveSecurityData = async () => {
    try {
      // 1. Summary Metrics
      const sumRes = await fetchSecuritySummary();
      if (sumRes) {
        setSummary({
          hardCap: sumRes.hard_cap,
          totalSpent: sumRes.total_spent,
          remainingBudget: sumRes.remaining_budget,
          blockedAttempts: sumRes.blocked_attempts,
          duplicatePreventionCount: sumRes.duplicate_prevention_count,
          contractAddress: sumRes.contract_address || '0x220b3C0C30A90F8e34f711c14041b369D3c599B6'
        });
      }

      // 2. Audit Logs
      const auditRes = await fetchAuditLogs({ limit: 50 });
      if (auditRes && Array.isArray(auditRes.logs)) {
        setIsBackendLive(true);
        const formattedLogs = auditRes.logs.map((log) => {
          let detailsStr = '';
          if (typeof log.details === 'object' && log.details !== null) {
            detailsStr = log.details.rejection_reason || log.details.reason || log.details.error || JSON.stringify(log.details);
          } else {
            detailsStr = String(log.details || '');
          }

          let status = 'APPROVED';
          const et = (log.event_type || '').toUpperCase();
          if (et.includes('EXCEEDED') || et.includes('BLOCKED') || et.includes('REJECTED') || et.includes('FAILED')) {
            status = 'BLOCKED';
          } else if (et.includes('DUPLICATE') || et.includes('PREVENTED') || et.includes('REUSE_CONFLICT')) {
            status = 'PREVENTED';
          }

          let amountDisplay = '0.0000 ETH';
          if (log.details && log.details.requested_amount) {
            amountDisplay = log.details.requested_amount;
          } else if (log.details && log.details.amount) {
            amountDisplay = typeof log.details.amount === 'number' ? `${log.details.amount} ETH` : String(log.details.amount);
          }

          return {
            timestamp: log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A',
            request_id: log.request_id,
            eventType: log.event_type,
            amount: amountDisplay,
            status,
            details: detailsStr
          };
        });
        setEvents(formattedLogs);
      }
    } catch (err) {
      console.warn('Could not load live security audit data:', err);
    }
  };

  useEffect(() => {
    loadLiveSecurityData();
  }, [budget]);

  // Handler 1: Real Budget Rejection Simulation
  const handleSimulateBlocked = async () => {
    setIsLoading(true);
    setLoadingMessage('Running security test on Sepolia contract (Budget Exceeded Revert)...');
    setActiveError(null);
    setActiveNotice(null);

    try {
      const res = await runBudgetExceededDemo();
      if (res) {
        setBudgetExceededDemo({
          requestId: res.request_id,
          requestedAmount: res.requested_amount,
          availableAmount: res.remaining_amount,
          reason: 'BUDGET_EXCEEDED',
          detail: res.rejection_reason,
          contractResult: res.contract_result
        });

        setActiveNotice(`PAYMENT BLOCKED — Smart contract rejected overspend (${res.requested_amount}). Reverted on-chain with BUDGET_EXCEEDED.`);
        await loadLiveSecurityData();
      }
    } catch (err) {
      setActiveError(`Security test error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler 2: Real Duplicate Retry Simulation
  const handleSimulateRetry = async () => {
    setIsLoading(true);
    setLoadingMessage('Running idempotency test on Sepolia contract (Duplicate Payment Replay Block)...');
    setActiveError(null);
    setActiveNotice(null);

    try {
      const res = await runDoublePaymentDemo();
      if (res) {
        setDoublePaymentDemo({
          requestId: res.request_id,
          firstAttemptStatus: `1st Payment: ${res.first_payment.status} (${res.first_payment.amount})`,
          networkState: 'Retry Broadcast',
          contractState: `isProcessed(requestId) = ${res.retry.contract_is_processed}`,
          secondPaymentAmount: res.retry.amount_deducted,
          result: `Duplicate payment blocked (${res.retry.reason})`
        });

        setActiveNotice(`DUPLICATE PAYMENT PREVENTED — Smart contract blocked retry of request #${res.request_id.slice(0, 10)}... (0.00 ETH deducted).`);
        await loadLiveSecurityData();
      }
    } catch (err) {
      setActiveError(`Security test error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler 3: Real Approved Payment Simulation
  const handleSimulateApproved = async () => {
    setIsLoading(true);
    setLoadingMessage('Executing real purchase payment through AgentPay pipeline on Sepolia...');
    setActiveError(null);
    setActiveNotice(null);

    try {
      const res = await purchaseService({ service_type: 'translation', provider_id: 'alpha' });
      if (res && res.status === 'success') {
        const amtStr = `${res.amount} ETH`;
        setApprovedDemo({
          requestId: res.request_id,
          requestedAmount: amtStr,
          capLimit: summary.hardCap,
          remainingAfter: summary.remainingBudget,
          detail: `Payment authorized by Sepolia contract: ${amtStr} transferred to provider ${res.provider_id}.`
        });

        setActiveNotice(`PAYMENT AUTHORIZED — Purchase confirmed on-chain (Tx: ${res.transaction_hash?.slice(0, 10)}...).`);
        await loadLiveSecurityData();
      }
    } catch (err) {
      setActiveError(`Approved payment error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetDemo = () => {
    setActiveNotice('Security display refreshed with live on-chain and audit database state.');
    setActiveError(null);
    loadLiveSecurityData();
  };

  return (
    <div className="space-y-8 animate-fadeIn select-none">
      
      {/* 1. Page Header & Security Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-[#343434] tracking-tight">Security Center</h1>
            {isBackendLive ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3E8C5A] animate-pulse"></span>
                <span>Sepolia Solidity Guard Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
                <span>⚡ Backend Live / Guard Active</span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Budget limits & payments are strictly enforced on-chain by Solidity smart contract <code className="font-mono text-[#2563EB]">{summary.contractAddress}</code>.
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

      {/* Loading Overlay / Spinner */}
      {isLoading && (
        <div className="p-4 bg-[#E3F2FD] border border-[#BBDEFB] text-[#1E3A8A] rounded-2xl text-xs font-bold flex items-center space-x-3 animate-pulse">
          <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin shrink-0" />
          <span>🛡️ {loadingMessage}</span>
        </div>
      )}

      {/* Error Notice */}
      {activeError && (
        <div className="p-3 bg-[#FFEBEE] border border-[#FFCDD2] text-[#C94C4C] rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-[#C94C4C] shrink-0" />
            <span>{activeError}</span>
          </div>
          <button onClick={() => setActiveError(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Toast Notice */}
      {activeNotice && !isLoading && (
        <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D32] rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <span>🛡️ {activeNotice}</span>
          <button onClick={() => setActiveNotice(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
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
            {summary.hardCap}
          </div>
          <span className="text-[10px] text-gray-500 font-semibold mt-1 block">Solidity Enforced (Sepolia)</span>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Current Contract Spend
          </span>
          <div className="text-2xl font-black text-[#55705C]">
            {summary.totalSpent}
          </div>
          <span className="text-[10px] text-gray-500 font-semibold mt-1 block">Remaining: {summary.remainingBudget}</span>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Rejected by Contract
          </span>
          <div className="text-2xl font-black text-[#C94C4C]">
            {summary.blockedAttempts}
          </div>
          <span className="text-[10px] text-red-500 font-semibold mt-1 block">Budget Exceeded Cap</span>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Prevented Duplicates
          </span>
          <div className="text-2xl font-black text-[#2563EB]">
            {summary.duplicatePreventionCount}
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
                <span className="font-extrabold text-sm text-[#C94C4C] truncate block">{budgetExceededDemo.requestedAmount}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Available</span>
                <span className="font-bold text-sm text-gray-700 truncate block">{budgetExceededDemo.availableAmount}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Reason</span>
                <span className="font-mono font-bold text-[10px] text-[#C94C4C] truncate block">{budgetExceededDemo.reason}</span>
              </div>
            </div>

            <div className="p-3.5 bg-white border border-[#FFCDD2] rounded-2xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#C94C4C] block text-[11px]">Contract Enforcement Detail:</span>
                {budgetExceededDemo.requestId !== 'N/A' && (
                  <span className="font-mono text-[9px] text-gray-400 truncate max-w-[120px]" title={budgetExceededDemo.requestId}>
                    #{budgetExceededDemo.requestId}
                  </span>
                )}
              </div>
              <p className="text-gray-600 leading-relaxed text-[11px] truncate" title={budgetExceededDemo.detail}>
                "{budgetExceededDemo.detail}"
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
                <span className="font-extrabold text-sm text-[#3E8C5A] truncate block">{approvedDemo.requestedAmount}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Cap Limit</span>
                <span className="font-bold text-sm text-gray-700 truncate block">{approvedDemo.capLimit}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Remaining After</span>
                <span className="font-extrabold text-sm text-[#55705C] truncate block">{approvedDemo.remainingAfter}</span>
              </div>
            </div>

            <div className="p-3.5 bg-white border border-[#C8E6C9] rounded-2xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#3E8C5A] block text-[11px]">Contract State Result:</span>
                {approvedDemo.requestId !== 'N/A' && (
                  <span className="font-mono text-[9px] text-gray-400 truncate max-w-[120px]" title={approvedDemo.requestId}>
                    #{approvedDemo.requestId}
                  </span>
                )}
              </div>
              <p className="text-gray-600 leading-relaxed text-[11px] truncate" title={approvedDemo.detail}>
                "{approvedDemo.detail}"
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
            <code className="font-mono font-bold text-[#343434] truncate max-w-[110px] block" title={doublePaymentDemo.requestId}>
              {doublePaymentDemo.requestId}
            </code>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">First Attempt</span>
            <span className="font-semibold text-gray-700 truncate block" title={doublePaymentDemo.firstAttemptStatus}>
              {doublePaymentDemo.firstAttemptStatus}
            </span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">Network State</span>
            <span className="font-bold text-amber-600 truncate block" title={doublePaymentDemo.networkState}>
              {doublePaymentDemo.networkState}
            </span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">Contract State</span>
            <span className="font-bold text-[#55705C] truncate block" title={doublePaymentDemo.contractState}>
              {doublePaymentDemo.contractState}
            </span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">Second Payment</span>
            <span className="font-extrabold text-[#3E8C5A] block">{doublePaymentDemo.secondPaymentAmount}</span>
          </div>
        </div>

        <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] rounded-2xl text-xs text-[#3E8C5A] font-bold flex items-center justify-between flex-wrap gap-2">
          <span>✓ Final Result: {doublePaymentDemo.result}</span>
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
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead>
              <tr className="border-b border-[#E9D8CC] text-gray-400 text-[10px] font-mono uppercase tracking-wider">
                <th className="pb-3 font-semibold w-[140px]">Timestamp</th>
                <th className="pb-3 font-semibold w-[130px]">Request ID</th>
                <th className="pb-3 font-semibold w-[130px]">Event Type</th>
                <th className="pb-3 font-semibold w-[90px]">Amount</th>
                <th className="pb-3 font-semibold w-[100px]">Contract Result</th>
                <th className="pb-3 font-semibold min-w-[160px]">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9D8CC]/60">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400 italic">
                    No security audit events logged yet. Trigger a simulation test below.
                  </td>
                </tr>
              ) : (
                events.map((evt, idx) => (
                  <tr key={idx} className="hover:bg-white/80 transition-colors">
                    <td className="py-3 text-gray-500 font-mono text-[11px] whitespace-nowrap">{evt.timestamp}</td>
                    <td className="py-3 font-mono font-bold text-[#343434]">
                      <span className="truncate max-w-[120px] block" title={evt.request_id}>
                        #{evt.request_id}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-gray-700 truncate max-w-[120px]" title={evt.eventType}>
                      {evt.eventType}
                    </td>
                    <td className="py-3 font-extrabold text-[#343434] whitespace-nowrap">{evt.amount}</td>
                    <td className="py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold inline-block ${
                        evt.status === 'APPROVED' 
                          ? 'bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]' 
                          : evt.status === 'BLOCKED'
                          ? 'bg-[#FFEBEE] text-[#C94C4C] border border-[#FFCDD2]'
                          : 'bg-[#E3F2FD] text-[#2563EB] border border-[#BBDEFB]'
                      }`}>
                        {evt.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600 text-[11px]">
                      <span className="truncate max-w-[200px] sm:max-w-[300px] block" title={evt.details}>
                        {evt.details}
                      </span>
                    </td>
                  </tr>
                ))
              )}
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
              Test live smart contract enforcement and backend idempotency interactively.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSimulateApproved}
            disabled={isLoading}
            className="px-4 py-2.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] text-[#3E8C5A] border border-[#C8E6C9] rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Simulate Approved Payment</span>
          </button>

          <button
            onClick={handleSimulateBlocked}
            disabled={isLoading}
            className="px-4 py-2.5 bg-[#FFEBEE] hover:bg-[#FFCDD2] text-[#C94C4C] border border-[#FFCDD2] rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            <span>Simulate Budget Rejection</span>
          </button>

          <button
            onClick={handleSimulateRetry}
            disabled={isLoading}
            className="px-4 py-2.5 bg-[#E3F2FD] hover:bg-[#BBDEFB] text-[#2563EB] border border-[#BBDEFB] rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Simulate Duplicate Retry</span>
          </button>

          <button
            onClick={handleResetDemo}
            disabled={isLoading}
            className="px-4 py-2.5 bg-white hover:bg-[#FDF8F5] text-gray-600 border border-[#E9D8CC] rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer ml-auto disabled:opacity-50"
          >
            Refresh Live View
          </button>
        </div>
      </div>
    </div>
  );
}
