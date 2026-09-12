import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Lock, 
  Wallet, 
  Coins, 
  ArrowDownToLine, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  Info
} from 'lucide-react';
import { useBlockchain } from '../../context/BlockchainContext';

export default function OwnerControlsModal({ onClose }) {
  const {
    account,
    isConnected,
    isOwner,
    contractOwner,
    contractAddress,
    budget,
    vaultBalance,
    hardCap,
    setBudgetAction,
    fundContractAction,
    withdrawFundsAction,
    blockExplorerUrl,
    connectWallet,
  } = useBlockchain();

  const [activeTab, setActiveTab] = useState('budget'); // 'budget' | 'fund' | 'withdraw'
  const [budgetInput, setBudgetInput] = useState('');
  const [fundInput, setFundInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [validationError, setValidationError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Tab 1: Submit setBudget ────────────────────────────────────────────────
  const handleSetBudgetSubmit = async (e) => {
    e.preventDefault();
    setValidationError(null);

    const val = parseFloat(budgetInput);
    if (isNaN(val) || val <= 0) {
      setValidationError('Please enter a valid positive ETH budget amount.');
      return;
    }

    if (budget) {
      const minSpent = parseFloat(budget.totalSpentEth) || 0;
      const maxCap = hardCap ? parseFloat(hardCap.eth) : (parseFloat(budget.hardCapEth) || 0);

      if (val < minSpent) {
        setValidationError(`Budget cannot be set below total spent so far (${minSpent} ETH).`);
        return;
      }
      if (maxCap > 0 && val > maxCap) {
        setValidationError(`Budget cannot exceed the immutable hard spending cap (${maxCap} ETH).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await setBudgetAction(budgetInput.trim());
      setBudgetInput('');
      onClose();
    } catch (err) {
      setValidationError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Tab 2: Submit fund() payable ───────────────────────────────────────────
  const handleFundSubmit = async (e) => {
    e.preventDefault();
    setValidationError(null);

    const val = parseFloat(fundInput);
    if (isNaN(val) || val <= 0) {
      setValidationError('Please enter a valid positive ETH deposit amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await fundContractAction(fundInput.trim());
      setFundInput('');
      onClose();
    } catch (err) {
      setValidationError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Tab 3: Submit withdraw() ───────────────────────────────────────────────
  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    setValidationError(null);

    const val = parseFloat(withdrawInput);
    if (isNaN(val) || val <= 0) {
      setValidationError('Please enter a valid positive ETH withdrawal amount.');
      return;
    }

    if (vaultBalance) {
      const maxAvailable = parseFloat(vaultBalance.balanceEth) || 0;
      if (val > maxAvailable) {
        setValidationError(`Requested amount exceeds current vault balance (${maxAvailable} ETH).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await withdrawFundsAction(withdrawInput.trim());
      setWithdrawInput('');
      onClose();
    } catch (err) {
      setValidationError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn select-none">
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-[#343434]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E9D8CC] flex items-center justify-between bg-white">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[#3E8C5A]" />
            <span className="text-base font-black text-[#343434]">
              Contract Owner Portal
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
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Access Control Notice */}
          {!isConnected ? (
            <div className="p-4 bg-[#FFF8E7] border border-[#FFE082] rounded-2xl text-xs space-y-3">
              <div className="flex items-center space-x-2 text-amber-800 font-bold">
                <Wallet className="w-4 h-4 text-amber-600" />
                <span>Wallet Not Connected</span>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Connect the contract deployer / owner wallet to manage smart contract budget and vault parameters.
              </p>
              <button
                onClick={connectWallet}
                className="px-4 py-2 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Connect Owner Wallet
              </button>
            </div>
          ) : !isOwner ? (
            <div className="p-4 bg-[#FFEBEE] border border-[#FFCDD2] rounded-2xl text-xs space-y-2">
              <div className="flex items-center space-x-2 text-[#C94C4C] font-bold">
                <Lock className="w-4 h-4 text-[#C94C4C]" />
                <span>Owner Role Required</span>
              </div>
              <p className="text-gray-700 leading-relaxed text-[11px]">
                Your connected account (<code className="font-mono text-xs">{account?.substring(0, 8)}...{account?.substring(account?.length - 6)}</code>) is not the registered owner of the AgentPay smart contract.
              </p>
              {contractOwner && (
                <div className="pt-2 border-t border-[#FFCDD2] text-[11px]">
                  <span className="text-gray-500 block">Registered Contract Owner:</span>
                  <a
                    href={`${blockExplorerUrl}/address/${contractOwner}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono font-bold text-[#2563EB] hover:underline flex items-center space-x-1 mt-0.5"
                  >
                    <span className="truncate max-w-[260px]">{contractOwner}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
              <div className="pt-2">
                <span className="px-2 py-0.5 rounded-full bg-white text-[#C94C4C] font-bold text-[10px] border border-[#FFCDD2]">
                  Owner Controls Locked
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] rounded-2xl flex items-center justify-between text-xs text-[#2E7D32]">
              <div className="flex items-center space-x-2 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Contract Owner Authenticated</span>
              </div>
              <span className="font-mono text-[11px]">
                {account?.substring(0, 6)}...{account?.substring(account?.length - 4)}
              </span>
            </div>
          )}

          {/* Current Contract Parameters Overview */}
          <div className="grid grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-[#E9D8CC] text-xs">
            <div>
              <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">Operational Budget</span>
              <span className="font-bold text-sm text-[#343434]">
                {budget ? `${budget.budgetEth} ETH` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">Total Spent</span>
              <span className="font-bold text-sm text-[#55705C]">
                {budget ? `${budget.totalSpentEth} ETH` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">Vault Balance</span>
              <span className="font-bold text-sm text-[#3E8C5A]">
                {vaultBalance ? `${vaultBalance.balanceEth} ETH` : '—'}
              </span>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex p-1 bg-white border border-[#E9D8CC] rounded-2xl text-xs font-bold">
            <button
              onClick={() => { setActiveTab('budget'); setValidationError(null); }}
              className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'budget' 
                  ? 'bg-[#FAD2C0] text-[#343434] shadow-xs' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Set Budget
            </button>
            <button
              onClick={() => { setActiveTab('fund'); setValidationError(null); }}
              className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'fund' 
                  ? 'bg-[#FAD2C0] text-[#343434] shadow-xs' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Deposit Funds
            </button>
            <button
              onClick={() => { setActiveTab('withdraw'); setValidationError(null); }}
              className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'withdraw' 
                  ? 'bg-[#FAD2C0] text-[#343434] shadow-xs' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Withdraw Funds
            </button>
          </div>

          {/* Tab 1: Set Budget Form */}
          {activeTab === 'budget' && (
            <form onSubmit={handleSetBudgetSubmit} className="space-y-4">
              <div className="p-3 bg-white border border-[#E9D8CC] rounded-2xl text-xs space-y-1">
                <span className="font-bold text-[#343434] block">setBudget(uint256 amount)</span>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Updates the autonomous spending allowance for the AI Agent. Must satisfy: <code className="font-mono text-[10px]">totalSpent ({budget?.totalSpentEth || '0'} ETH) ≤ amount ≤ hardSpendingCap ({hardCap?.eth || budget?.hardCapEth || '0'} ETH)</code>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  New Operational Budget (in ETH)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="e.g. 0.05"
                    disabled={!isOwner || isSubmitting}
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E9D8CC] rounded-xl text-xs font-bold text-[#343434] focus:outline-none focus:border-[#D97B45] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    ETH
                  </span>
                </div>
              </div>

              {validationError && (
                <div className="p-3 bg-[#FFEBEE] border border-[#FFCDD2] rounded-xl text-xs text-[#C94C4C] font-medium flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!isOwner || isSubmitting || !budgetInput}
                className="w-full py-3 bg-[#3E8C5A] hover:bg-[#2E7D32] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl transition-all shadow-xs cursor-pointer"
              >
                {isSubmitting ? 'Submitting to Sepolia...' : 'Confirm New Budget On-Chain'}
              </button>
            </form>
          )}

          {/* Tab 2: Deposit Funds Form */}
          {activeTab === 'fund' && (
            <form onSubmit={handleFundSubmit} className="space-y-4">
              <div className="p-3 bg-white border border-[#E9D8CC] rounded-2xl text-xs space-y-1">
                <span className="font-bold text-[#343434] block">fund() (payable)</span>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Tops up native Sepolia ETH in the contract vault so the AI Agent can execute service purchases.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Deposit Amount (in ETH)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="e.g. 0.1"
                    disabled={!isConnected || isSubmitting}
                    value={fundInput}
                    onChange={(e) => setFundInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E9D8CC] rounded-xl text-xs font-bold text-[#343434] focus:outline-none focus:border-[#D97B45] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    ETH
                  </span>
                </div>
              </div>

              {validationError && (
                <div className="p-3 bg-[#FFEBEE] border border-[#FFCDD2] rounded-xl text-xs text-[#C94C4C] font-medium flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!isConnected || isSubmitting || !fundInput}
                className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl transition-all shadow-xs cursor-pointer"
              >
                {isSubmitting ? 'Submitting to Sepolia...' : 'Deposit Native ETH to Contract'}
              </button>
            </form>
          )}

          {/* Tab 3: Withdraw Funds Form */}
          {activeTab === 'withdraw' && (
            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              <div className="p-3 bg-white border border-[#E9D8CC] rounded-2xl text-xs space-y-1">
                <span className="font-bold text-[#343434] block">withdraw(uint256 amount)</span>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Withdraws unspent native ETH from the contract balance back to the owner wallet. Cannot exceed current vault balance ({vaultBalance?.balanceEth || '0'} ETH).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Withdrawal Amount (in ETH)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="e.g. 0.05"
                    disabled={!isOwner || isSubmitting}
                    value={withdrawInput}
                    onChange={(e) => setWithdrawInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E9D8CC] rounded-xl text-xs font-bold text-[#343434] focus:outline-none focus:border-[#D97B45] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    ETH
                  </span>
                </div>
              </div>

              {validationError && (
                <div className="p-3 bg-[#FFEBEE] border border-[#FFCDD2] rounded-xl text-xs text-[#C94C4C] font-medium flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!isOwner || isSubmitting || !withdrawInput}
                className="w-full py-3 bg-[#D97B45] hover:bg-[#C06530] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl transition-all shadow-xs cursor-pointer"
              >
                {isSubmitting ? 'Submitting to Sepolia...' : 'Withdraw ETH to Owner Wallet'}
              </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#FDF8F5] border-t border-[#E9D8CC] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-[#E9D8CC] hover:bg-gray-50 text-[#343434] text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
