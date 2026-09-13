import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  ArrowUpDown, 
  CheckCircle2, 
  ShieldAlert, 
  Clock, 
  ExternalLink,
  Eye,
  RefreshCw
} from 'lucide-react';
import { useBlockchain } from '../context/BlockchainContext';
import { fetchAuditLogs, parseAuditLogsToTransactions, getSessionResetTime } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import TransactionModal from '../components/common/TransactionModal';

export default function Payments() {
  const [selectedTx, setSelectedTx] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('All');
  const [providerFilter, setProviderFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  // Live Blockchain & Backend State
  const { budget } = useBlockchain();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendLive, setIsBackendLive] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadTransactions = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchAuditLogs({ limit: 200 });
      if (res && Array.isArray(res.logs)) {
        const parsed = parseAuditLogsToTransactions(res.logs);
        const resetTime = getSessionResetTime();
        const sessionTxs = parsed.filter(tx => {
          const txTime = new Date(tx.rawLogs?.[0]?.timestamp || tx.timestamp || 0).getTime();
          return txTime >= resetTime;
        });
        setTransactions(sessionTxs);
        setIsBackendLive(true);
      } else {
        setTransactions([]);
        setIsBackendLive(false);
      }
    } catch (err) {
      console.warn('[Payments] Backend fetch failed:', err);
      setTransactions([]);
      setIsBackendLive(false);
      setErrorMessage(err.message || 'Could not connect to FastAPI backend on port 8000');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();

    const handleUpdate = () => {
      loadTransactions();
    };

    window.addEventListener('agentpay:purchase_completed', handleUpdate);
    window.addEventListener('agentpay:session_reset', handleUpdate);

    return () => {
      window.removeEventListener('agentpay:purchase_completed', handleUpdate);
      window.removeEventListener('agentpay:session_reset', handleUpdate);
    };
  }, []);

  // Calculate live stats
  const totalCount = transactions.length;
  const successfulCount = transactions.filter(t => t.delivery_status === 'Delivered').length;
  const blockedCount = transactions.filter(t => t.delivery_status === 'Blocked').length;
  const totalSpentFormatted = budget 
    ? `${budget.totalSpentEth} ETH` 
    : `0.00 ETH`;

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        const matchesSearch = 
          (tx.request_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (tx.service || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (tx.provider || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (tx.payment_tx || '').toLowerCase().includes(searchTerm.toLowerCase());

        let matchesStatus = true;
        if (statusFilter === 'Successful') matchesStatus = tx.delivery_status === 'Delivered';
        if (statusFilter === 'Blocked') matchesStatus = tx.delivery_status === 'Blocked';
        if (statusFilter === 'Pending') matchesStatus = tx.delivery_status === 'Processing';

        const matchesService = serviceFilter === 'All' || tx.service === serviceFilter;
        const matchesProvider = providerFilter === 'All' || tx.provider === providerFilter;

        return matchesSearch && matchesStatus && matchesService && matchesProvider;
      })
      .sort((a, b) => {
        if (sortBy === 'amount-high') return b.amount - a.amount;
        if (sortBy === 'amount-low') return a.amount - b.amount;
        if (sortBy === 'oldest') return (a.request_id || '').localeCompare(b.request_id || '');
        return (b.request_id || '').localeCompare(a.request_id || '');
      });
  }, [transactions, searchTerm, statusFilter, serviceFilter, providerFilter, sortBy]);

  return (
    <div className="space-y-6 animate-fadeIn select-none">
      {/* 1. Page Header & Summary Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-[#343434] tracking-tight">Payments</h1>
            {isBackendLive ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3E8C5A] animate-pulse"></span>
                <span>Live Audit Data</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
                <span>⚡ Backend Offline</span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Track every payment made by your autonomous agent on Sepolia in real time.
          </p>
        </div>

        <button
          onClick={loadTransactions}
          disabled={isLoading}
          className="px-3.5 py-2 bg-white border border-[#E9D8CC] hover:border-[#FAD2C0] text-[#343434] text-xs font-bold rounded-2xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Total Transactions
          </span>
          <div className="text-2xl font-black text-[#343434]">
            {totalCount}
          </div>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Successful Payments
          </span>
          <div className="text-2xl font-black text-[#3E8C5A] flex items-center space-x-1.5">
            <span>{successfulCount}</span>
            <CheckCircle2 className="w-4 h-4 text-[#3E8C5A]" />
          </div>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Blocked Payments
          </span>
          <div className="text-2xl font-black text-[#C94C4C] flex items-center space-x-1.5">
            <span>{blockedCount}</span>
            <ShieldAlert className="w-4 h-4 text-[#C94C4C]" />
          </div>
        </div>

        <div className="bg-[#FFF9F5] border border-[#E9D8CC] p-5 rounded-3xl shadow-card">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-gray-400 block mb-1">
            Total Spent
          </span>
          <div className="text-2xl font-black text-[#343434]">
            {totalSpentFormatted}
          </div>
        </div>
      </div>

      {/* 2. Controls Bar: Search, Filters & Sorting */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-5 shadow-card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          
          {/* Search Input (5 Cols) */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Request ID, Service, Provider, or Tx..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E9D8CC] rounded-2xl text-xs text-[#343434] placeholder-gray-400 focus:outline-none focus:border-[#FAD2C0] focus:ring-2 focus:ring-[#FAD2C0]/40 transition-all shadow-xs"
            />
          </div>

          {/* Status Filter (2 Cols) */}
          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2.5 px-3 bg-white border border-[#E9D8CC] rounded-2xl text-xs font-semibold text-[#343434] focus:outline-none focus:border-[#FAD2C0] transition-all shadow-xs cursor-pointer"
            >
              <option value="All">Status: All</option>
              <option value="Successful">Successful</option>
              <option value="Blocked">Blocked</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          {/* Service Filter (2 Cols) */}
          <div className="sm:col-span-2">
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full py-2.5 px-3 bg-white border border-[#E9D8CC] rounded-2xl text-xs font-semibold text-[#343434] focus:outline-none focus:border-[#FAD2C0] transition-all shadow-xs cursor-pointer"
            >
              <option value="All">Service: All</option>
              <option value="Translation">Translation</option>
              <option value="Storage">Storage</option>
              <option value="Compute">Compute</option>
            </select>
          </div>

          {/* Sort By Dropdown (3 Cols) */}
          <div className="sm:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full py-2.5 px-3 bg-white border border-[#E9D8CC] rounded-2xl text-xs font-semibold text-[#343434] focus:outline-none focus:border-[#FAD2C0] transition-all shadow-xs cursor-pointer"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="amount-high">Sort: Amount (High to Low)</option>
              <option value="amount-low">Sort: Amount (Low to High)</option>
            </select>
          </div>
        </div>

        {/* Filter Badges Bar */}
        {(searchTerm || statusFilter !== 'All' || serviceFilter !== 'All' || providerFilter !== 'All') && (
          <div className="flex items-center space-x-2 pt-2 border-t border-[#E9D8CC] text-xs">
            <span className="text-gray-400 text-[11px] font-semibold">Active Filters:</span>
            {searchTerm && (
              <span className="px-2.5 py-0.5 bg-[#E3F2FD] text-[#2563EB] rounded-full text-[11px] font-bold">
                Query: "{searchTerm}"
              </span>
            )}
            {statusFilter !== 'All' && (
              <span className="px-2.5 py-0.5 bg-[#FAD2C0]/50 text-[#343434] rounded-full text-[11px] font-bold">
                Status: {statusFilter}
              </span>
            )}
            {serviceFilter !== 'All' && (
              <span className="px-2.5 py-0.5 bg-[#E8F5E9] text-[#3E8C5A] rounded-full text-[11px] font-bold">
                Service: {serviceFilter}
              </span>
            )}
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
                setServiceFilter('All');
                setProviderFilter('All');
                setSortBy('newest');
              }}
              className="text-[11px] font-bold text-[#C94C4C] hover:underline ml-auto cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* 3. Transaction Table */}
      <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-[#343434]">Transaction History</h2>
          <span className="text-xs text-gray-500 font-medium">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400 space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto text-[#2563EB] animate-spin" />
            <p className="text-xs font-semibold">Loading transactions from audit trail...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E9D8CC] text-[11px] font-mono font-bold text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 px-3">Request ID</th>
                  <th className="pb-3 px-3">Service</th>
                  <th className="pb-3 px-3">Provider</th>
                  <th className="pb-3 px-3">Amount</th>
                  <th className="pb-3 px-3">Payment Status</th>
                  <th className="pb-3 px-3">Delivery Status</th>
                  <th className="pb-3 px-3">Time</th>
                  <th className="pb-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9D8CC]/50 text-xs">
                {filteredTransactions.map((tx) => {
                  const isBlocked = tx.delivery_status === 'Blocked';
                  return (
                    <tr 
                      key={tx.request_id}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-white/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-3 font-mono font-bold text-[#343434]">
                        #{tx.request_id}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-[#343434]">
                        {tx.service}
                      </td>
                      <td className="py-3.5 px-3 text-gray-600 font-medium">
                        {tx.provider}
                      </td>
                      <td className="py-3.5 px-3 font-extrabold text-[#343434]">
                        {tx.amountEth ? tx.amountEth : `₹${tx.amount.toFixed(2)}`}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isBlocked 
                            ? 'bg-[#FFEBEE] text-[#C94C4C] border border-[#FFCDD2]' 
                            : 'bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]'
                        }`}>
                          {isBlocked ? 'Blocked' : 'Successful'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusBadge status={tx.delivery_status} />
                      </td>
                      <td className="py-3.5 px-3 text-gray-500 text-[11px] font-mono">
                        {tx.timestamp}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTx(tx);
                          }}
                          className="px-3 py-1.5 bg-white border border-[#E9D8CC] group-hover:border-[#FAD2C0] group-hover:bg-[#FFF9F5] text-[#343434] font-bold text-[11px] rounded-xl transition-all inline-flex items-center space-x-1 shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-gray-500" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredTransactions.length === 0 && (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <CreditCard className="w-10 h-10 mx-auto text-gray-300" />
                <p className="text-xs font-semibold">No transactions match your current search/filters.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction Modal Detail Popup */}
      {selectedTx && (
        <TransactionModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
}
