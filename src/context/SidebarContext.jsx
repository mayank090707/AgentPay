import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

/**
 * SidebarProvider manages:
 *  - collapsed  : desktop icon-only mode
 *  - mobileOpen : mobile drawer visible
 */
export function SidebarProvider({ children }) {
  // On tablet (< 1024px) start collapsed; desktop starts expanded
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-collapse on resize to tablet, auto-expand on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        // Mobile: use drawer approach – keep collapsed true but control via mobileOpen
        setCollapsed(true);
        setMobileOpen(false);
      } else if (window.innerWidth < 1024) {
        // Tablet: collapsed icon-only
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapsed = () => setCollapsed(v => !v);
  const toggleMobile = () => setMobileOpen(v => !v);
  const closeMobile = () => setMobileOpen(false);

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed, mobileOpen, toggleMobile, closeMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
