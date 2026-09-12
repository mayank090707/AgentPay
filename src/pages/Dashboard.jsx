import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBlockchain } from '../context/BlockchainContext';
import StatCard from '../components/dashboard/StatCard';
import SpendingChart from '../components/dashboard/SpendingChart';
import BudgetUsageChart from '../components/dashboard/BudgetUsageChart';
import RecentActivityTable from '../components/dashboard/RecentActivityTable';
import TopProvidersList from '../components/dashboard/TopProvidersList';
import MascotBanner from '../components/dashboard/MascotBanner';
import TransactionModal from '../components/common/TransactionModal';
import { AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { 
  mockContractSummary, 
  mockSpendingOverview, 
  mockTransactions, 
  mockProviders 
} from '../data/mockData';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedTx, setSelectedTx] = useState(null);

  const {
    budget,
    isContractConfigured,
    contractAddress,
    isLoading: isBlockchainLoading,
    refreshData,
    isConnected,
  } = useBlockchain();

  // Determine budget statistics: prioritize live on-chain contract reads
  const hasLiveBudget = Boolean(isContractConfigured && budget);

  const budgetDisplay = hasLiveBudget
    ? {
        totalBudget: `${budget.budgetEth} ETH`,
        budgetSubtitle: 'On-chain Sepolia Budget',
        totalSpent: `${budget.totalSpentEth} ETH`,
        spentProgress: budget.progressPercent,
        remainingBudget: `${budget.remainingEth} ETH`,
        remainingBadge: `${budget.remainingPercent}% left`,
        chartSpent: parseFloat(budget.totalSpentEth) || 0,
        chartRemaining: parseFloat(budget.remainingEth) || 0,
        chartTotal: parseFloat(budget.budgetEth) || 0,
        chartUnit: 'ETH',
      }
    : isContractConfigured
    ? {
        totalBudget: isBlockchainLoading ? 'Loading...' : '0.0 ETH',
        budgetSubtitle: 'Fetching from Sepolia...',
        totalSpent: isBlockchainLoading ? 'Loading...' : '0.0 ETH',
        spentProgress: 0,
        remainingBudget: isBlockchainLoading ? 'Loading...' : '0.0 ETH',
        remainingBadge: '0% left',
        chartSpent: 0,
        chartRemaining: 0,
        chartTotal: 0,
        chartUnit: 'ETH',
      }
    : {
        // Safe unconfigured state — clearly displays configuration requirement
        totalBudget: 'Not Configured',
        budgetSubtitle: 'Set VITE_CONTRACT_ADDRESS',
        totalSpent: '—',
        spentProgress: 0,
        remainingBudget: '—',
        remainingBadge: 'Needs .env',
        // Fallback to mock figures for visual chart preview only
        chartSpent: mockContractSummary.totalSpent,
        chartRemaining: mockContractSummary.remainingBudget,
        chartTotal: mockContractSummary.totalBudget,
        chartUnit: '₹',
      };

  return (
    <div className="space-y-6 pt-4 animate-fadeIn">
      {/* Welcome Banner Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
        <div>
          <span className="text-[11px] font-bold text-gray-500 tracking-wider uppercase">
            WELCOME BACK,
          </span>
          <h1 className="text-2xl font-extrabold text-[#343434] tracking-tight mt-0.5">
            Good morning, {user?.name || 'Alex'} 👋
          </h1>
          <p className="text-xs text-gray-600 font-medium mt-1">
            Your AI agent is running smoothly and within autonomous budget limits.
          </p>
        </div>

        {/* Right Status Actions */}
        <div className="flex items-center space-x-3">
          {isContractConfigured && (
            <button
              onClick={refreshData}
              disabled={isBlockchainLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/70 hover:bg-white border border-[#E9D8CC] rounded-full text-xs font-semibold text-[#6B4226] shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Refresh smart contract status from Sepolia"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBlockchainLoading ? 'animate-spin' : ''}`} />
              <span>{isBlockchainLoading ? 'Syncing...' : 'Sync Contract'}</span>
            </button>
          )}

          <div className="text-right hidden md:block">
            <p className="text-xs font-serif italic text-gray-600 bg-white/60 backdrop-blur-xs px-3 py-1 rounded-full border border-[#E9D8CC]/60">
              &ldquo;Autonomous agents. Accountable spending.&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Contract Configuration Notice Banner (if unconfigured) */}
      {!isContractConfigured && (
        <div className="p-4 bg-[#FFF8F0] border border-[#FFE0B2] rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="p-2 bg-[#FFE0B2] rounded-2xl text-amber-800 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold text-[#343434]">
                Sepolia Smart Contract Not Configured
              </p>
              <p className="text-gray-600 text-[11px] mt-0.5">
                Add <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#E9D8CC]">VITE_CONTRACT_ADDRESS=0x...</code> to your frontend <code className="font-mono">.env</code> to connect live on-chain reads.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#FFE0B2] text-amber-900 font-bold text-[10px] uppercase tracking-wider self-start sm:self-auto">
            Demo Mode Active
          </span>
        </div>
      )}

      {/* 4 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          type="budget"
          title="Total Budget"
          value={budgetDisplay.totalBudget}
          subtitle={budgetDisplay.budgetSubtitle}
        />
        <StatCard
          type="spent"
          title="Total Spent"
          value={budgetDisplay.totalSpent}
          progress={budgetDisplay.spentProgress}
        />
        <StatCard
          type="remaining"
          title="Remaining"
          value={budgetDisplay.remainingBudget}
          badgeText={budgetDisplay.remainingBadge}
        />
        <StatCard
          type="transactions"
          title="Transactions"
          value={mockContractSummary.totalTransactions}
          subtitle={`${mockContractSummary.successfulTransactions} successful  ${mockContractSummary.blockedTransactions} blocked`}
        />
      </div>

      {/* Row 2: Charts (Spending Overview 2/3 + Budget Usage 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2">
          <SpendingChart data={mockSpendingOverview} />
        </div>
        <div className="lg:col-span-1">
          <BudgetUsageChart 
            spent={budgetDisplay.chartSpent} 
            remaining={budgetDisplay.chartRemaining}
            total={budgetDisplay.chartTotal}
            unit={budgetDisplay.chartUnit}
          />
        </div>
      </div>

      {/* Row 3: Activity Table & Top Providers (Activity 2/3 + Providers 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2">
          <RecentActivityTable 
            transactions={mockTransactions.slice(0, 4)} 
            onSelectTransaction={(tx) => setSelectedTx(tx)}
            onViewAll={() => navigate('/payments')}
          />
        </div>
        
        <div className="lg:col-span-1 flex flex-col space-y-4 justify-between">
          <TopProvidersList 
            providers={mockProviders}
            onViewAll={() => navigate('/providers')} 
          />
          <MascotBanner onAction={() => navigate('/agent')} />
        </div>
      </div>

      {/* Detailed Modal Popup for Transaction */}
      {selectedTx && (
        <TransactionModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
}
