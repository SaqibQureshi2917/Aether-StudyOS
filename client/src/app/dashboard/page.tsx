'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar/Sidebar';
import OnboardingWizard from '@/components/features/Onboarding/OnboardingWizard';
import { 
  FiMessageSquare, 
  FiCalendar, 
  FiBook, 
  FiArrowRight, 
  FiClock, 
  FiAlertCircle 
} from 'react-icons/fi';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  return (
    <div className={styles.dashboardLayout}>
      <Sidebar onOpenSetupModal={() => setIsSetupOpen(true)} />

      <main className={styles.mainContent}>
        {/* Top Header */}
        <header className={styles.topHeader}>
          <div>
            <h1 className={styles.pageTitle}>Student Workspace</h1>
            <p className={styles.pageSubtitle}>Aether StudyOS Academic Command Center</p>
          </div>
        </header>

        {/* Setup Banner (If Courses Not Loaded) */}
        <div className={styles.setupBanner}>
          <div className={styles.bannerInfo}>
            <FiAlertCircle className={styles.bannerIcon} />
            <div>
              <h3>Setup Your Active Courses</h3>
              <p>Upload your course outlines to enable source-grounded AI tutors.</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setIsSetupOpen(true)} 
            className={styles.bannerBtn}
          >
            Start Setup
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <FiBook className={styles.statIcon} />
            <div>
              <span className={styles.statNumber}>4</span>
              <span className={styles.statLabel}>Active Courses</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <FiClock className={styles.statIcon} />
            <div>
              <span className={styles.statNumber}>3.5 hrs</span>
              <span className={styles.statLabel}>Target Today</span>
            </div>
          </div>
        </div>

        {/* Core Capabilities Section */}
        <div className={styles.cardsGrid}>
          {/* AI Chatbot Module Card */}
          <div className={styles.primaryCard}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}><FiMessageSquare /></div>
              <div>
                <h3>Source-Grounded AI Tutor</h3>
                <p>Ask questions with exact page-level citations from your course outlines.</p>
              </div>
            </div>
            <Link href="/dashboard/chat" className={styles.launchBtn}>
              Launch AI Chat Workspace <FiArrowRight />
            </Link>
          </div>

          {/* Semester Planner Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}><FiCalendar /></div>
              <div>
                <h3>Smart Semester Planner</h3>
                <p>Automated study schedules and deadline tracking.</p>
              </div>
            </div>
            <Link href="/dashboard/planner" className={styles.secondaryBtn}>
              View Calendar
            </Link>
          </div>
        </div>
      </main>

      {/* Setup Modal */}
      {isSetupOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSetupOpen(false)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className={styles.closeModalBtn} 
              onClick={() => setIsSetupOpen(false)}
            >
              ✕
            </button>
            <OnboardingWizard />
          </div>
        </div>
      )}
    </div>
  );
}