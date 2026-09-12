import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { SidebarProvider } from '../../context/SidebarContext';
import TransactionStatusModal from '../common/TransactionStatusModal';
import appBg from '../../assets/app-bg.png';

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div
        className="flex h-screen overflow-hidden font-sans bg-cover bg-center bg-no-repeat relative"
        style={{ backgroundImage: `url(${appBg})` }}
      >
        {/* Sidebar (desktop sticky | mobile drawer) */}
        <Sidebar />

        {/* Main Content — flex-1 naturally fills remaining width */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
          <Topbar />

          {/* Route content */}
          <main className="px-6 md:px-8 pb-10 flex-1 relative z-10">
            <Outlet />
          </main>
        </div>

        {/* Global Transaction Lifecycle Modal */}
        <TransactionStatusModal />
      </div>
    </SidebarProvider>
  );
}
