'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiUser, FiSettings, FiLogOut, FiChevronDown } from 'react-icons/fi';
import ThemeToggler from '@/components/features/ThemeToggler/ThemeToggler';
import styles from './Header.module.css';

export default function Header() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState<{
    fullName: string;
    major: string;
    semester: string;
  }>({
    fullName: 'Student',
    major: '',
    semester: '',
  });

  useEffect(() => {
    const savedUserStr = localStorage.getItem('studyos_user');
    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr);
        setUserData({
          fullName: savedUser.fullName || savedUser.name || 'Student',
          major: savedUser.major || '',
          semester: savedUser.semester || savedUser.semesterName || savedUser.currentSemester || '',
        });
      } catch (e) {
        console.error('Failed to parse studyos_user from localStorage', e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('studyos_user');
    router.push('/');
  };

  const semesterInfo = userData.major && userData.semester
    ? `${userData.major} • ${userData.semester}`
    : userData.semester || userData.major || 'Academic Workspace';

  const firstName = userData.fullName !== 'Student' 
    ? userData.fullName.split(' ')[0] 
    : 'Student';

  return (
    <header className={styles.headerContainer}>
      {/* Left Welcome Title */}
      <div className={styles.titleBlock}>
        <h1 className={styles.greeting}>Welcome back, {firstName}!</h1>
        <p className={styles.subtitle}>{semesterInfo}</p>
      </div>

      {/* Right Controls & Account Widget */}
      <div className={styles.actionsBlock}>
        {/* Theme Switcher Button */}
        <div className={styles.themeWrapper}>
          <ThemeToggler />
        </div>

        {/* User Account Profile Widget */}
        <div className={styles.profileWrapper}>
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

              <div className={styles.menuDivider} />
              <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
                <FiLogOut /> Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}