import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBlockchain } from '../context/BlockchainContext';
import StatCard from '../components/dashboard/StatCard';
import SpendingChart from '../components/dashboard/SpendingChart';
import BudgetUsageChart from '../components/dashboard/BudgetUsageChart';
import RecentActivityTable from '../components/dashboard/RecentActivityTable';
import TopProvidersList from '../components/dashboard/TopProvidersList';
import MascotBanner from '../components/dashboard/MascotBanner';
import TransactionModal from '../components/common/TransactionModal';
import { 
  fetchAuditLogs, 
  fetchProviders, 
  parseAuditLogsToTransactions,
  getSessionResetTime,
  resetSession 
} from '../services/api';
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ── Blockchain Context (Live Sepolia Read) ─────────────────────────────────
  const { 
    budget, 
    vaultBalance, 
    isLoading: isBlockchainLoading, 
    error: blockchainError,
    refreshData: refreshBlockchain 
  } = useBlockchain();

  // ── Backend State (FastAPI Audit Logs & Provider Registry) ─────────────────
  const [transactions, setTransactions] = useState([]);
  const [backendProviders, setBackendProviders] = useState([]);
  const [isBackendLoading, setIsBackendLoading] = useState(true);
  const [isBackendLive, setIsBackendLive] = useState(false);

  const loadBackendData = async () => {
    setIsBackendLoading(true);
    try {
      const [logsRes, providersRes] = await Promise.all([
        fetchAuditLogs({ limit: 100 }).catch(() => null),
        fetchProviders().catch(() => null),
      ]);

      if (logsRes && Array.isArray(logsRes.logs)) {
        const parsedTx = parseAuditLogsToTransactions(logsRes.logs);
        const resetTime = getSessionResetTime();
        const sessionTxs = parsedTx.filter(tx => {
          const txTime = new Date(tx.rawLogs?.[0]?.timestamp || tx.timestamp || 0).getTime();
          return txTime >= resetTime;
        });
        setTransactions(sessionTxs);
        setIsBackendLive(true);
      } else {
        setTransactions([]);
        setIsBackendLive(false);
      }

      if (providersRes && Array.isArray(providersRes.providers) && providersRes.providers.length > 0) {
        const formatted = providersRes.providers.map((p) => {
          const firstServiceKey = Object.keys(p.services || {})[0] || 'compute';
          const pricingObj = p.services?.[firstServiceKey];
          return {
            id: p.provider_id,
            name: p.name,
            service: firstServiceKey.charAt(0).toUpperCase() + firstServiceKey.slice(1),
            pricePerRequest: pricingObj ? pricingObj.price_per_unit : 0.001,
            rating: 4.8,
            iconType: firstServiceKey.toLowerCase(),
          };
        });
        setBackendProviders(formatted);
      } else {
        setBackendProviders([]);
      }
    } catch (err) {
      setTransactions([]);
      setBackendProviders([]);
      setIsBackendLive(false);
    } finally {
      setIsBackendLoading(false);
    }
  };

  useEffect(() => {
    loadBackendData();

    const handleUpdate = () => {
      loadBackendData();
    };

    window.addEventListener('agentpay:purchase_completed', handleUpdate);
    window.addEventListener('agentpay:session_reset', handleUpdate);

    return () => {
      window.removeEventListener('agentpay:purchase_completed', handleUpdate);
      window.removeEventListener('agentpay:session_reset', handleUpdate);
    };
  }, []);

  const handleConfirmReset = () => {
    resetSession();
    setShowResetConfirm(false);
    loadBackendData();
    refreshBlockchain();
  };

  // ── Compute Dashboard Metrics (Live Session Metrics) ───────────
  const totalBudgetEth = budget ? parseFloat(budget.budgetEth) : 0.05;
  const sessionSpentEth = transactions.reduce((acc, t) => t.delivery_status === 'Delivered' ? acc + (t.amount || 0) : acc, 0);
  const sessionRemainingEth = Math.max(0, totalBudgetEth - sessionSpentEth);
  const sessionRemainingPercent = totalBudgetEth > 0 ? Math.round((sessionRemainingEth / totalBudgetEth) * 100) : 100;
  const sessionProgressPercent = totalBudgetEth > 0 ? Math.round((sessionSpentEth / totalBudgetEth) * 100) : 0;

  const totalTxCount = transactions.length;
  const successfulTxCount = transactions.filter(t => t.delivery_status === 'Delivered').length;
  const blockedTxCount = transactions.filter(t => t.delivery_status === 'Blocked').length;

  // Chart data from transactions or fallback
  const spendingChartData = useMemo(() => {
    if (transactions.length === 0) return mockSpendingOverview;
    // Group transactions by date
    const dateMap = {};
    transactions.forEach(tx => {
      const d = tx.date || 'Today';
      if (!dateMap[d]) dateMap[d] = { date: d, successful: 0, blocked: 0 };
      if (tx.delivery_status === 'Delivered') dateMap[d].successful += (tx.amount || 1);
      if (tx.delivery_status === 'Blocked') dateMap[d].blocked += (tx.amount || 1);
    });
    return Object.values(dateMap).slice(-7);
  }, [transactions]);

  return (
    <div className="space-y-6 pt-4 animate-fadeIn select-none">
      {/* Welcome Banner Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-gray-500 tracking-wider uppercase">
              WELCOME BACK,
            </span>
            {budget ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3E8C5A] animate-pulse"></span>
                <span>Sepolia Live Contract</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
                <span>⚡ Offline / Demo Fallback Mode</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-[#343434] tracking-tight mt-0.5">
            Good morning, {user?.name || 'Alex'} 👋
          </h1>
          <p className="text-xs text-gray-600 font-medium mt-1">
            Your AI agent is running smoothly against contract address <code className="font-mono text-[#2563EB]">0x220b...99B6</code>.
          </p>
        </div>

        {/* Right Callout Quote & Reset Control */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-3.5 py-1.5 bg-white hover:bg-gray-50 border border-[#E9D8CC] hover:border-[#FAD2C0] text-[#343434] text-xs font-bold rounded-2xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer shrink-0"
            title="Reset current dashboard session (preserves Audit Trail)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#d97d54]" />
            <span>Reset Session</span>
          </button>
          <div className="text-right hidden md:block">
            <p className="text-xs font-serif italic text-gray-600 bg-white/60 backdrop-blur-xs px-3 py-1 rounded-full border border-[#E9D8CC]/60">
              &ldquo;Autonomous agents. Accountable spending.&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards Row — LIVE CONTRACT & SESSION METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          type="budget"
          title="Total Budget"
          value={`${totalBudgetEth} ETH`}
          subtitle="Set on-chain by Sepolia Contract"
        />
        <StatCard
          type="spent"
          title="Total Spent"
          value={`${sessionSpentEth.toFixed(4)} ETH`}
          progress={sessionProgressPercent}
        />
        <StatCard
          type="remaining"
          title="Remaining"
          value={`${sessionRemainingEth.toFixed(4)} ETH`}
          badgeText={`${sessionRemainingPercent}% left`}
        />
        <StatCard
          type="transactions"
          title="Transactions"
          value={totalTxCount}
          subtitle={`${successfulTxCount} successful  ${blockedTxCount} blocked`}
        />
      </div>

      {/* Row 2: Charts (Spending Overview 2/3 + Budget Usage 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2">
          <SpendingChart data={spendingChartData} />
        </div>
        <div className="lg:col-span-1">
          <BudgetUsageChart 
            spent={sessionSpentEth} 
            remaining={sessionRemainingEth}
            total={totalBudgetEth}
          />
        </div>
      </div>

      {/* Row 3: Activity Table & Top Providers (Activity 2/3 + Providers 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2">
          <RecentActivityTable 
            transactions={transactions.slice(0, 4)} 
            onSelectTransaction={(tx) => setSelectedTx(tx)}
            onViewAll={() => navigate('/payments')}
          />
        </div>
        
        <div className="lg:col-span-1 flex flex-col space-y-4 justify-between">
          <TopProvidersList 
            providers={backendProviders.slice(0, 3)}
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

      {/* Reset Session Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn select-none">
          <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4 text-[#343434]">
            <div className="flex items-center space-x-3 text-[#d97d54]">
              <div className="w-10 h-10 rounded-2xl bg-[#FAD2C0]/40 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-[#d97d54]" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#343434]">Reset current dashboard session?</h3>
                <p className="text-xs text-gray-500 font-medium">Session Reset Confirmation</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Current transactions and spending display will be cleared for Dashboard and Payments. <strong>Audit history and smart contract records will be preserved.</strong>
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-white border border-[#E9D8CC] text-[#343434] text-xs font-bold rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 bg-[#d97d54] hover:bg-[#c66c45] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Reset Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
