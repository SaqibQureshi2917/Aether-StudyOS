'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FiHome, 
  FiMessageSquare, 
  FiCalendar, 
  FiSettings, 
  FiUploadCloud, 
  FiSliders, 
  FiMenu, 
  FiX 
} from 'react-icons/fi';
import styles from './Sidebar.module.css';

interface SidebarProps {
  onOpenSetupModal: () => void;
}

export default function Sidebar({ onOpenSetupModal }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Route change hone par mobile drawer automatically close ho jaye
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Mobile menu open hone par background scroll lock
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileOpen]);

  const navItems = [
    { label: 'Overview', href: '/dashboard', icon: <FiHome /> },
    { label: 'AI Study Tutor', href: '/dashboard/chat', icon: <FiMessageSquare /> },
    { label: 'Semester Planner', href: '/dashboard/planner', icon: <FiCalendar /> },
    { label: 'Settings', href: '/dashboard/settings', icon: <FiSettings /> },
  ];

  return (
    <>
      {/* Mobile Top Header (Visible only on screens <= 768px) */}
      <div className={styles.mobileHeader}>
        <Link href="/dashboard" className={styles.brandLogo}>
          Aether <span className={styles.betaBadge}>StudyOS</span>
        </Link>
        <button 
          type="button" 
          className={styles.hamburgerBtn}
          onClick={() => setIsMobileOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
        >
          {isMobileOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>

      {/* Backdrop Overlay for Mobile */}
      {isMobileOpen && (
        <div 
          className={styles.mobileBackdrop} 
          onClick={() => setIsMobileOpen(false)} 
        />
      )}

      {/* Main Sidebar Drawer */}
      <aside className={`${styles.sidebar} ${isMobileOpen ? styles.mobileOpen : ''}`}>
        
        {/* Brand Container & Mobile Close Trigger */}
        <div className={styles.brandContainer}>
          <Link href="/dashboard" className={styles.brandLogo}>
            Aether <span className={styles.betaBadge}>StudyOS</span>
          </Link>
          <button 
            type="button" 
            className={styles.closeDrawerBtn} 
            onClick={() => setIsMobileOpen(false)}
          >
            <FiX />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className={styles.navMenu}>
          <span className={styles.menuTitle}>Menu</span>
          {navItems.map((item, idx) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={idx}
                href={item.href}
                className={isActive ? styles.activeNavLink : styles.navLink}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Course Setup Trigger Box */}
        <div className={styles.setupCard}>
          <div className={styles.setupHeader}>
            <FiUploadCloud className={styles.setupIcon} />
            <h4>Course Setup</h4>
          </div>
          <p className={styles.setupText}>
            Upload course outlines to activate your source-grounded AI Tutor.
          </p>
          <button 
            type="button" 
            onClick={() => {
              setIsMobileOpen(false);
              onOpenSetupModal();
            }} 
            className={styles.setupBtn}
          >
            <FiSliders /> Setup Workspace
          </button>
        </div>

      </aside>
    </>
  );
}