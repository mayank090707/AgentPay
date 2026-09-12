import React, { useState, useMemo } from 'react';
import { 
  FileCheck2, 
  Search, 
  Filter, 
  CheckCircle2, 
  ShieldAlert, 
  ShieldCheck, 
  Copy, 
  Check, 
  ArrowDown, 
  RefreshCw, 
  ExternalLink,
  Layers,
  Clock,
  KeyRound,
  CreditCard,
  Building,
  FileCode
} from 'lucide-react';
import { mockTransactions, mockContractSummary } from '../data/mockData';
import StatusBadge from '../components/common/StatusBadge';

export default function Audit() {
  const [selectedRequestId, setSelectedRequestId] = useState('A104');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [copiedField, setCopiedField] = useState(null);

  // Filtered transactions list
  const filteredTransactions = useMemo(() => {
    return mockTransactions.filter((tx) => {
      const matchesSearch = 
        tx.request_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.provider.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesStatus = true;
      if (statusFilter === 'Delivered') matchesStatus = tx.delivery_status === 'Delivered';
      if (statusFilter === 'Blocked') matchesStatus = tx.delivery_status === 'Blocked';
      if (statusFilter === 'Pending') matchesStatus = tx.delivery_status === 'Processing';

      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  // Selected Transaction Object
  const selectedTx = useMemo(() => {
    return mockTransactions.find(t => t.request_id === selectedRequestId) || mockTransactions[0];
  }, [selectedRequestId]);

  const isBlocked = selectedTx.delivery_status === 'Blocked';
  const hasRetryInfo = selectedTx.request_id === 'A104';

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn select-none">
      {/* 1. Page Header & Security Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#343434] tracking-tight">Audit Trail</h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Verify every payment, delivery, and proof recorded by AgentPay.
          </p>
        </div>

        {/* Technical Security Banner */}
        <div className="bg-[#E3F2FD] border border-[#BBDEFB] px-4 py-3 rounded-2xl flex items-center space-x-3 text-xs text-[#1E3A8A] max-w-xl shadow-xs">
          <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0" />
          <p className="leading-tight font-medium">
            Every service purchase is linked to a request ID, payment transaction, delivery result, and content hash.
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
            {mockContractSummary.totalTransactions}
          </div>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Delivered Services
          </span>
          <div className="text-2xl font-black text-[#3E8C5A] flex items-center space-x-1.5">
            <span>{mockContractSummary.successfulTransactions}</span>
            <CheckCircle2 className="w-4 h-4 text-[#3E8C5A]" />
          </div>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Blocked Attempts
          </span>
          <div className="text-2xl font-black text-[#C94C4C] flex items-center space-x-1.5">
            <span>{mockContractSummary.blockedTransactions}</span>
            <ShieldAlert className="w-4 h-4 text-[#C94C4C]" />
          </div>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Verified Deliveries
          </span>
          <div className="text-2xl font-black text-[#2563EB] flex items-center space-x-1.5">
            <span>{mockContractSummary.successfulTransactions}</span>
            <FileCheck2 className="w-4 h-4 text-[#2563EB]" />
          </div>
        </div>
      </div>

      {/* 3. Main Two-Column Container: Selector (Left) & Timeline/Proof (Right) */}
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
              placeholder="Search Request ID, Service, Provider..."
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
              const isSelected = tx.request_id === selectedRequestId;
              const isTxBlocked = tx.delivery_status === 'Blocked';

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
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-xs text-[#343434]">
                        #{tx.request_id}
                      </span>
                      <span className="text-xs font-semibold text-gray-700">
                        {tx.service}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center space-x-2">
                      <span>{tx.provider}</span>
                      <span>•</span>
                      <span className="font-mono">{tx.timestamp}</span>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="font-extrabold text-xs text-[#343434]">
                      ₹{tx.amount.toFixed(2)}
                    </div>
                    <StatusBadge status={tx.delivery_status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Audit Timeline & Delivery Proof (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 4. VISUAL AUDIT TIMELINE */}
          <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-5">
            <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block">
                  LIFECYCLE AUDIT TRAIL
                </span>
                <h2 className="text-lg font-black text-[#343434] mt-0.5 flex items-center space-x-2">
                  <span>Transaction #{selectedTx.request_id}</span>
                  <button
                    onClick={() => copyToClipboard(selectedTx.request_id, 'requestId')}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
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

              <StatusBadge status={selectedTx.delivery_status} />
            </div>

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
                <div className="grid grid-cols-3 gap-2 pt-1 text-gray-700">
                  <div><span className="text-gray-400 text-[10px] block">Request ID</span><code className="font-bold font-mono">#{selectedTx.request_id}</code></div>
                  <div><span className="text-gray-400 text-[10px] block">Service</span><span className="font-semibold">{selectedTx.service}</span></div>
                  <div><span className="text-gray-400 text-[10px] block">Provider</span><span className="font-semibold">{selectedTx.provider}</span></div>
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
                  <span className="font-extrabold text-[#343434]">₹{selectedTx.amount.toFixed(2)}</span>
                </div>
                <p className="text-gray-600 text-[11px]">
                  Provider {selectedTx.provider} returned HTTP 402 header & payment invoice parameters for ₹{selectedTx.amount.toFixed(2)}.
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
                  Spending limit authorization evaluated independently on-chain by Solidity Smart Contract (Hard cap limit ₹500).
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
                  <span className="font-extrabold">{isBlocked ? '₹0.00 Deducted' : `₹${selectedTx.amount.toFixed(2)} Paid`}</span>
                </div>
                {isBlocked ? (
                  <p className="text-xs font-semibold">
                    Smart Contract Rejected: BUDGET_EXCEEDED (Attempted ₹200, Remaining budget ₹180).
                  </p>
                ) : (
                  <div className="flex items-center space-x-2 pt-0.5">
                    <span className="text-gray-600 text-[11px]">Tx Hash:</span>
                    <code className="font-mono text-[11px] text-[#55705C] bg-white px-2 py-0.5 rounded border border-[#C8E6C9] truncate">
                      {selectedTx.payment_tx}
                    </code>
                    <button
                      onClick={() => copyToClipboard(selectedTx.payment_tx, 'paymentTx')}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
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
                  <div className="flex items-center space-x-2 pt-0.5">
                    <span className="text-gray-600 text-[11px]">Content Hash:</span>
                    <code className="font-mono text-[11px] text-gray-700 bg-white px-2 py-0.5 rounded border border-[#BBDEFB] truncate">
                      {selectedTx.content_hash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(selectedTx.content_hash, 'contentHash')}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
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
              <div>
                <span className="text-gray-400 text-[10px] block font-medium">Request Identifier</span>
                <div className="flex items-center space-x-1 mt-0.5">
                  <code className="font-mono font-bold text-[#343434]">#{selectedTx.request_id}</code>
                  <button onClick={() => copyToClipboard(selectedTx.request_id, 'requestIdCard')} className="text-gray-400 hover:text-gray-600">
                    {copiedField === 'requestIdCard' ? <Check className="w-3 h-3 text-[#3E8C5A]" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-gray-400 text-[10px] block font-medium">Service Category</span>
                <span className="font-semibold text-gray-700 block mt-0.5">{selectedTx.service} ({selectedTx.provider})</span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-gray-400 text-[10px] block font-medium">Sepolia Payment Transaction</span>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="font-mono text-[11px] text-[#55705C] bg-[#FDF8F5] px-2 py-1 rounded border border-[#E9D8CC] truncate block flex-1">
                    {selectedTx.payment_tx}
                  </code>
                  <button onClick={() => copyToClipboard(selectedTx.payment_tx, 'paymentTxCard')} className="p-1 bg-white border border-[#E9D8CC] rounded-lg text-gray-500 hover:text-gray-800">
                    {copiedField === 'paymentTxCard' ? <Check className="w-3.5 h-3.5 text-[#3E8C5A]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <span className="text-gray-400 text-[10px] block font-medium">Delivered Resource Content Hash</span>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="font-mono text-[11px] text-gray-700 bg-[#FDF8F5] px-2 py-1 rounded border border-[#E9D8CC] truncate block flex-1">
                    {selectedTx.content_hash}
                  </code>
                  <button onClick={() => copyToClipboard(selectedTx.content_hash, 'contentHashCard')} className="p-1 bg-white border border-[#E9D8CC] rounded-lg text-gray-500 hover:text-gray-800">
                    {copiedField === 'contentHashCard' ? <Check className="w-3.5 h-3.5 text-[#2563EB]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 font-serif italic">
              * Note: This content hash provides an auditable fingerprint of the delivered result associated with the payment.
            </p>
          </div>

          {/* 6. RETRY / DOUBLE-PAYMENT PROTECTION AUDIT CARD */}
          {hasRetryInfo && (
            <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#343434] flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 text-[#3B82F6]" />
                  <span>On-Chain Retry Audit & Protection Demo</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                  ✓ Protected
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white p-4 rounded-2xl border border-[#E9D8CC]">
                <div>
                  <span className="text-gray-400 block text-[10px]">First Attempt</span>
                  <span className="font-semibold text-gray-700">Payment Submitted</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Network State</span>
                  <span className="font-bold text-amber-600">Timeout Detected</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Smart Contract</span>
                  <span className="font-bold text-[#55705C]">Already Processed</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Additional Payment</span>
                  <span className="font-extrabold text-[#3E8C5A]">₹0.00</span>
                </div>
              </div>

              <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] rounded-2xl text-xs text-[#3E8C5A] font-bold flex items-center justify-between">
                <span>Final Result: ✓ Duplicate payment prevented</span>
                <span className="font-mono text-[10px]">Request #{selectedTx.request_id}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
