import React from 'react';
import { X, ShieldCheck, ShieldAlert, Clock, Building, DollarSign, FileCode, ArrowDown, RefreshCw } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function TransactionModal({ transaction, onClose }) {
  if (!transaction) return null;

  const isBlocked = transaction.delivery_status === 'Blocked';
  const hasRetryInfo = transaction.request_id === 'A104';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn select-none">
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-[#343434]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E9D8CC] flex items-center justify-between bg-white">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-black text-[#343434]">
              Request Details — #{transaction.request_id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-[#FAD2C0]/30 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Top Status Banner */}
          <div className={`p-4 rounded-2xl border flex items-center space-x-3 ${
            isBlocked 
              ? 'bg-[#FFEBEE] border-[#FFCDD2] text-[#C94C4C]' 
              : 'bg-[#E8F5E9] border-[#C8E6C9] text-[#3E8C5A]'
          }`}>
            {isBlocked ? (
              <ShieldAlert className="w-6 h-6 shrink-0" />
            ) : (
              <ShieldCheck className="w-6 h-6 shrink-0" />
            )}
            <div>
              <div className="font-extrabold text-sm">
                {isBlocked ? 'Payment Rejected by Smart Contract' : 'Transaction Approved & Delivered'}
              </div>
              <div className="text-xs opacity-90 font-medium">
                {isBlocked 
                  ? 'Smart contract detected spending limit violation (BUDGET_EXCEEDED).' 
                  : 'Payment verified by HTTP 402 flow and delivery proof recorded on-chain.'}
              </div>
            </div>
          </div>

          {/* SUCCESSFUL TRANSACTION CHAIN VISUALIZATION */}
          {!isBlocked ? (
            <div className="bg-white p-4 rounded-2xl border border-[#E9D8CC] space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block">
                PAYMENT & DELIVERY CHAIN
              </span>

              <div className="space-y-2 text-xs">
                {/* Step 1: Request */}
                <div className="p-2.5 bg-[#FFF9F5] border border-[#E9D8CC] rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-gray-500">REQUEST</span>
                  <code className="font-mono font-bold text-[#343434]">#{transaction.request_id}</code>
                </div>
                
                <div className="flex justify-center text-gray-300">
                  <ArrowDown className="w-4 h-4" />
                </div>

                {/* Step 2: Payment */}
                <div className="p-2.5 bg-[#FFF9F5] border border-[#E9D8CC] rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-gray-500">PAYMENT</span>
                  <span className="font-extrabold text-[#343434]">₹{transaction.amount.toFixed(2)}</span>
                </div>

                <div className="flex justify-center text-gray-300">
                  <ArrowDown className="w-4 h-4" />
                </div>

                {/* Step 3: Transaction Hash */}
                <div className="p-2.5 bg-[#FFF9F5] border border-[#E9D8CC] rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-gray-500">TRANSACTION</span>
                  <code className="font-mono text-[11px] text-[#55705C] bg-white px-2 py-0.5 rounded border border-[#E9D8CC] truncate max-w-[180px]">
                    {transaction.payment_tx}
                  </code>
                </div>

                <div className="flex justify-center text-gray-300">
                  <ArrowDown className="w-4 h-4" />
                </div>

                {/* Step 4: Delivery */}
                <div className="p-2.5 bg-[#E8F5E9] border border-[#C8E6C9] rounded-xl flex justify-between items-center text-[#3E8C5A]">
                  <span className="font-bold">DELIVERY</span>
                  <span className="font-extrabold">✓ {transaction.delivery_status}</span>
                </div>

                <div className="flex justify-center text-gray-300">
                  <ArrowDown className="w-4 h-4" />
                </div>

                {/* Step 5: Content Hash */}
                <div className="p-2.5 bg-[#FFF9F5] border border-[#E9D8CC] rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-gray-500">CONTENT HASH</span>
                  <code className="font-mono text-[11px] text-gray-700 bg-white px-2 py-0.5 rounded border border-[#E9D8CC] truncate max-w-[180px]">
                    {transaction.content_hash}
                  </code>
                </div>
              </div>
            </div>
          ) : (
            /* BLOCKED TRANSACTION DETAIL VIEW */
            <div className="bg-white p-4 rounded-2xl border border-[#E9D8CC] space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-[#C94C4C] block">
                BLOCKED STATE BREAKDOWN
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#FFF9F5] border border-[#E9D8CC] rounded-xl">
                  <span className="text-gray-400 block text-[10px]">Request ID</span>
                  <span className="font-bold text-[#343434]">#{transaction.request_id}</span>
                </div>
                <div className="p-3 bg-[#FFF9F5] border border-[#E9D8CC] rounded-xl">
                  <span className="text-gray-400 block text-[10px]">Requested Amount</span>
                  <span className="font-extrabold text-[#C94C4C]">₹{transaction.amount.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-[#FFF9F5] border border-[#E9D8CC] rounded-xl">
                  <span className="text-gray-400 block text-[10px]">Reason</span>
                  <span className="font-bold text-[#C94C4C]">BUDGET_EXCEEDED</span>
                </div>
                <div className="p-3 bg-[#FFF9F5] border border-[#E9D8CC] rounded-xl">
                  <span className="text-gray-400 block text-[10px]">Enforcement Layer</span>
                  <span className="font-bold text-[#55705C]">Sepolia Smart Contract</span>
                </div>
                <div className="p-3 bg-[#FFF9F5] border border-[#E9D8CC] rounded-xl">
                  <span className="text-gray-400 block text-[10px]">Payment Deducted</span>
                  <span className="font-extrabold text-[#3E8C5A]">₹0.00</span>
                </div>
                <div className="p-3 bg-[#FFF9F5] border border-[#E9D8CC] rounded-xl">
                  <span className="text-gray-400 block text-[10px]">Delivery Status</span>
                  <span className="font-bold text-gray-500">Not Delivered</span>
                </div>
              </div>
            </div>
          )}

          {/* REUSABLE METADATA GRID */}
          <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-[#E9D8CC] text-xs">
            <div>
              <span className="text-gray-400 text-[10px] block">Service Category</span>
              <span className="font-bold text-[#343434]">{transaction.service}</span>
            </div>
            <div>
              <span className="text-gray-400 text-[10px] block">Provider</span>
              <span className="font-bold text-[#343434]">{transaction.provider}</span>
            </div>
            <div>
              <span className="text-gray-400 text-[10px] block">Timestamp</span>
              <span className="font-semibold text-gray-600">{transaction.timestamp} ({transaction.date})</span>
            </div>
            <div>
              <span className="text-gray-400 text-[10px] block">Delivery Status</span>
              <div className="mt-0.5">
                <StatusBadge status={transaction.delivery_status} />
              </div>
            </div>
          </div>

          {/* RETRY / DOUBLE PAYMENT INFORMATION BLOCK */}
          {hasRetryInfo && (
            <div className="p-4 bg-[#E3F2FD] border border-[#BBDEFB] rounded-2xl space-y-2 text-xs text-[#1E3A8A]">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center space-x-1.5 text-[#1E293B]">
                  <RefreshCw className="w-4 h-4 text-[#2563EB]" />
                  <span>Retry & Double-Payment Protection</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#3E8C5A]">
                  Protected
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-gray-500 block">Initial Attempt:</span>
                  <span className="font-semibold">Submitted</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Network State:</span>
                  <span className="font-semibold text-amber-700">Timeout Detected</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Retry Attempt:</span>
                  <span className="font-semibold">Same Request ID (#{transaction.request_id})</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Additional Charge:</span>
                  <span className="font-bold text-[#3E8C5A]">₹0.00</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-600 font-serif italic pt-1 border-t border-[#BBDEFB]">
                Result: Duplicate payment prevented by smart contract on-chain state.
              </p>
            </div>
          )}

          {/* ERROR DETAILS IF PRESENT */}
          {transaction.error && (
            <div className="p-3 bg-[#FFEBEE] rounded-xl border border-[#FFCDD2] text-[#C94C4C] text-xs">
              <span className="font-bold block">Smart Contract Event Error:</span>
              <span className="mt-0.5 block font-mono text-[11px]">{transaction.error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#FDF8F5] border-t border-[#E9D8CC] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
