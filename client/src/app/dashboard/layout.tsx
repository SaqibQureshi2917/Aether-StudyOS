'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar/Sidebar';
import Header from '@/components/layout/Header/Header';
import PageSkeleton from '@/components/layout/PageSkeleton/PageSkeleton';
import { useAuth } from '@/context/AuthContext';
import styles from './dashboard.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { authStatus, user, authError, refreshUser } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setIsMobileSidebarOpen(false), []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/');
    else if (authStatus === 'authenticated' && user && !user.isOnboarded) router.replace('/onboarding');
  }, [authStatus, router, user]);

  if (authStatus !== 'authenticated' || !user?.isOnboarded) {
    if (authStatus === 'error') {
      return (
        <div role="alert">
          <p>{authError}</p>
          <button type="button" onClick={() => void refreshUser()}>Retry</button>
        </div>
      );
    }
    return <PageSkeleton kind="collection" />;
  }

  return (
    <div className={styles.dashboardLayout}>
      <Header
        onToggleSidebar={() => setIsMobileSidebarOpen((open) => !open)}
        onToggleCollapse={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        isSidebarCollapsed={isSidebarCollapsed}
        isMobileSidebarOpen={isMobileSidebarOpen}
      />
      <div className={styles.dashboardBody}>
        <Sidebar
          onOpenSetupModal={() => {}}
          isSetupCompleted
          isCollapsed={isSidebarCollapsed}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={closeMobileSidebar}
        />
        <div className={styles.layoutContentWrapper}>{children}</div>
      </div>
    </div>
  );
}
