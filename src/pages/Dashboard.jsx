import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/dashboard/StatCard';
import SpendingChart from '../components/dashboard/SpendingChart';
import BudgetUsageChart from '../components/dashboard/BudgetUsageChart';
import RecentActivityTable from '../components/dashboard/RecentActivityTable';
import TopProvidersList from '../components/dashboard/TopProvidersList';
import MascotBanner from '../components/dashboard/MascotBanner';
import TransactionModal from '../components/common/TransactionModal';
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
            Your AI agent is running smoothly and within budget.
          </p>
        </div>

        {/* Right Callout Quote */}
        <div className="text-right hidden md:block">
          <p className="text-xs font-serif italic text-gray-600 bg-white/60 backdrop-blur-xs px-3 py-1 rounded-full border border-[#E9D8CC]/60">
            &ldquo;Autonomous agents. Accountable spending.&rdquo;
          </p>
        </div>
      </div>

      {/* 4 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          type="budget"
          title="Total Budget"
          value={`₹${mockContractSummary.totalBudget.toFixed(2)}`}
          subtitle="Set by Smart Contract"
        />
        <StatCard
          type="spent"
          title="Total Spent"
          value={`₹${mockContractSummary.totalSpent.toFixed(2)}`}
          progress={64}
        />
        <StatCard
          type="remaining"
          title="Remaining"
          value={`₹${mockContractSummary.remainingBudget.toFixed(2)}`}
          badgeText="36% left"
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
            spent={mockContractSummary.totalSpent} 
            remaining={mockContractSummary.remainingBudget}
            total={mockContractSummary.totalBudget}
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
