'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header/Header';
import OnboardingWizard from '@/components/features/Onboarding/OnboardingWizard';
import { apiRequest } from '@/lib/apiClient';
import { 
  FiBook, 
  FiArrowRight, 
  FiClock, 
  FiAlertTriangle,
  FiCheckCircle,
  FiPlay,
  FiTarget,
  FiZap,
  FiPlus
} from 'react-icons/fi';
import styles from './dashboard.module.css';
import skeletonStyles from '@/styles/skeletons.module.css';

interface DashboardData {
  user: {
    fullName: string;
    major: string;
    semester: string;
    planType: 'FREE' | 'PRO';
    dailyGoalHours: number;
  };
  todayPlan: Array<{
    id: string;
    title: string;
    startTime: string;
    durationMins: number;
    status: string;
    priority: string;
  }>;
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    deadline: string;
    estimatedHours: number;
    completedHours: number;
    course?: { name: string; colorCode: string };
  }>;
  scheduleRisk: {
    isAtRisk: boolean;
    overloadHours: number;
    message: string;
  };
  weakTopics: Array<{
    id: string;
    topicName: string;
    masteryPercentage: number;
    course: { name: string };
  }>;
  recommendations: Array<{
    topic: string;
    courseName: string;
    mastery: number;
    suggestedAction: string;
  }>;
}

export default function DashboardPage() {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res: any = await apiRequest('/dashboard/overview', 'GET');
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.warn('Dashboard live API fetch fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <>
      <main className={styles.mainContent}>
        <Header />

        {/* Schedule Risk Warning Alert Box */}
        {data?.scheduleRisk?.isAtRisk && (
          <div className={styles.riskAlertBox}>
            <FiAlertTriangle className={styles.riskIcon} />
            <div className={styles.riskText}>
              <h4>Schedule Capacity Overload Risk!</h4>
              <p>{data.scheduleRisk.message}</p>
            </div>
            <Link href="/dashboard/planner" className={styles.riskBtn}>
              Review Schedule
            </Link>
          </div>
        )}

        {/* Top Academic Snapshot Metrics */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <FiClock className={styles.statIcon} />
            <div>
              <span className={styles.statNumber}>
                {data?.user?.dailyGoalHours || 3.0} Hours/Day
              </span>
              <span className={styles.statLabel}>Daily Target</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <FiBook className={styles.statIcon} />
            <div>
              <span className={styles.statNumber}>
                {data?.upcomingDeadlines?.length || 0} Pending
              </span>
              <span className={styles.statLabel}>Active Deadlines</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <FiTarget className={styles.statIcon} />
            <div>
              <span className={styles.statNumber}>
                {data?.weakTopics?.length ? `${data.weakTopics.length} Topics` : 'Optimal'}
              </span>
              <span className={styles.statLabel}>Needing Revision</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <FiZap className={styles.statIcon} />
            <div>
              <span className={styles.planBadge}>
                {data?.user?.planType || 'FREE'}
              </span>
              <span className={styles.statLabel}>Account Tier</span>
            </div>
          </div>
        </div>

        {/* Main Workspace Split View */}
        <div className={styles.workspaceGrid}>
          {/* Today's Plan Section */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <h3>Today&apos;s Plan</h3>
              <div className={styles.headerActions}>
                <Link href="/dashboard/assignments?action=new" className={styles.quickAddBtn}>
                  <FiPlus /> Add Assignment
                </Link>
                <Link href="/dashboard/planner" className={styles.subLink}>Full Schedule →</Link>
              </div>
            </div>

            {loading ? (
              <div className={styles.planList}>
                <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardFull}`} />
                <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardFull}`} />
              </div>
            ) : data?.todayPlan && data.todayPlan.length > 0 ? (
              <div className={styles.planList}>
                {data.todayPlan.map((item) => (
                  <div key={item.id} className={styles.planItem}>
                    <div className={styles.planTime}>
                      {item.startTime || '10:00'}
                    </div>
                    <div className={styles.planDetails}>
                      <strong>{item.title}</strong>
                      <span>{item.durationMins} Mins • {item.priority} Priority</span>
                    </div>
                    <button type="button" className={styles.startSessionBtn}>
                      <FiPlay /> Start
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <FiCheckCircle className={styles.checkIcon} />
                <p>No study sessions scheduled for today. You&apos;re all caught up!</p>
              </div>
            )}
          </div>

          {/* Adaptive Recommendation Card */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <h3>Adaptive Recommendation</h3>
            </div>

            {data?.recommendations && data.recommendations.length > 0 ? (
              <div className={styles.recommendationCard}>
                <div className={styles.recomHeader}>
                  <FiZap className={styles.recomIcon} />
                  <strong>{data.recommendations[0].courseName}</strong>
                </div>
                <p className={styles.recomText}>
                  {data.recommendations[0].suggestedAction}
                </p>
                <Link href="/dashboard/chat" className={styles.actionBtn}>
                  Revise with AI Tutor <FiArrowRight />
                </Link>
              </div>
            ) : (
              <div className={styles.recommendationCard}>
                <p className={styles.recomText}>
                  Upload course syllabi in Course Setup to unlock real-time adaptive AI recommendations.
                </p>
                <button 
                  type="button" 
                  onClick={() => setIsSetupOpen(true)} 
                  className={styles.actionBtn}
                >
                  Setup Courses Now
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Onboarding Setup Modal Overlay */}
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
    </>
  );
}