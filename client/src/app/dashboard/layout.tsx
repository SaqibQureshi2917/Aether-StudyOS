'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar/Sidebar';
import styles from './dashboard.module.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  return (
    <div className={styles.dashboardLayout}>
      <Sidebar 
        onOpenSetupModal={() => setIsSetupOpen(true)} 
        isSetupCompleted={false}
      />
      <div className={styles.layoutContentWrapper}>
        {children}
      </div>
    </div>
  );
}