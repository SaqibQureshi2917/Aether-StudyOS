'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiUser, FiSettings, FiLogOut, FiChevronDown, FiChevronLeft, FiChevronRight, FiMenu, FiX } from 'react-icons/fi';
import ThemeToggler from '@/components/features/ThemeToggler/ThemeToggler';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/apiClient';
import styles from './Header.module.css';

interface HeaderProps {
  onToggleSidebar: () => void;
  onToggleCollapse: () => void;
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
}

export default function Header({ onToggleSidebar, onToggleCollapse, isSidebarCollapsed, isMobileSidebarOpen }: HeaderProps) {
  const router = useRouter();
  const { user, clearAuthentication } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const profileWrapperRef = useRef<HTMLDivElement>(null);
  const userData = {
    fullName: user?.fullName || 'Student',
    major: user?.major || '',
    semester: user?.currentSemester || '',
  };

  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileWrapperRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await apiRequest('/auth/logout', 'POST');
    } catch {
      // Clear local state even when the server has already expired the session.
    } finally {
      clearAuthentication();
      router.replace('/');
    }
  };

  const semesterInfo = userData.major && userData.semester
    ? `${userData.major} • ${userData.semester}`
    : userData.semester || userData.major || 'Academic Workspace';

  const firstName = userData.fullName !== 'Student' 
    ? userData.fullName.split(' ')[0] 
    : 'Student';

  return (
    <header className={styles.headerContainer}>
      <div className={styles.brandAndWelcome}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={onToggleSidebar}
          aria-label={isMobileSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMobileSidebarOpen}
        >
          {isMobileSidebarOpen ? <FiX /> : <FiMenu />}
        </button>
        <button
          type="button"
          className={styles.collapseButton}
          onClick={onToggleCollapse}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>
        <Link href="/dashboard" className={styles.brandLogo}>
          Aether <span>StudyOS</span>
        </Link>
      </div>

      <div className={styles.titleBlock}>
        <h1 className={styles.greeting}>Welcome back, {firstName}!</h1>
        <p className={styles.subtitle}>{semesterInfo}</p>
      </div>

      {/* Right Controls & Account Widget */}
      <div className={styles.actionsBlock}>
        {/* User Account Profile Widget */}
        <div className={styles.profileWrapper} ref={profileWrapperRef}>
          <button 
            type="button" 
            className={styles.profileBtn}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
          >
            <div className={styles.avatar}>
              {userData.fullName.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{userData.fullName}</span>
              <span className={styles.userRole}>Student</span>
            </div>
            <FiChevronDown className={`${styles.arrowIcon} ${isMenuOpen ? styles.rotateArrow : ''}`} />
          </button>

          {/* Account Dropdown Menu */}
          {isMenuOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.menuHeader}>
                <strong>{userData.fullName}</strong>
                <span>{semesterInfo}</span>
              </div>
              <div className={styles.menuDivider} />
              
              <Link href="/dashboard/settings" className={styles.menuItem} onClick={() => setIsMenuOpen(false)}>
                <FiUser /> Account Profile
              </Link>
              <Link href="/dashboard/settings" className={styles.menuItem} onClick={() => setIsMenuOpen(false)}>
                <FiSettings /> Preferences
              </Link>

              <div className={styles.themeMenuRow}>
                <span>Appearance</span>
                <ThemeToggler />
              </div>

              <div className={styles.menuDivider} />
              <button type="button" className={styles.logoutBtn} onClick={handleLogout} disabled={isLoggingOut}>
                <FiLogOut /> {isLoggingOut ? 'Signing out...' : 'Log Out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
