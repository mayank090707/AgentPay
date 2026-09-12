import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  ChevronDown, 
  LogOut, 
  User as UserIcon, 
  Menu, 
  Wallet, 
  AlertTriangle, 
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useBlockchain } from '../../context/BlockchainContext';
import { useNavigate } from 'react-router-dom';

export default function Topbar({ pageTitle }) {
  const { user, logout } = useAuth();
  const { toggleMobile } = useSidebar();
  const {
    account,
    isConnected,
    isConnecting,
    isCorrectChain,
    isContractConfigured,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    blockExplorerUrl,
  } = useBlockchain();

  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const truncatedAccount = account 
    ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` 
    : '';

  return (
    <header
      className="px-4 md:px-8 py-4 border-b border-[#E8C5B0]/60 sticky top-0 z-30 shadow-sm"
      style={{ background: 'linear-gradient(160deg, #FFF0E8 0%, #FFE0CC 60%, #FBCFB8 100%)' }}
    >
      {/* Top Controls Row */}
      <div className="flex items-center justify-between gap-3 md:gap-4">

        {/* Mobile Hamburger — visible only on < md */}
        <button
          onClick={toggleMobile}
          className="md:hidden p-2 bg-white/60 border border-[#E8C5B0] rounded-full text-[#8B5E4A] hover:bg-white/80 transition-colors shadow-xs cursor-pointer shrink-0"
          title="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search services, transactions or providers..."
            className="w-full pl-10 pr-4 py-2 bg-white/60 border border-[#E8C5B0] rounded-full text-xs text-[#343434] placeholder-[#A8735A] focus:outline-none focus:border-[#D97B45] focus:ring-2 focus:ring-[#E8935A]/20 shadow-xs transition-all"
          />
        </div>

        {/* Network & Profile Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">

          {/* ── Wallet & Network Status ──────────────────────────────────── */}
          {!isConnected ? (
            /* Disconnected State: Clear CTA to connect wallet */
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/80 hover:bg-white border border-[#E8C5B0] rounded-full text-xs font-bold text-[#6B4226] hover:text-[#343434] transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Wallet className="w-3.5 h-3.5 text-[#D97B45]" />
              <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>
          ) : !isCorrectChain ? (
            /* Wrong Network State: Clear warning CTA to switch to Sepolia */
            <button
              onClick={switchNetwork}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#FFF3E0] hover:bg-[#FFE0B2] border border-[#FFB74D] rounded-full text-xs font-bold text-[#B78103] transition-all shadow-xs cursor-pointer animate-pulse"
              title="Click to switch your wallet to Ethereum Sepolia Testnet"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="hidden sm:inline">Wrong Network (Switch to Sepolia)</span>
              <span className="sm:hidden">Switch Sepolia</span>
            </button>
          ) : (
            /* Connected & on Sepolia */
            <div className="relative">
              <button
                onClick={() => setShowWalletMenu(!showWalletMenu)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-white/80 hover:bg-white border border-[#C8E6C9] rounded-full text-xs font-semibold text-[#2E7D32] shadow-xs cursor-pointer transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-mono text-[11px]">{truncatedAccount}</span>
                <span className="hidden md:inline text-[10px] px-1.5 py-0.2 bg-[#E8F5E9] text-[#2E7D32] rounded font-bold">
                  Sepolia
                </span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>

              {/* Wallet Actions Dropdown */}
              {showWalletMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E9D8CC] rounded-2xl shadow-xl py-2 z-50 animate-fadeIn text-xs">
                  <div className="px-4 py-2 border-b border-[#E9D8CC]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      Connected Wallet
                    </span>
                    <p className="font-mono text-xs font-bold text-[#343434] truncate mt-0.5" title={account}>
                      {account}
                    </p>
                    <div className="flex items-center space-x-1 mt-1 text-[11px] text-[#2E7D32] font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-[#2E7D32]" />
                      <span>Sepolia Testnet (11155111)</span>
                    </div>
                  </div>

                  <a
                    href={`${blockExplorerUrl}/address/${account}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-[#FFF9F5] flex items-center justify-between cursor-pointer"
                  >
                    <span>View on Etherscan</span>
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                  </a>

                  <button
                    onClick={() => {
                      disconnectWallet();
                      setShowWalletMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-[#C94C4C] hover:bg-[#FFEBEE] flex items-center space-x-2 cursor-pointer border-t border-[#E9D8CC]"
                  >
                    <LogOut className="w-3 h-3 text-[#C94C4C]" />
                    <span>Disconnect Wallet</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Contract Unconfigured Warning Badge (Only when contract address is missing) */}
          {!isContractConfigured && (
            <div 
              className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 bg-[#FFF3E0] border border-[#FFE082] rounded-full text-[10px] font-bold text-amber-800 shadow-xs"
              title="VITE_CONTRACT_ADDRESS is not set in .env. Live Sepolia contract queries are in demo mode."
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Contract Unconfigured</span>
            </div>
          )}

          {/* Notifications */}
          <button className="p-2 bg-white/60 border border-[#E8C5B0] rounded-full text-[#8B5E4A] hover:bg-white/80 transition-colors relative shadow-xs cursor-pointer">
            <Bell className="w-4 h-4" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#FBCFB8]"></span>
          </button>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2.5 p-1 pr-2 bg-white/60 border border-[#E8C5B0] rounded-full hover:border-[#D97B45] hover:bg-white/80 transition-colors shadow-xs cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-[#60A5FA] text-white flex items-center justify-center font-bold text-xs">
                {user?.avatar || 'A'}
              </div>
              <span className="hidden sm:block text-xs font-bold text-[#343434]">{user?.name || 'Alex'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-[#E9D8CC] rounded-2xl shadow-lg py-2 z-50 animate-fadeIn text-xs">
                <div className="px-4 py-2 border-b border-[#E9D8CC]">
                  <p className="font-bold text-[#343434]">{user?.name || 'Alex'}</p>
                  <p className="text-gray-400 text-[11px] truncate">{user?.email || 'alex@agentpay.io'}</p>
                </div>
                <button
                  onClick={() => { setShowDropdown(false); navigate('/settings'); }}
                  className="w-full px-4 py-2.5 text-left text-gray-700 hover:bg-[#FFF9F5] flex items-center space-x-2 cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span>Account Settings</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-[#C94C4C] hover:bg-[#FFEBEE] flex items-center space-x-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-[#C94C4C]" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
