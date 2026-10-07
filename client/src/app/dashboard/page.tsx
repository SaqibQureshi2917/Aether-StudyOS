'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest, getCachedApiResponse } from '@/lib/apiClient';
import { formatDatePK } from '@/lib/dateFormat';
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
import { useToast } from '@/components/layout/toast/ToastContext';

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
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [updatingSessionId, setUpdatingSessionId] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [showPlanChoice, setShowPlanChoice] = useState(false);
  const [showPartialChoice, setShowPartialChoice] = useState(false);
  const hasDashboardData = useRef(false);
  const dashboardRequestId = useRef(0);

  const formatDailyGoal = (hours: number) => {
    const totalMinutes = Math.round(hours * 60);
    const wholeHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    if (wholeHours === 0) return `${totalMinutes} min/day`;
    return `${wholeHours} hr${wholeHours === 1 ? '' : 's'}${remainingMinutes ? ` ${remainingMinutes} min` : ''}/day`;
  };

  const fetchDashboardData = useCallback(async () => {
    const requestId = ++dashboardRequestId.current;
    try {
      const dashboardEndpoint = `/dashboard/overview?timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}`;
      const cached = getCachedApiResponse<{ data?: DashboardData }>(dashboardEndpoint)?.data;
      if (cached) { setData(cached); hasDashboardData.current = true; }
      if (!cached && !hasDashboardData.current) setLoading(true);
      setLoadError('');
      const res: any = await apiRequest(dashboardEndpoint, 'GET');
      if (requestId !== dashboardRequestId.current) return;
      if (res.data) {
        setData(res.data);
        hasDashboardData.current = true;
      } else {
        setLoadError('Dashboard data is unavailable right now. Please try again.');
      showToast('Dashboard data is unavailable right now. Please try again.', 'error');
      }
    } catch (err: any) {
      if (requestId !== dashboardRequestId.current) return;
      if (!hasDashboardData.current) setLoadError('Could not load your dashboard. Please try again.');
      showToast(err?.message || 'Could not refresh your dashboard. Your current information is still shown.', 'error');
    } finally {
      if (requestId === dashboardRequestId.current) setLoading(false);
    }
  }, [showToast]);

  const handleStartSession = async (sessionId: string) => {
    try {
      setUpdatingSessionId(sessionId);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const response: any = await apiRequest('/sessions/start', 'POST', { sessionId, timeZone });
      setData((current) => current ? ({ ...current, todayPlan: current.todayPlan.map((session) => session.id === sessionId ? { ...session, status: 'IN_PROGRESS', startedAt: response.data?.session?.startedAt || new Date().toISOString() } : session) }) : current);
      window.dispatchEvent(new CustomEvent('studyos:session-updated', { detail: { source: 'dashboard' } }));
      void fetchDashboardData();
    } catch (err: any) {
      showToast(err?.message || 'Could not start this study session. Please try again.', 'error');
    } finally {
      setUpdatingSessionId(null);
    }
  };


  const handleStartStudySession = async () => {
    if (data?.todayPlan.some((session) => ['IN_PROGRESS', 'PAUSED'].includes(session.status))) {
      showToast('You already have a study session in progress. Resume or finish it before starting another.', 'info');
      return;
    }
    const nextSession = data?.todayPlan.find((session) => session.status === 'SCHEDULED');
    if (nextSession) {
      await handleStartSession(nextSession.id);
      return;
    }
    showToast('No saved session is available today. The planner can build one from your daily study goal.', 'info');
    router.push('/dashboard/planner');
  };
  useEffect(() => {
    fetchDashboardData();
    const refreshDashboard = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.source === 'dashboard') return;
      void fetchDashboardData();
    };
    window.addEventListener('studyos:session-updated', refreshDashboard);
    window.addEventListener('focus', refreshDashboard);
    return () => {
      window.removeEventListener('studyos:session-updated', refreshDashboard);
      window.removeEventListener('focus', refreshDashboard);
    };
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!data?.todayPlan.some((session) => session.status === 'IN_PROGRESS')) return;
    const timerId = window.setInterval(() => setClockNow(Date.now()), 30_000);
    return () => window.clearInterval(timerId);
  }, [data?.todayPlan]);

  const handleCompleteSession = async (sessionId: string) => {
    try {
      setUpdatingSessionId(sessionId);
      const response: any = await apiRequest('/sessions/complete', 'POST', { sessionId });
      setData((current) => current ? ({ ...current, todayPlan: current.todayPlan.map((session) => session.id === sessionId ? { ...session, status: response.data?.session?.status || (response.data?.isPartial ? 'PARTIALLY_COMPLETED' : 'COMPLETED') } : session) }) : current);
      window.dispatchEvent(new CustomEvent('studyos:session-updated', { detail: { source: 'dashboard' } }));
      if (response.data?.isOverPlan) setShowPlanChoice(true);
      if (response.data?.isPartial) setShowPartialChoice(true);
      void fetchDashboardData();
    } catch (err: any) {
      showToast(err?.message || 'Could not complete this study session. Please try again.', 'error');
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
                <button type="button" className={styles.startSessionBtn} onClick={() => void handleStartStudySession()}>
                  <FiPlay /> Start Study Session
                </button>
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
              <div className={styles.emptyState}>
                <p>Dashboard details could not be refreshed.</p>
                <button type="button" onClick={fetchDashboardData}>Retry</button>
              </div>
            ) : data?.todayPlan && data.todayPlan.length > 0 ? (
              <div className={styles.planList}>
                {data.todayPlan.map((item) => (
                  <div key={item.id} className={styles.planItem}>
                    <div className={styles.planTime}>
                      Anytime today
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
                <p>No session is on today&apos;s plan yet. Open the planner to review daily sessions. You can start them any time today.</p>
                <Link href="/dashboard/planner" className={styles.subLink}>Open today&apos;s study planner →</Link>
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
                          {isOverdue ? 'Overdue' : formatDatePK(assignment.deadline)}
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
      {showPlanChoice && <div className={styles.planChoiceOverlay} role="presentation"><section className={styles.planChoiceDialog} role="dialog" aria-modal="true" aria-labelledby="plan-choice-title"><h2 id="plan-choice-title">You studied longer than planned</h2><p>Was this extra study just for today, or would you like to update the upcoming plan?</p><div><button type="button" onClick={() => setShowPlanChoice(false)}>Today only</button><button type="button" onClick={() => router.push('/dashboard/planner')}>Review plan</button><button type="button" onClick={() => setShowPlanChoice(false)}>Keep current plan</button></div></section></div>}
      {showPartialChoice && <div className={styles.planChoiceOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPartialChoice(false); }}><section className={styles.planChoiceDialog} role="alertdialog" aria-modal="true" aria-labelledby="partial-session-title"><h2 id="partial-session-title">Study time saved</h2><p>You finished before the planned duration. Your completed time is recorded; would you like to review the remaining study work?</p><div><button type="button" onClick={() => setShowPartialChoice(false)}>Stay on dashboard</button><button type="button" onClick={() => router.push('/dashboard/planner')}>Review planner</button></div></section></div>}
    </>
  );
}
