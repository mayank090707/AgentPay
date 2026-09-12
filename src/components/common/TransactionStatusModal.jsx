import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  X, 
  Loader2, 
  Clock, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useBlockchain } from '../../context/BlockchainContext';

export default function TransactionStatusModal() {
  const { activeTransaction, dismissTransactionModal, blockExplorerUrl } = useBlockchain();

  if (!activeTransaction) return null;

  const { type, state, txHash, receipt, error, amountEth } = activeTransaction;

  const getActionTitle = () => {
    switch (type) {
      case 'SET_BUDGET':
        return 'Adjust Operational Budget';
      case 'FUND':
        return 'Deposit Funds into Vault';
      case 'WITHDRAW':
        return 'Withdraw Unspent Funds';
      default:
        return 'Smart Contract Transaction';
    }
  };

  const isPending = state === 'VALIDATING' || state === 'AWAITING_SIGNATURE' || state === 'PENDING';
  const isSuccess = state === 'CONFIRMED';
  const isFailed = state === 'FAILED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn select-none">
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-[#343434]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E9D8CC] flex items-center justify-between bg-white">
          <span className="text-base font-black text-[#343434]">
            {getActionTitle()}
          </span>
          {!isPending && (
            <button
              onClick={dismissTransactionModal}
              className="p-1 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-[#FAD2C0]/30 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-center">
          
          {/* Status Icon */}
          <div className="flex justify-center">
            {state === 'VALIDATING' && (
              <div className="w-16 h-16 rounded-full bg-[#FFF3E0] border border-[#FFE082] flex items-center justify-center text-amber-600 animate-pulse">
                <Clock className="w-8 h-8" />
              </div>
            )}
            {state === 'AWAITING_SIGNATURE' && (
              <div className="w-16 h-16 rounded-full bg-[#E3F2FD] border border-[#BBDEFB] flex items-center justify-center text-[#2563EB]">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
            {state === 'PENDING' && (
              <div className="w-16 h-16 rounded-full bg-[#E3F2FD] border border-[#BBDEFB] flex items-center justify-center text-[#2563EB]">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
            {isSuccess && (
              <div className="w-16 h-16 rounded-full bg-[#E8F5E9] border border-[#C8E6C9] flex items-center justify-center text-[#2E7D32]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            )}
            {isFailed && (
              <div className="w-16 h-16 rounded-full bg-[#FFEBEE] border border-[#FFCDD2] flex items-center justify-center text-[#C94C4C]">
                <ShieldAlert className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* Status Message */}
          <div className="space-y-1">
            <h3 className="text-lg font-black text-[#343434]">
              {state === 'VALIDATING' && 'Validating Preconditions...'}
              {state === 'AWAITING_SIGNATURE' && 'Confirm in Wallet'}
              {state === 'PENDING' && 'Broadcasting Transaction...'}
              {isSuccess && 'Transaction Confirmed!'}
              {isFailed && 'Transaction Failed'}
            </h3>
            
            <p className="text-xs text-gray-600">
              {state === 'VALIDATING' && 'Checking network connection, caller role, and budget invariants...'}
              {state === 'AWAITING_SIGNATURE' && 'Please approve the transaction prompt in your MetaMask / Web3 wallet.'}
              {state === 'PENDING' && 'Transaction submitted to Ethereum Sepolia. Waiting for on-chain block inclusion...'}
              {isSuccess && 'Smart contract state has been updated and on-chain verified.'}
              {isFailed && (error || 'The transaction could not be completed on-chain.')}
            </p>
          </div>

          {/* Amount Badge */}
          {amountEth && (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white border border-[#E9D8CC] rounded-full text-xs font-mono font-bold text-[#343434]">
              <span>Amount:</span>
              <span className="text-[#3E8C5A]">{amountEth} ETH</span>
            </div>
          )}

          {/* Transaction Hash Link (if submitted) */}
          {txHash && (
            <div className="p-3 bg-white border border-[#E9D8CC] rounded-2xl text-xs space-y-1 text-left">
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block font-bold">
                Sepolia Transaction Hash
              </span>
              <a
                href={`${blockExplorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] text-[#2563EB] hover:underline flex items-center justify-between"
                title="View on Sepolia Etherscan"
              >
                <span className="truncate max-w-[280px]">{txHash}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 ml-1" />
              </a>
              {receipt?.blockNumber && (
                <div className="text-[10px] text-gray-500 font-mono pt-1 border-t border-gray-100 flex justify-between">
                  <span>Block Number:</span>
                  <span className="font-bold text-gray-700">#{receipt.blockNumber}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#FDF8F5] border-t border-[#E9D8CC] flex justify-end">
          {isPending ? (
            <div className="flex items-center space-x-2 text-xs text-gray-500 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Do not close this window...</span>
            </div>
          ) : (
            <button
              onClick={dismissTransactionModal}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer ${
                isSuccess
                  ? 'bg-[#3E8C5A] hover:bg-[#2E7D32] text-white'
                  : 'bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434]'
              }`}
            >
              {isSuccess ? 'Done' : 'Close'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
