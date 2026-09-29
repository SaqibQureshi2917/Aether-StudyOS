'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiRequest, getCachedApiResponse } from '@/lib/apiClient';
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
    scheduledStart: string;
    plannedDuration: number;
    status: string;
    startedAt: string | null;
    task: {
      title: string;
      assignment?: { title: string; priority: string } | null;
      course?: { name: string } | null;
    };
  }>;
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    deadline: string;
    estimatedHours: number;
    completedHours: number;
    status: string;
    priority: string;
    course?: { name: string; colorCode: string };
  }>;
  scheduleRisk: {
    isAtRisk: boolean;
    overloadHours: number;
    overloadMinutes: number;
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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [updatingSessionId, setUpdatingSessionId] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());

  const formatDailyGoal = (hours: number) => {
    const totalMinutes = Math.round(hours * 60);
    const wholeHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    if (wholeHours === 0) return `${totalMinutes} min/day`;
    return `${wholeHours} hr${wholeHours === 1 ? '' : 's'}${remainingMinutes ? ` ${remainingMinutes} min` : ''}/day`;
  };

  const fetchDashboardData = async () => {
    try {
      const cached = getCachedApiResponse<{ data?: DashboardData }>('/dashboard/overview')?.data;
      if (cached) setData(cached);
      if (!cached && !data) setLoading(true);
      setLoadError('');
      const res: any = await apiRequest('/dashboard/overview', 'GET');
      if (res.data) {
        setData(res.data);
      } else {
        setLoadError('Dashboard data is unavailable right now. Please try again.');
      }
    } catch (err) {
      setLoadError('Could not load your dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (sessionId: string) => {
    try {
      setUpdatingSessionId(sessionId);
      await apiRequest('/sessions/start', 'POST', { sessionId });
      await fetchDashboardData();
    } catch (err) {
      setLoadError('Could not start this study session. Please try again.');
    } finally {
      setUpdatingSessionId(null);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (!data?.todayPlan.some((session) => session.status === 'IN_PROGRESS')) return;
    const timerId = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [data?.todayPlan]);

  const handleCompleteSession = async (sessionId: string) => {
    try {
      setUpdatingSessionId(sessionId);
      await apiRequest('/sessions/complete', 'POST', { sessionId });
      await fetchDashboardData();
    } catch (err) {
      setLoadError('Could not complete this study session. Please try again.');
    } finally {
      setUpdatingSessionId(null);
    }
  };

  return (
    <>
      <main className={styles.mainContent}>
        {/* Schedule Risk Warning Alert Box */}
        {data?.scheduleRisk?.isAtRisk && (
          <div className={styles.riskAlertBox}>
            <FiAlertTriangle className={styles.riskIcon} />
            <div className={styles.riskText}>
              <h4>Your upcoming workload needs attention</h4>
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
                {data?.user?.dailyGoalHours != null ? formatDailyGoal(data.user.dailyGoalHours) : '—'}
              </span>
              <span className={styles.statLabel}>Daily Target</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <FiBook className={styles.statIcon} />
            <div>
              <span className={styles.statNumber}>
                {data ? data.upcomingDeadlines.length : '—'} Pending
              </span>
              <span className={styles.statLabel}>Active Deadlines</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <FiTarget className={styles.statIcon} />
            <div>
              <span className={styles.statNumber}>
                {data ? data.weakTopics.length ? `${data.weakTopics.length} Topics` : 'None identified' : '—'}
              </span>
              <span className={styles.statLabel}>Needing Revision</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <FiZap className={styles.statIcon} />
            <div>
              <span className={styles.planBadge}>
                {data?.user?.planType || '—'}
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
            ) : loadError ? (
              <div className={styles.emptyState} role="alert">
                <p>{loadError}</p>
                <button type="button" onClick={fetchDashboardData}>Retry</button>
              </div>
            ) : data?.todayPlan && data.todayPlan.length > 0 ? (
              <div className={styles.planList}>
                {data.todayPlan.map((item) => (
                  <div key={item.id} className={styles.planItem}>
                    <div className={styles.planTime}>
                      {new Date(item.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className={styles.planDetails}>
                      <strong>{item.task.title}</strong>
                      <span>
                        {item.task.course?.name ? `${item.task.course.name} · ` : ''}
                        {Math.round(item.plannedDuration * 60)} Mins · {item.task.assignment?.priority || 'MEDIUM'} Priority
                        {item.status === 'IN_PROGRESS' && item.startedAt && ` · ${Math.floor(Math.max(0, clockNow - new Date(item.startedAt).getTime()) / 60000)} min elapsed`}
                      </span>
                    </div>
                    {item.status === 'SCHEDULED' && (
                      <button
                        type="button"
                        className={styles.startSessionBtn}
                        onClick={() => handleStartSession(item.id)}
                        disabled={updatingSessionId === item.id}
                      >
                        <FiPlay /> {updatingSessionId === item.id ? 'Starting…' : 'Start'}
                      </button>
                    )}
                    {item.status === 'IN_PROGRESS' && (
                      <button
                        type="button"
                        className={styles.startSessionBtn}
                        onClick={() => handleCompleteSession(item.id)}
                        disabled={updatingSessionId === item.id}
                      >
                        {updatingSessionId === item.id ? 'Saving…' : 'Complete'}
                      </button>
                    )}
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

          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <h3>Upcoming Assignments</h3>
              <Link href="/dashboard/assignments" className={styles.subLink}>View all</Link>
            </div>
            {loading ? (
              <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardFull}`} />
            ) : loadError ? (
              <p role="alert">{loadError}</p>
            ) : data?.upcomingDeadlines.length ? (
              <div className={styles.deadlineList}>
                {data.upcomingDeadlines.map((assignment) => {
                  const isOverdue = new Date(assignment.deadline).getTime() < Date.now();
                  const progress = assignment.estimatedHours > 0
                    ? Math.min(100, Math.round((assignment.completedHours / assignment.estimatedHours) * 100))
                    : 0;
                  return (
                    <Link key={assignment.id} href={`/dashboard/assignments/${assignment.id}`} className={styles.deadlineCard}>
                      <div className={styles.deadlineHeading}>
                        <strong>{assignment.title}</strong>
                        <span className={isOverdue ? styles.overdueLabel : styles.deadlineLabel}>
                          {isOverdue ? 'Overdue' : new Date(assignment.deadline).toLocaleDateString()}
                        </span>
                      </div>
                      <span className={styles.deadlineMeta}>
                        {assignment.course?.name || 'Course'} · {assignment.priority} priority · {progress}% effort recorded
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>No assignments are due in the next seven days.</div>
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
                  No learning recommendations are available yet. They will appear when the backend has relevant study progress to evaluate.
                </p>
                <Link href="/dashboard/settings" className={styles.actionBtn}>
                  Review Academic Profile <FiArrowRight />
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

    </>
  );
}
