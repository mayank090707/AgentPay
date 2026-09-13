import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  FileCheck2, 
  Search, 
  CheckCircle2, 
  ShieldAlert, 
  ShieldCheck, 
  Copy, 
  Check, 
  ArrowDown, 
  RefreshCw, 
  Bot,
  ChevronRight,
  Code
} from 'lucide-react';
import { fetchAuditLogs, fetchAuditVerification, parseAuditLogsToTransactions } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';

export default function Audit() {
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState(searchParams.get('task_id') || null);
  const [verificationData, setVerificationData] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('task_id') || '');
  const [statusFilter, setStatusFilter] = useState('All');
  const [copiedField, setCopiedField] = useState(null);
  const [isBackendLive, setIsBackendLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initial load & Purchase Completed Event Listener
  useEffect(() => {
    let isMounted = true;

    async function loadAuditTrail(selectNewest = false) {
      setIsLoading(true);
      try {
        const res = await fetchAuditLogs({ limit: 200 });
        if (!isMounted) return;

        if (res && Array.isArray(res.logs)) {
          const parsed = parseAuditLogsToTransactions(res.logs);
          setTransactions(parsed);
          if (selectNewest && parsed.length > 0) {
            setSelectedRequestId(parsed[0].request_id);
          } else {
            setSelectedRequestId((prev) => prev || parsed[0]?.request_id || null);
          }
          setIsBackendLive(true);
        } else {
          setTransactions([]);
          setSelectedRequestId(null);
          setIsBackendLive(false);
        }
      } catch (err) {
        if (isMounted) {
          setTransactions([]);
          setSelectedRequestId(null);
          setIsBackendLive(false);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAuditTrail();

    const handlePurchaseCompleted = (evt) => {
      const newReqId = evt.detail?.request_id || evt.detail?.task_id;
      if (newReqId) {
        setSelectedRequestId(newReqId);
      }
      loadAuditTrail(true);
    };

    window.addEventListener('agentpay:purchase_completed', handlePurchaseCompleted);

    return () => {
      isMounted = false;
      window.removeEventListener('agentpay:purchase_completed', handlePurchaseCompleted);
    };
  }, []);

  // Fetch Verification Payload when Selected Request Changes
  useEffect(() => {
    if (!selectedRequestId || !isBackendLive) {
      setVerificationData(null);
      return;
    }

    let isMounted = true;
    async function loadVerification() {
      setIsVerifying(true);
      try {
        const res = await fetchAuditVerification(selectedRequestId);
        if (isMounted) setVerificationData(res);
      } catch (err) {
        if (isMounted) setVerificationData(null);
      } finally {
        if (isMounted) setIsVerifying(false);
      }
    }

    loadVerification();
    return () => {
      isMounted = false;
    };
  }, [selectedRequestId, isBackendLive]);

  // Filtered transactions list
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch = 
        (tx.request_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.task_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.service || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.provider || '').toLowerCase().includes(searchTerm.toLowerCase());

      let matchesStatus = true;
      if (statusFilter === 'Delivered') matchesStatus = tx.delivery_status === 'Delivered';
      if (statusFilter === 'Blocked') matchesStatus = tx.delivery_status === 'Blocked';
      if (statusFilter === 'Pending') matchesStatus = tx.delivery_status === 'Processing';

      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchTerm, statusFilter]);

  // Selected Transaction Object (Case-insensitive lookup)
  const selectedTx = useMemo(() => {
    if (!selectedRequestId) return transactions[0] || null;
    return (
      transactions.find(
        (t) => (t.request_id || '').toLowerCase() === selectedRequestId.toLowerCase() ||
               (t.task_id || '').toLowerCase() === selectedRequestId.toLowerCase()
      ) || transactions[0] || null
    );
  }, [transactions, selectedRequestId]);

  const isBlocked = selectedTx?.delivery_status === 'Blocked';

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const totalPurchases = transactions.length;
  const deliveredServices = transactions.filter(t => t.delivery_status === 'Delivered').length;
  const blockedAttempts = transactions.filter(t => t.delivery_status === 'Blocked').length;

  return (
    <div className="space-y-6 animate-fadeIn select-none">
      {/* 1. Page Header & Security Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-[#343434] tracking-tight">Cryptographic Audit Trail</h1>
            {isBackendLive ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3E8C5A] animate-pulse"></span>
                <span>Live Verification API</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
                <span>⚡ Backend Offline</span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Verify every Agent Run lifecycle, step dependency, payment, and delivery proof recorded on Sepolia.
          </p>
        </div>

        {/* Technical Security Banner */}
        <div className="bg-[#E3F2FD] border border-[#BBDEFB] px-4 py-3 rounded-2xl flex items-center space-x-3 text-xs text-[#1E3A8A] max-w-xl shadow-xs">
          <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0" />
          <p className="leading-tight font-medium">
            Every Agent service step links Task ID, Provider quote, EVM transaction hash, content hash, and service results.
          </p>
        </div>
      </div>

      {/* 2. Audit Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Total Purchases
          </span>
          <div className="text-2xl font-black text-[#343434]">
            {totalPurchases}
          </div>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Delivered Services
          </span>
          <div className="text-2xl font-black text-[#3E8C5A] flex items-center space-x-1.5">
            <span>{deliveredServices}</span>
            <CheckCircle2 className="w-4 h-4 text-[#3E8C5A]" />
          </div>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Blocked Attempts
          </span>
          <div className="text-2xl font-black text-[#C94C4C] flex items-center space-x-1.5">
            <span>{blockedAttempts}</span>
            <ShieldAlert className="w-4 h-4 text-[#C94C4C]" />
          </div>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Verified Deliveries
          </span>
          <div className="text-2xl font-black text-[#2563EB] flex items-center space-x-1.5">
            <span>{deliveredServices}</span>
            <FileCheck2 className="w-4 h-4 text-[#2563EB]" />
          </div>
        </div>
      </div>

      {/* 3. Main Two-Column Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Transaction Selector List (5 Cols) */}
        <div className="lg:col-span-5 bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-5 shadow-card space-y-4 flex flex-col h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#343434]">Audit Log Transactions</h2>
            <span className="text-[11px] text-gray-500 font-mono">
              {filteredTransactions.length} items
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Task ID, Request ID, Service..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#E9D8CC] rounded-2xl text-xs text-[#343434] focus:outline-none focus:border-[#FAD2C0] transition-all shadow-xs"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
            {['All', 'Delivered', 'Blocked', 'Pending'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === filter
                    ? 'bg-[#FAD2C0] text-[#343434] shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-[#FDF8F5] border border-[#E9D8CC]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Transaction Items List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredTransactions.map((tx) => {
              const isSelected = tx.request_id === selectedRequestId || tx.task_id === selectedRequestId;

              return (
                <div
                  key={tx.request_id}
                  onClick={() => setSelectedRequestId(tx.request_id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected 
                      ? 'bg-white border-[#FAD2C0] ring-2 ring-[#FAD2C0]/50 shadow-sm' 
                      : 'bg-white/70 border-[#E9D8CC] hover:bg-white hover:border-[#FAD2C0]/50'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1 pr-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="font-mono font-bold text-xs text-[#343434] truncate max-w-[120px] inline-block" title={`#${tx.request_id}`}>
                        #{tx.request_id.slice(0, 14)}...
                      </span>
                      <span className="text-xs font-semibold text-gray-700 truncate" title={tx.service}>
                        {tx.service}
                      </span>
                    </div>
                    {tx.task_id && tx.task_id !== tx.request_id && (
                      <div className="flex items-center space-x-1 text-[10px] text-[#2563EB] font-mono">
                        <Bot className="w-2.5 h-2.5" />
                        <span>Task #{tx.task_id.slice(0, 8)}</span>
                      </div>
                    )}
                    <div className="text-[11px] text-gray-500 flex items-center space-x-1.5 truncate">
                      <span className="truncate" title={tx.provider}>{tx.provider}</span>
                      <span className="shrink-0">•</span>
                      <span className="font-mono shrink-0">{tx.timestamp}</span>
                    </div>
                  </div>

                  <div className="text-right space-y-1 shrink-0">
                    <div className="font-extrabold text-xs text-[#343434]">
                      {tx.amountEth ? tx.amountEth : `₹${tx.amount.toFixed(2)}`}
                    </div>
                    <StatusBadge status={tx.delivery_status} />
                  </div>
                </div>
              );
            })}

            {filteredTransactions.length === 0 && (
              <div className="py-8 text-center text-gray-400 space-y-2">
                <FileCheck2 className="w-8 h-8 mx-auto text-gray-300" />
                <p className="text-xs font-semibold">No audit logs found.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Audit Timeline & Delivery Proof (7 Cols) */}
        {selectedTx ? (
          <div className="lg:col-span-7 space-y-6">
            
            {/* 4. VISUAL AUDIT TIMELINE */}
            <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E9D8CC] pb-4">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block">
                    LIFECYCLE AUDIT TRAIL
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-[#343434] mt-0.5 flex items-center space-x-2 min-w-0">
                    <span className="truncate max-w-[200px] sm:max-w-[320px]" title={selectedTx.request_id}>
                      Transaction #{selectedTx.request_id.slice(0, 16)}...
                    </span>
                    <button
                      onClick={() => copyToClipboard(selectedTx.request_id, 'requestId')}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0"
                      title="Copy Request ID"
                    >
                      {copiedField === 'requestId' ? (
                        <Check className="w-3.5 h-3.5 text-[#3E8C5A]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </h2>
                </div>

                <div className="shrink-0">
                  <StatusBadge status={selectedTx.delivery_status} />
                </div>
              </div>

              {/* Data Dependency Notice if present */}
              {selectedTx.input_dependency && (
                <div className="p-3 bg-[#E3F2FD] border border-[#BBDEFB] rounded-2xl flex items-center space-x-2 text-xs text-[#1E3A8A]">
                  <ChevronRight className="w-4 h-4 text-[#2563EB] shrink-0" />
                  <span className="font-semibold">
                    Step Dependency: Step 1 Output (Translation) &rarr; Step 2 Input (Storage Payload)
                  </span>
                </div>
              )}

              {/* Sequential Steps Timeline */}
              <div className="space-y-3 relative text-xs">
                
                {/* STEP 1: REQUEST */}
                <div className="p-3.5 bg-white border border-[#E9D8CC] rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#3B82F6] flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#E3F2FD] flex items-center justify-center text-[10px]">1</span>
                      <span>STEP 1 — REQUEST INITIATED</span>
                    </span>
                    <span className="font-mono text-gray-400 text-[10px]">{selectedTx.timestamp}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-gray-700 items-start">
                    <div className="min-w-0">
                      <span className="text-gray-400 text-[10px] block font-bold uppercase tracking-wider">Request ID</span>
                      <code className="font-bold font-mono text-xs text-[#343434] block truncate max-w-full" title={selectedTx.request_id}>
                        #{selectedTx.request_id.slice(0, 14)}...
                      </code>
                    </div>
                    <div className="min-w-0">
                      <span className="text-gray-400 text-[10px] block font-bold uppercase tracking-wider">Service</span>
                      <span className="font-semibold text-xs text-[#343434] block truncate" title={selectedTx.service}>{selectedTx.service}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-gray-400 text-[10px] block font-bold uppercase tracking-wider">Provider</span>
                      <span className="font-semibold text-xs text-[#343434] block truncate" title={selectedTx.provider}>{selectedTx.provider}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center text-gray-300">
                  <ArrowDown className="w-4 h-4" />
                </div>

                {/* STEP 2: 402 PAYMENT REQUIRED */}
                <div className="p-3.5 bg-white border border-[#E9D8CC] rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#d97d54] flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#FAD2C0]/40 flex items-center justify-center text-[10px]">2</span>
                      <span>STEP 2 — 402 PAYMENT REQUIRED</span>
                    </span>
                    <span className="font-extrabold text-[#343434]">{selectedTx.amountEth || `₹${selectedTx.amount.toFixed(2)}`}</span>
                  </div>
                  <p className="text-gray-600 text-[11px]">
                    Provider {selectedTx.provider} issued quote of {selectedTx.amountEth || `₹${selectedTx.amount.toFixed(2)}`}.
                  </p>
                </div>

                <div className="flex justify-center text-gray-300">
                  <ArrowDown className="w-4 h-4" />
                </div>

                {/* STEP 3: PAYMENT AUTHORIZATION */}
                <div className="p-3.5 bg-white border border-[#E9D8CC] rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#55705C] flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[10px]">3</span>
                      <span>STEP 3 — SMART CONTRACT AUTHORIZATION</span>
                    </span>
                    <span className="text-gray-500 font-medium">Sepolia Contract Check</span>
                  </div>
                  <p className="text-gray-600 text-[11px]">
                    Spending limit authorization evaluated independently on-chain by AgentPay.sol contract logic.
                  </p>
                </div>

                <div className="flex justify-center text-gray-300">
                  <ArrowDown className="w-4 h-4" />
                </div>

                {/* STEP 4: PAYMENT CONFIRMED / BLOCKED */}
                <div className={`p-3.5 rounded-2xl border space-y-1 ${
                  isBlocked 
                    ? 'bg-[#FFEBEE] border-[#FFCDD2] text-[#C94C4C]' 
                    : 'bg-[#E8F5E9] border-[#C8E6C9] text-[#3E8C5A]'
                }`}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px]">4</span>
                      <span>{isBlocked ? 'STEP 4 — ❌ PAYMENT BLOCKED' : 'STEP 4 — PAYMENT CONFIRMED'}</span>
                    </span>
                    <span className="font-extrabold">{isBlocked ? '0.00 ETH Deducted' : `${selectedTx.amountEth || `₹${selectedTx.amount.toFixed(2)}`} Paid`}</span>
                  </div>
                  {isBlocked ? (
                    <p className="text-xs font-semibold">
                      {selectedTx.error || 'Smart Contract Rejected: BUDGET_EXCEEDED.'}
                    </p>
                  ) : (
                    <div className="flex items-center space-x-2 pt-0.5 min-w-0">
                      <span className="text-gray-600 text-[11px] shrink-0">Tx Hash:</span>
                      <code className="font-mono text-[11px] text-[#55705C] bg-white px-2 py-0.5 rounded border border-[#C8E6C9] truncate min-w-0 max-w-full block flex-1" title={selectedTx.payment_tx}>
                        {selectedTx.payment_tx}
                      </code>
                      <button
                        onClick={() => copyToClipboard(selectedTx.payment_tx, 'paymentTx')}
                        className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0"
                        title="Copy Payment Tx Hash"
                      >
                        {copiedField === 'paymentTx' ? (
                          <Check className="w-3.5 h-3.5 text-[#3E8C5A]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex justify-center text-gray-300">
                  <ArrowDown className="w-4 h-4" />
                </div>

                {/* STEP 5: SERVICE DELIVERY */}
                <div className="p-3.5 bg-white border border-[#E9D8CC] rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#343434] flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">5</span>
                      <span>STEP 5 — SERVICE DELIVERY RESULT</span>
                    </span>
                    <span className="font-semibold text-gray-600">{selectedTx.delivery_status}</span>
                  </div>
                  <p className="text-gray-600 text-[11px]">
                    {isBlocked 
                      ? 'Service not delivered because payment was rejected by smart contract enforcement.' 
                      : `Service payload delivered successfully by provider ${selectedTx.provider}.`}
                  </p>
                  {selectedTx.service_result && (
                    <div className="mt-2 p-2.5 bg-[#FFF9F5] rounded-xl border border-[#E9D8CC]">
                      <span className="text-[10px] font-mono uppercase text-gray-400 font-bold block mb-1">Delivered Payload Output</span>
                      <pre className="text-[11px] font-mono text-gray-800 whitespace-pre-wrap">
                        {typeof selectedTx.service_result === 'object' ? JSON.stringify(selectedTx.service_result, null, 2) : selectedTx.service_result}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="flex justify-center text-gray-300">
                  <ArrowDown className="w-4 h-4" />
                </div>

                {/* STEP 6: DELIVERY PROOF */}
                <div className={`p-3.5 rounded-2xl border space-y-1 ${
                  isBlocked 
                    ? 'bg-gray-50 border-gray-200 text-gray-500' 
                    : 'bg-[#E3F2FD]/60 border-[#BBDEFB] text-[#1E3A8A]'
                }`}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px]">6</span>
                      <span>STEP 6 — DELIVERY PROOF & FINGERPRINT</span>
                    </span>
                    <span className="font-bold">{isBlocked ? 'N/A' : '✓ VERIFIED ON-CHAIN'}</span>
                  </div>
                  {!isBlocked && (
                    <div className="flex items-center space-x-2 pt-0.5 min-w-0">
                      <span className="text-gray-600 text-[11px] shrink-0">Content Hash:</span>
                      <code className="font-mono text-[11px] text-gray-700 bg-white px-2 py-0.5 rounded border border-[#BBDEFB] truncate min-w-0 max-w-full block flex-1" title={selectedTx.content_hash}>
                        {selectedTx.content_hash}
                      </code>
                      <button
                        onClick={() => copyToClipboard(selectedTx.content_hash, 'contentHash')}
                        className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0"
                        title="Copy Content Hash"
                      >
                        {copiedField === 'contentHash' ? (
                          <Check className="w-3.5 h-3.5 text-[#2563EB]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 5. DEDICATED PROMINENT DELIVERY PROOF CARD */}
            <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#343434] flex items-center space-x-2">
                  <FileCheck2 className="w-5 h-5 text-[#2563EB]" />
                  <span>Delivery Proof Verification Card</span>
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isBlocked 
                    ? 'bg-[#FFEBEE] text-[#C94C4C] border border-[#FFCDD2]' 
                    : 'bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]'
                }`}>
                  {isBlocked ? 'Proof Unavailable' : '✓ Proof Recorded'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-4 rounded-2xl border border-[#E9D8CC]">
                <div className="min-w-0">
                  <span className="text-gray-400 text-[10px] block font-medium">Request Identifier</span>
                  <div className="flex items-center space-x-1 mt-0.5 min-w-0">
                    <code className="font-mono font-bold text-[#343434] truncate max-w-full" title={selectedTx.request_id}>#{selectedTx.request_id}</code>
                    <button onClick={() => copyToClipboard(selectedTx.request_id, 'requestIdCard')} className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0">
                      {copiedField === 'requestIdCard' ? <Check className="w-3 h-3 text-[#3E8C5A]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <span className="text-gray-400 text-[10px] block font-medium">Service Category</span>
                  <span className="font-semibold text-gray-700 block mt-0.5 truncate" title={`${selectedTx.service} (${selectedTx.provider})`}>{selectedTx.service} ({selectedTx.provider})</span>
                </div>

                <div className="sm:col-span-2 min-w-0">
                  <span className="text-gray-400 text-[10px] block font-medium">Sepolia Payment Transaction</span>
                  <div className="flex items-center space-x-2 mt-1 min-w-0">
                    <code className="font-mono text-[11px] text-[#55705C] bg-[#FDF8F5] px-2 py-1 rounded border border-[#E9D8CC] truncate block flex-1 min-w-0" title={selectedTx.payment_tx}>
                      {selectedTx.payment_tx}
                    </code>
                    <button onClick={() => copyToClipboard(selectedTx.payment_tx, 'paymentTxCard')} className="p-1 bg-white border border-[#E9D8CC] rounded-lg text-gray-500 hover:text-gray-800 cursor-pointer shrink-0">
                      {copiedField === 'paymentTxCard' ? <Check className="w-3.5 h-3.5 text-[#3E8C5A]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 min-w-0">
                  <span className="text-gray-400 text-[10px] block font-medium">Delivered Resource Content Hash</span>
                  <div className="flex items-center space-x-2 mt-1 min-w-0">
                    <code className="font-mono text-[11px] text-gray-700 bg-[#FDF8F5] px-2 py-1 rounded border border-[#E9D8CC] truncate block flex-1 min-w-0" title={selectedTx.content_hash}>
                      {selectedTx.content_hash}
                    </code>
                    <button onClick={() => copyToClipboard(selectedTx.content_hash, 'contentHashCard')} className="p-1 bg-[#E8F5E9] border border-[#C8E6C9] rounded-lg text-[#3E8C5A] cursor-pointer shrink-0">
                      {copiedField === 'contentHashCard' ? <Check className="w-3.5 h-3.5 text-[#3E8C5A]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-7 bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-8 text-center shadow-card space-y-3 flex flex-col items-center justify-center min-h-[300px]">
            <FileCheck2 className="w-12 h-12 text-gray-300" />
            <h3 className="text-sm font-bold text-[#343434]">No Transaction Selected</h3>
            <p className="text-xs text-gray-500 max-w-sm">No audit transactions are available to display verification logs.</p>
          </div>
        )}
      </div>
    </div>
  );
}
