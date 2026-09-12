import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import AgentPayLogo from '../common/AgentPayLogo';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import {
  LayoutDashboard,
  Bot,
  CreditCard,
  Users,
  FileCheck2,
  ShieldCheck,
  Settings,
  User,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard',    path: '/dashboard', icon: LayoutDashboard },
  { name: 'AI Agent',     path: '/agent',     icon: Bot             },
  { name: 'Payments',     path: '/payments',  icon: CreditCard      },
  { name: 'Providers',    path: '/providers', icon: Users           },
  { name: 'Audit Trail',  path: '/audit',     icon: FileCheck2      },
  { name: 'Security Demo',path: '/security',  icon: ShieldCheck     },
  { name: 'Settings',     path: '/settings',  icon: Settings        },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebar();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    closeMobile();
  };

  /* ─── shared JSX core (used by both desktop + mobile) ─── */
  const SidebarContent = ({ isMobile = false }) => (
    <aside
      className={[
        // Warm peach gradient background
        'border-r border-[#E8C5B0]',
        // Always fill parent width — width is controlled by the wrapper div
        'w-full h-full flex flex-col justify-between select-none overflow-hidden relative',
        // Sticky only on desktop (mobile is handled by the fixed wrapper)
        !isMobile && 'sticky top-0',
      ].join(' ')}
      style={{ background: 'linear-gradient(160deg, #FFF0E8 0%, #FFE0CC 40%, #FBCFB8 75%, #F5C0A5 100%)' }}
    >
      {/* ── Decorative Botanical Background Illustration ── */}
      <div className="absolute bottom-0 right-0 w-40 h-56 pointer-events-none select-none opacity-30 overflow-hidden">
        <svg viewBox="0 0 160 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Main large leaf — bottom right */}
          <path d="M140 220 C100 180 60 160 80 100 C90 70 130 60 150 90 C170 120 160 180 140 220Z" fill="#E8935A" />
          {/* Secondary leaf — middle right */}
          <path d="M155 160 C130 140 110 110 130 80 C140 60 165 70 160 100 C155 125 158 145 155 160Z" fill="#D97B45" />
          {/* Small accent leaf — top right */}
          <path d="M160 90 C145 75 135 55 148 40 C155 30 168 38 165 55 C162 68 162 80 160 90Z" fill="#C96C3A" />
          {/* Stem curve */}
          <path d="M140 220 C135 190 128 160 132 120 C136 90 148 70 148 40" stroke="#C96C3A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Small leaf sprout left */}
          <path d="M80 130 C60 120 45 100 55 80 C60 68 75 72 78 88 C80 100 80 118 80 130Z" fill="#E8935A" />
          {/* Tiny accent dot clusters */}
          <circle cx="105" cy="108" r="3" fill="#D97B45" />
          <circle cx="115" cy="118" r="2" fill="#C96C3A" />
          <circle cx="98" cy="122" r="2.5" fill="#E8935A" />
        </svg>
      </div>
      {/* ── TOP: Logo + Toggle ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Logo row */}
        <div
          className={[
            'flex items-center border-b border-[#E8C5B0]/50',
            collapsed && !isMobile
              ? 'justify-center px-2 py-4'
              : 'justify-between px-5 py-4',
          ].join(' ')}
        >
          {/* Logo — hide when collapsed on desktop */}
          <div
            className={[
              'transition-all duration-300 overflow-hidden',
              collapsed && !isMobile ? 'w-0 opacity-0' : 'w-auto opacity-100',
            ].join(' ')}
          >
            <AgentPayLogo size="sm" showTagline={!collapsed || isMobile} />
          </div>

          {/* Toggle button */}
          <button
            onClick={isMobile ? closeMobile : toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={[
              'p-1.5 rounded-xl text-[#8B5E4A] hover:text-[#343434] hover:bg-white/60',
              'border border-transparent hover:border-[#E8C5B0]',
              'transition-all duration-200 cursor-pointer shrink-0',
            ].join(' ')}
          >
            {isMobile ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav
          className={[
            'flex flex-col gap-1 mt-3 flex-1',
            collapsed && !isMobile ? 'px-2' : 'px-3',
          ].join(' ')}
        >
          {navItems.map(({ name, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={isMobile ? closeMobile : undefined}
              title={collapsed && !isMobile ? name : undefined}
              className={({ isActive }) =>
                [
                  'group flex items-center rounded-2xl text-sm font-semibold',
                  'transition-all duration-200 relative',
                  collapsed && !isMobile
                    ? 'justify-center px-0 py-3'
                    : 'space-x-3 px-4 py-3',
                  isActive
                    ? 'bg-white/90 text-[#343434] shadow-sm font-extrabold border border-[#E8C5B0]/60'
                    : 'text-[#6B4226] hover:bg-white/50 hover:text-[#343434]',
                ].join(' ')
              }
            >
              {/* Icon */}
              <Icon className="w-4 h-4 shrink-0" />

              {/* Label */}
              <span
                className={[
                  'whitespace-nowrap transition-all duration-300 overflow-hidden',
                  collapsed && !isMobile
                    ? 'w-0 opacity-0 ml-0'
                    : 'w-auto opacity-100',
                ].join(' ')}
              >
                {name}
              </span>

              {/* Tooltip (desktop collapsed only) */}
              {collapsed && !isMobile && (
                <span
                  className={[
                    'absolute left-full ml-3 px-2.5 py-1.5 rounded-xl',
                    'bg-[#343434] text-white text-xs font-semibold whitespace-nowrap',
                    'opacity-0 group-hover:opacity-100 pointer-events-none',
                    'transition-opacity duration-200 z-50 shadow-lg',
                  ].join(' ')}
                >
                  {name}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* ── BOTTOM: Profile + Logout ── */}
      <div
        className={[
          'border-t border-[#E8C5B0]/70 bg-[#F5C0A5]/20 backdrop-blur-xs',
          'relative z-10 shrink-0 space-y-1',
          collapsed && !isMobile ? 'p-2' : 'p-4',
        ].join(' ')}
      >
        {/* Profile button */}
        <button
          onClick={() => { navigate('/settings'); if (isMobile) closeMobile(); }}
          title={collapsed && !isMobile ? (user?.name || 'Alex') : undefined}
          className={[
            'w-full flex items-center rounded-2xl hover:bg-white/80 border border-transparent',
            'hover:border-[#E9D8CC] transition-all text-left cursor-pointer group relative',
            collapsed && !isMobile ? 'justify-center p-2' : 'justify-between p-2.5',
          ].join(' ')}
        >
          <div className={['flex items-center min-w-0', collapsed && !isMobile ? '' : 'space-x-3'].join(' ')}>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#60A5FA] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {user?.avatar || 'A'}
            </div>

            {/* Name + email */}
            <div
              className={[
                'transition-all duration-300 overflow-hidden text-left',
                collapsed && !isMobile ? 'w-0 opacity-0' : 'w-auto opacity-100',
              ].join(' ')}
            >
              <p className="text-xs font-bold text-[#343434] truncate">{user?.name || 'Alex'}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email || 'alex@agentpay.io'}</p>
            </div>
          </div>

          {/* Profile icon (expanded only) */}
          {(!collapsed || isMobile) && <User className="w-4 h-4 text-gray-400 shrink-0 ml-1" />}

          {/* Tooltip (desktop collapsed) */}
          {collapsed && !isMobile && (
            <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-xl bg-[#343434] text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-lg">
              {user?.name || 'Alex'}
            </span>
          )}
        </button>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          title={collapsed && !isMobile ? 'Logout' : undefined}
          className={[
            'w-full flex items-center rounded-2xl text-xs font-bold text-[#C94C4C]',
            'hover:bg-[#FFEBEE] transition-all cursor-pointer group relative',
            collapsed && !isMobile ? 'justify-center p-2' : 'space-x-3 px-4 py-2.5',
          ].join(' ')}
        >
          <LogOut className="w-4 h-4 shrink-0 text-[#C94C4C]" />

          <span
            className={[
              'transition-all duration-300 overflow-hidden whitespace-nowrap',
              collapsed && !isMobile ? 'w-0 opacity-0' : 'w-auto opacity-100',
            ].join(' ')}
          >
            Logout
          </span>

          {/* Tooltip (desktop collapsed) */}
          {collapsed && !isMobile && (
            <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-xl bg-[#343434] text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-lg">
              Logout
            </span>
          )}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Desktop Sidebar ── width transition happens HERE (the actual flex item) */}
      <div
        className={[
          'hidden md:block shrink-0 h-screen sticky top-0',
          'transition-[width] duration-300 ease-in-out overflow-hidden',
          collapsed ? 'w-20' : 'w-[260px]',
        ].join(' ')}
      >
        <SidebarContent isMobile={false} />
      </div>

      {/* ── Mobile Drawer ── */}
      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={closeMobile}
        />
      )}
      {/* Drawer */}
      <div
        className={[
          'fixed top-0 left-0 h-full z-50 md:hidden',
          'transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarContent isMobile={true} />
      </div>
    </>
  );
}
