import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Mail, 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Bell, 
  Sun, 
  Globe, 
  CreditCard, 
  ArrowRight, 
  Check, 
  AlertTriangle, 
  LogOut, 
  Edit3, 
  Save, 
  X,
  Laptop
} from 'lucide-react';
import { mockSettings } from '../data/mockData';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Profile Edit Local State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || mockSettings.profile.name);
  const [savedNotice, setSavedNotice] = useState(null);

  // Notification Preferences State
  const [notifications, setNotifications] = useState(mockSettings.notificationPreferences);
  const [notificationToast, setNotificationToast] = useState(false);

  // Modal State for Security & Danger Zone Demo Controls
  const [activeModal, setActiveModal] = useState(null); // 'password' | '2fa' | 'delete' | null

  // Generate Initials Avatar
  const getInitials = (nameStr) => {
    if (!nameStr) return 'A';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  const handleProfileSave = (e) => {
    e.preventDefault();
    setIsEditingProfile(false);
    setSavedNotice('Profile updated locally (Mock State)');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleToggleNotification = (key) => {
    setNotifications(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      setNotificationToast(true);
      setTimeout(() => setNotificationToast(false), 2500);
      return updated;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="space-y-8 animate-fadeIn select-none">
      
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#343434] tracking-tight">Settings</h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Manage your AgentPay profile, preferences, and account configuration.
          </p>
        </div>
      </div>

      {/* Global Saved Toast Feedback */}
      {savedNotice && (
        <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] text-[#3E8C5A] rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <span>✓ {savedNotice}</span>
          <button onClick={() => setSavedNotice(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Grid Layout: 2 Columns for Desktop, 1 for Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Profile, Security, Appearance */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* 2. PROFILE CARD */}
          <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-5">
            <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-4">
              <h2 className="text-base font-black text-[#343434] flex items-center space-x-2">
                <User className="w-5 h-5 text-[#2563EB]" />
                <span>User Profile</span>
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                {mockSettings.profile.status} Account
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Initials Avatar */}
              <div className="w-20 h-20 rounded-full bg-[#60A5FA] text-white flex items-center justify-center font-extrabold text-2xl shrink-0 shadow-md border-2 border-white">
                {getInitials(profileName)}
              </div>

              {/* Profile Details / Edit Form */}
              <div className="flex-1 w-full space-y-4 text-center sm:text-left">
                {!isEditingProfile ? (
                  <>
                    <div className="space-y-1">
                      <div className="flex items-center justify-center sm:justify-start space-x-2">
                        <h3 className="text-lg font-black text-[#343434]">{profileName}</h3>
                        <span className="text-[10px] font-bold bg-[#FAD2C0]/40 text-[#d97d54] px-2 py-0.5 rounded-full border border-[#FAD2C0]">
                          {mockSettings.profile.role}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium">{user?.email || mockSettings.profile.email}</p>
                    </div>

                    <div className="pt-2 flex justify-center sm:justify-start">
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        className="px-4 py-2 bg-white hover:bg-[#FDF8F5] border border-[#E9D8CC] rounded-2xl text-xs font-bold text-[#343434] shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-gray-500" />
                        <span>Edit Profile</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleProfileSave} className="space-y-3 max-w-sm">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#E9D8CC] rounded-xl text-xs font-bold text-[#343434] focus:outline-none focus:border-[#FAD2C0]"
                        required
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1 transition-all cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Name</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(false)}
                        className="px-3.5 py-1.5 bg-white border border-[#E9D8CC] text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* 3. ACCOUNT SECURITY CARD */}
          <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-5">
            <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-4">
              <h2 className="text-base font-black text-[#343434] flex items-center space-x-2">
                <Lock className="w-5 h-5 text-[#3E8C5A]" />
                <span>Account Security</span>
              </h2>
              <span className="text-[10px] font-mono text-gray-400">Auth Tier: Standard</span>
            </div>

            <div className="space-y-4 text-xs">
              {/* Password row */}
              <div className="bg-white p-4 rounded-2xl border border-[#E9D8CC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-[#343434] block">Account Password</span>
                  <span className="text-[11px] text-gray-500 font-medium">Last updated 3 days ago</span>
                </div>
                <button
                  onClick={() => setActiveModal('password')}
                  className="px-3.5 py-2 bg-white hover:bg-[#FDF8F5] border border-[#E9D8CC] rounded-2xl font-bold text-[#343434] transition-all shadow-xs cursor-pointer text-center"
                >
                  Change Password
                </button>
              </div>

              {/* 2FA row */}
              <div className="bg-white p-4 rounded-2xl border border-[#E9D8CC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-[#343434] block">Two-Factor Authentication (2FA)</span>
                  <span className="text-[11px] text-amber-600 font-bold">Not configured</span>
                </div>
                <button
                  onClick={() => setActiveModal('2fa')}
                  className="px-3.5 py-2 bg-[#E3F2FD] hover:bg-[#BBDEFB] text-[#2563EB] border border-[#BBDEFB] rounded-2xl font-bold transition-all shadow-xs cursor-pointer text-center"
                >
                  Enable 2FA
                </button>
              </div>
            </div>
          </div>

          {/* 4. APPEARANCE CARD */}
          <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-4">
              <h2 className="text-base font-black text-[#343434] flex items-center space-x-2">
                <Sun className="w-5 h-5 text-[#d97d54]" />
                <span>Appearance</span>
              </h2>
              <span className="text-[10px] font-bold bg-[#FAD2C0]/40 text-[#d97d54] px-2.5 py-0.5 rounded-full border border-[#FAD2C0]">
                Active Theme
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E9D8CC] flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[#343434] block">Interface Theme</span>
                <span className="text-[11px] text-gray-500">AgentPay visual system defaults to Light mode.</span>
              </div>
              <div className="flex items-center space-x-2 bg-[#FFF9F5] p-1 rounded-2xl border border-[#E9D8CC]">
                <span className="px-3 py-1 bg-[#FAD2C0] text-[#343434] font-extrabold rounded-xl text-xs shadow-xs">
                  Light
                </span>
                <span className="px-3 py-1 text-gray-400 font-semibold text-xs cursor-not-allowed opacity-60">
                  Dark (Disabled)
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Spending Rules, Notifications, Connection, Danger Zone */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* 5. AGENT & SPENDING SETTINGS */}
          <div className="bg-[#FFF9F5] border-2 border-[#FAD2C0] rounded-3xl p-6 shadow-card space-y-5">
            <div className="flex items-center justify-between border-b border-[#FAD2C0] pb-4">
              <h2 className="text-base font-black text-[#343434] flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-[#3E8C5A]" />
                <span>Agent & Spending</span>
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E8F5E9] text-[#3E8C5A] border border-[#C8E6C9]">
                Protected
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-[#E9D8CC] text-xs">
              <div>
                <span className="text-[10px] text-gray-400 block font-medium">Hard Limit</span>
                <span className="font-extrabold text-sm text-[#343434]">₹500</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-medium">Current Spend</span>
                <span className="font-bold text-sm text-[#55705C]">₹320</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-medium">Remaining</span>
                <span className="font-extrabold text-sm text-[#3E8C5A]">₹180</span>
              </div>
            </div>

            <div className="p-3.5 bg-white border border-[#E9D8CC] rounded-2xl text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-extrabold text-gray-700">
                <span>Enforcement Layer:</span>
                <span className="font-mono text-[#3E8C5A]">Smart Contract</span>
              </div>
              <p className="text-gray-500 text-[11px] leading-relaxed pt-1">
                Spending limits are enforced outside the agent by the smart contract and cannot be edited locally from the frontend.
              </p>
            </div>

            <button
              onClick={() => navigate('/security')}
              className="w-full py-3 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] font-bold text-xs rounded-2xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <span>View Security Center</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 6. NOTIFICATIONS PREFERENCES */}
          <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-5">
            <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-4">
              <h2 className="text-base font-black text-[#343434] flex items-center space-x-2">
                <Bell className="w-5 h-5 text-[#2563EB]" />
                <span>Notifications</span>
              </h2>
              {notificationToast && (
                <span className="text-[10px] font-bold text-[#3E8C5A] bg-[#E8F5E9] px-2 py-0.5 rounded-full animate-fadeIn">
                  Preferences saved
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              {[
                { key: 'paymentConfirmations', label: 'Payment confirmations' },
                { key: 'paymentBlockedAlerts', label: 'Payment blocked alerts' },
                { key: 'deliveryNotifications', label: 'Delivery notifications' },
                { key: 'securityAlerts', label: 'Security alerts' }
              ].map((item) => (
                <div key={item.key} className="bg-white p-3.5 rounded-2xl border border-[#E9D8CC] flex items-center justify-between">
                  <span className="font-bold text-[#343434]">{item.label}</span>
                  <button
                    onClick={() => handleToggleNotification(item.key)}
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 relative cursor-pointer ${
                      notifications[item.key] ? 'bg-[#3E8C5A]' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      notifications[item.key] ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 7. CONNECTION & ENVIRONMENT CONFIGURATION */}
          <div className="bg-[#FFF9F5] border border-[#E9D8CC] rounded-3xl p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-[#E9D8CC] pb-4">
              <h2 className="text-base font-black text-[#343434] flex items-center space-x-2">
                <Globe className="w-5 h-5 text-gray-600" />
                <span>Connection & Environment</span>
              </h2>
              <span className="text-[10px] font-mono text-gray-400">Render Deployment Ready</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="bg-white p-2.5 rounded-xl border border-[#E9D8CC] flex justify-between">
                <span className="text-gray-500 font-sans font-medium">Frontend</span>
                <span className="font-bold text-[#343434]">{mockSettings.connectionStatus.frontend}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#E9D8CC] flex justify-between">
                <span className="text-gray-500 font-sans font-medium">Environment</span>
                <span className="font-bold text-blue-600">{mockSettings.connectionStatus.environment}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#E9D8CC] flex justify-between">
                <span className="text-gray-500 font-sans font-medium">API Layer</span>
                <span className="font-bold text-amber-600">{mockSettings.connectionStatus.api}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#E9D8CC] flex justify-between">
                <span className="text-gray-500 font-sans font-medium">Blockchain</span>
                <span className="font-bold text-[#55705C]">{mockSettings.connectionStatus.blockchain}</span>
              </div>
            </div>
          </div>

          {/* 8. DANGER ZONE */}
          <div className="bg-[#FFF9F5] border-2 border-[#FFCDD2] rounded-3xl p-6 shadow-card space-y-4">
            <h2 className="text-base font-black text-[#C94C4C] flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-[#C94C4C]" />
              <span>Danger Zone</span>
            </h2>

            <div className="space-y-3">
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-[#FFEBEE] hover:bg-[#FFCDD2] text-[#C94C4C] border border-[#FFCDD2] rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Account</span>
              </button>

              <button
                onClick={() => setActiveModal('delete')}
                className="w-full py-3 bg-white hover:bg-[#FFEBEE] text-gray-500 hover:text-[#C94C4C] border border-[#E9D8CC] hover:border-[#FFCDD2] rounded-2xl font-bold text-xs transition-all cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* DEMO CONFIRMATION MODAL */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-[#E9D8CC] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-black text-base text-[#343434]">
                {activeModal === 'password' && 'Change Password'}
                {activeModal === '2fa' && 'Enable Two-Factor Authentication'}
                {activeModal === 'delete' && 'Delete Account'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-4 bg-[#FDF8F5] border border-[#E9D8CC] rounded-2xl text-xs space-y-2">
              <span className="font-extrabold text-[#343434] block">Integration Demo Notice:</span>
              <p className="text-gray-600 leading-relaxed">
                This security feature will be connected to the authentication backend during integration.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-[#FAD2C0] hover:bg-[#f8bd9e] text-[#343434] font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
