import React, { useState } from 'react';
import { Search, Bell, ChevronDown, LogOut, User as UserIcon, Menu, Wallet, Unplug, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useBlockchain } from '../../context/BlockchainContext';
import { useNavigate } from 'react-router-dom';

/** Truncates an Ethereum address: 0x1234...ABCD */
function truncateAddress(addr) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Topbar({ pageTitle }) {
  const { user, logout } = useAuth();
  const { toggleMobile } = useSidebar();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);

  const {
    account,
    chainId,
    isConnected,
    isConnecting,
    isCorrectChain,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    expectedChainId,
  } = useBlockchain();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleConnectClick = async () => {
    setShowWalletDropdown(false);
    await connectWallet();
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setShowWalletDropdown(false);
  };

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

        {/* Right: Network Badge + Wallet + Notifications + Profile */}
        <div className="flex items-center space-x-2 shrink-0">

          {/* Network Status Badge */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-white/60 border border-[#E8C5B0] rounded-full text-xs font-semibold text-[#6B4226] shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Sepolia Connected</span>
          </div>

          {/* ── Connect Wallet / Connected Address Pill ── */}
          <div className="relative">
            {!isConnected ? (
              /* Disconnected — orange "Connect Wallet" button */
              <button
                id="connect-wallet-btn"
                onClick={handleConnectClick}
                disabled={isConnecting}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-[#D97B45] text-white rounded-full text-xs font-semibold hover:bg-[#C96A35] active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                title="Connect MetaMask wallet"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{isConnecting ? 'Connecting…' : 'Connect Wallet'}</span>
              </button>
            ) : (
              /* Connected — address pill (green = Sepolia, amber = wrong network) */
              <button
                id="wallet-address-btn"
                onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm cursor-pointer border ${
                  isCorrectChain
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                }`}
                title={isCorrectChain ? 'Wallet connected to Sepolia' : `Wrong network — Chain ID ${chainId}`}
              >
                {isCorrectChain
                  ? <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                }
                <span>{truncateAddress(account)}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            )}

            {/* Wallet Details Dropdown */}
            {showWalletDropdown && isConnected && (
              <div
                className="absolute right-0 mt-2 w-60 bg-white border border-[#E9D8CC] rounded-2xl shadow-xl py-2 z-50 animate-fadeIn text-xs"
                onClick={e => e.stopPropagation()}
              >
                <div className="px-4 py-2.5 border-b border-[#E9D8CC]">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Connected Wallet</p>
                  <p className="font-mono font-semibold text-[#343434] break-all text-[11px] leading-relaxed">{account}</p>
                </div>
                <div className="px-4 py-2.5 border-b border-[#E9D8CC]">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Network</p>
                  {isCorrectChain ? (
                    <p className="text-emerald-700 font-semibold">✓ Sepolia Testnet (Chain {chainId})</p>
                  ) : (
                    <div>
                      <p className="text-amber-600 font-semibold">⚠ Wrong Network (Chain {chainId})</p>
                      <button
                        onClick={() => { switchNetwork(); setShowWalletDropdown(false); }}
                        className="mt-1.5 text-[10px] text-[#D97B45] underline cursor-pointer hover:text-[#C96A35]"
                      >
                        Switch to Sepolia (Chain {expectedChainId})
                      </button>
                    </div>
                  )}
                </div>
                <button
                  id="disconnect-wallet-btn"
                  onClick={handleDisconnect}
                  className="w-full px-4 py-2.5 text-left text-[#C94C4C] hover:bg-[#FFEBEE] flex items-center space-x-2 cursor-pointer transition-colors"
                >
                  <Unplug className="w-3.5 h-3.5 text-[#C94C4C]" />
                  <span>Disconnect Wallet</span>
                </button>
              </div>
            )}
          </div>

          {/* Notifications */}
          <button className="p-2 bg-white/60 border border-[#E8C5B0] rounded-full text-[#8B5E4A] hover:bg-white/80 transition-colors relative shadow-xs cursor-pointer">
            <Bell className="w-4 h-4" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#FBCFB8]"></span>
          </button>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowDropdown(!showDropdown); setShowWalletDropdown(false); }}
              className="flex items-center space-x-2.5 p-1 pr-2 bg-white/60 border border-[#E8C5B0] rounded-full hover:border-[#D97B45] hover:bg-white/80 transition-colors shadow-xs cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-[#60A5FA] text-white flex items-center justify-center font-bold text-xs">
                {user?.avatar || 'A'}
              </div>
              <span className="hidden sm:block text-xs font-bold text-[#343434]">{user?.name || 'Alex'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {/* Profile Dropdown */}
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
