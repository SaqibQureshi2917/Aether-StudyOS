'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiAlertTriangle, FiArrowLeft, FiArrowRight, FiBookOpen, FiCalendar, FiCheck, FiClock, FiPlay, FiPlus, FiRefreshCw, FiX } from 'react-icons/fi';
import { apiRequest } from '@/lib/apiClient';
import { formatDatePK } from '@/lib/dateFormat';
import PageSkeleton from '@/components/layout/PageSkeleton/PageSkeleton';
import { useToast } from '@/components/layout/toast/ToastContext';
import MarkdownContent from '@/app/dashboard/chat/MarkdownContent';
import styles from './planner.module.css';

type Semester = { id: string; name: string; status: string; startDate: string; endDate: string | null };
type AvailabilitySlot = { dayOfWeek: number; startTime: string; endTime: string; isBlocked: boolean };
type Task = { id: string; title: string; courseId: string; courseName: string; assignmentTitle: string | null; examTitle: string | null; isVirtualExam: boolean; deadline: string; estimatedHours: number; completedHours: number; baselineRemainingHours: number; remainingHours: number; historicalMultiplier: number; priorityScore: number; priorityBreakdown: { factors: Record<string, number>; weights: Record<string, number> }; weakestMastery: number | null };
type ScheduleConflict = { taskId: string; title: string; deadline: string; remainingHours: number; unscheduledHours: number; unscheduledMinutes: number; reason: 'DEADLINE_PASSED' | 'INSUFFICIENT_CAPACITY' };
type StudySession = {
  id: string; scheduledStart: string; scheduledEnd: string; plannedDuration: number; actualDuration: number | null; status: string; startedAt: string | null;
  task: { id: string; title: string; assignment?: { title: string } | null; course: { id: string; name: string; colorCode: string | null } };
};
type PlannerRecommendation = { id: string; type: string; title: string; message: string; severity: string; relatedTaskId: string | null; relatedCourseId: string | null; status: string };
type Overview = {
  semester: Semester; courses: Array<{ id: string; name: string; colorCode: string | null }>; dailyGoalHours: number; dailySessionMinutes: number; horizon: { endDateAssumed: boolean; endDate: string }; tasks: Task[]; sessions: StudySession[];
  capacity: { availableHours: number; scheduledHours: number; unscheduledHours: number; taskCount: number; sessionCount: number; conflictCount: number };
  conflicts: ScheduleConflict[];
  recommendations: PlannerRecommendation[];
};
type Preview = { previewHash: string; courseId?: string | null; timeZone?: string; dailyGoalHours: number; semester: { id: string; name: string }; sessions: Array<{ taskId: string; title: string; startTime: string; endTime: string; durationHours: number }>; conflicts: ScheduleConflict[]; capacity: { availableHours: number; scheduledHours: number; unscheduledHours: number } };
type ApiResult<T> = { success: boolean; data: T };

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatUnscheduledMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  if (safeMinutes === 0) return '0m';
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return [hours ? `${hours}h` : '', remainingMinutes ? `${remainingMinutes}m` : ''].filter(Boolean).join(' ');
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  // Weekly availability is entered Sunday-first, so keep the calendar week
  // aligned to that same Sunday–Saturday range. Sunday remains in the week
  // containing today instead of appearing to belong to next week.
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function errorText(error: unknown, fallback: string) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : fallback;
}

function priorityExplanation(task: Task) {
  const names: Record<string, string> = { deadlineUrgency: 'deadline', remainingEffort: 'remaining effort', difficulty: 'difficulty', userPriority: 'task priority', overdue: 'overdue status', academicRisk: 'weak topic mastery' };
  return Object.entries(task.priorityBreakdown.factors)
    .map(([key, score]) => ({ name: names[key] || key, weight: task.priorityBreakdown.weights[key] || 0, score }))
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 2)
    .filter((factor) => factor.score > 0)
    .map((factor) => factor.name)
    .join(' and ');
}

export default function PlannerPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [view, setView] = useState<'WEEK' | 'DAY'>('WEEK');
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [plannerCourseScope, setPlannerCourseScope] = useState('ALL');
  const [focusedCourseId, setFocusedCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOverviewRefreshing, setIsOverviewRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [actingSessionId, setActingSessionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (error) showToast(error, 'error'); }, [error, showToast]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [availabilityDay, setAvailabilityDay] = useState(1);
  const [availabilityMinutes, setAvailabilityMinutes] = useState('60');
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [isStartingAnySession, setIsStartingAnySession] = useState(false);
  const [availabilityNotice, setAvailabilityNotice] = useState('');
  const [timeZone] = useState(() => typeof window === 'undefined' ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [plannerExplanation, setPlannerExplanation] = useState('');
  const explanationRequestId = useRef(0);
  const [isExplaining, setIsExplaining] = useState(false);
  const [actingRecommendationId, setActingRecommendationId] = useState<string | null>(null);
  const overviewRequestId = useRef(0);
  const adHocSessionsRequestId = useRef(0);
  const overviewSemesterId = useRef<string | null>(null);

  useEffect(() => {
    if (!preview) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [preview]);

  const dateRange = useMemo(() => {
    const selected = new Date(`${selectedDate}T00:00:00`);
    const from = view === 'WEEK' ? startOfWeek(selected) : selected;
    const to = new Date(from);
    if (view === 'WEEK') to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [selectedDate, view]);

  const loadSemesters = useCallback(async () => {
    const response = await apiRequest<ApiResult<{ semesters: Semester[] }>>('/semesters', 'GET');
    const list = response.data?.semesters || [];
    setSemesters(list);
    if (!list.length) setLoading(false);
    setSemesterId((current) => current && list.some((semester) => semester.id === current)
      ? current
      : (list.find((semester) => semester.status === 'ACTIVE') || list[0])?.id || '');
    return list;
  }, []);

  const loadAvailability = useCallback(async () => {
    const response = await apiRequest<ApiResult<{ slots: AvailabilitySlot[] }>>('/planner/availability', 'GET');
    const slots = response.data?.slots || [];
    setAvailability(slots);
    if (slots.length) {
      const first = slots[0];
      const toMinutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; };
      setAvailabilityDay(first.dayOfWeek);
      setAvailabilityMinutes(String((toMinutes(first.endTime) - toMinutes(first.startTime) + 1440) % 1440));
    }
  }, []);

  const loadOverview = useCallback(async (id = semesterId, range = dateRange): Promise<Overview | null> => {
    if (!id) { setOverview(null); setLoading(false); return null; }
    const requestId = ++overviewRequestId.current;
    const isFirstLoadForSemester = overviewSemesterId.current !== id;
    if (isFirstLoadForSemester) setLoading(true);
    else setIsOverviewRefreshing(true);
    setError('');
    try {
      const query = new URLSearchParams({ semesterId: id, from: range.from, to: range.to, timeZone });
      const response = await apiRequest<ApiResult<Overview>>(`/planner/overview?${query.toString()}`, 'GET');
      if (requestId !== overviewRequestId.current) return null;
      setOverview(response.data);
      overviewSemesterId.current = id;
      return response.data;
    } catch (err: unknown) {
      if (requestId !== overviewRequestId.current) return null;
      showToast(errorText(err, 'Could not load your semester plan. Please try again.'), 'error');
      return null;
    } finally {
      if (requestId === overviewRequestId.current) {
        setLoading(false);
        setIsOverviewRefreshing(false);
      }
    }
  }, [dateRange, semesterId, timeZone]);

  const loadSessions = useCallback(async (id = semesterId, range = dateRange, updateCurrentView = true): Promise<StudySession[]> => {
    if (!id) return [];
    const requestId = updateCurrentView ? ++overviewRequestId.current : ++adHocSessionsRequestId.current;
    const requestIsCurrent = () => updateCurrentView ? requestId === overviewRequestId.current : requestId === adHocSessionsRequestId.current;
    if (updateCurrentView) setIsOverviewRefreshing(true);
    try {
      const query = new URLSearchParams({ semesterId: id, from: range.from, to: range.to });
      const response = await apiRequest<ApiResult<{ sessions: StudySession[] }>>(`/planner/sessions?${query.toString()}`, 'GET');
      if (!requestIsCurrent()) return [];
      const sessions = response.data?.sessions || [];
      if (updateCurrentView) setOverview((current) => current?.semester.id === id ? ({ ...current, sessions, capacity: { ...current.capacity, sessionCount: sessions.length } }) : current);
      return sessions;
    } catch (err: unknown) {
      if (requestIsCurrent()) showToast(errorText(err, 'Could not refresh sessions for these dates.'), 'error');
      return [];
    } finally {
      if (updateCurrentView && requestIsCurrent()) setIsOverviewRefreshing(false);
    }
  }, [dateRange, semesterId, showToast]);

  useEffect(() => {
    // Load the authenticated semester list as an external data synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSemesters().catch((err: unknown) => {
      showToast(errorText(err, 'Could not load your semesters.'), 'error');
      setLoading(false);
    });
  }, [loadSemesters]);

  useEffect(() => {
    // Load persisted weekly availability into the planner form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAvailability().catch(() => setAvailability([]));
  }, [loadAvailability]);

  useEffect(() => {
    // Keep the visible calendar synchronized with the selected semester and date range.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (semesterId) {
      if (overviewSemesterId.current === semesterId) void loadSessions(semesterId);
      else void loadOverview(semesterId);
    }
  }, [semesterId, dateRange, loadOverview, loadSessions]);

  useEffect(() => {
    const refreshPlannerAfterTimerAction = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.source === 'timer' && semesterId) {
        if (['pause', 'resume', 'start'].includes(event.detail.action)) void loadSessions(semesterId);
        else void loadOverview(semesterId);
      }
    };
    window.addEventListener('studyos:session-updated', refreshPlannerAfterTimerAction);
    return () => window.removeEventListener('studyos:session-updated', refreshPlannerAfterTimerAction);
  }, [loadOverview, loadSessions, semesterId]);

  const changeDate = (amount: number) => {
    const date = new Date(`${selectedDate}T00:00:00`);
    date.setDate(date.getDate() + amount * (view === 'WEEK' ? 7 : 1));
    setSelectedDate(localDateKey(date));
  };

  const handlePreview = async () => {
    if (!semesterId) { showToast('Create a semester before planning your study schedule.', 'error'); return; }
    setIsGenerating(true);
    setError('');
    try {
      const response = await apiRequest<ApiResult<Preview>>('/planner/preview', 'POST', { semesterId, timeZone, ...(plannerCourseScope === 'ALL' ? {} : { courseId: plannerCourseScope }) });
      setPreview(response.data);
    } catch (err: unknown) {
      showToast(errorText(err, 'Could not create a schedule preview.'), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const applyPreview = async () => {
    if (!preview || isApplying) return;
    setIsApplying(true);
    setError('');
    try {
      await apiRequest('/planner/apply', 'POST', { semesterId: preview.semester.id, previewHash: preview.previewHash, timeZone: preview.timeZone || timeZone, ...(preview.courseId ? { courseId: preview.courseId } : {}) });
      setPreview(null);
      await loadOverview(preview.semester.id);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && err.status === 409) {
        try {
          const refreshed = await apiRequest<ApiResult<Preview>>('/planner/preview', 'POST', {
            semesterId: preview.semester.id,
            timeZone: preview.timeZone || timeZone,
            ...(preview.courseId ? { courseId: preview.courseId } : {}),
          });
          setPreview(refreshed.data);
          showToast('Planner data changed while you were reviewing it. A fresh proposal is ready; review it before applying.', 'info');
        } catch (refreshError: unknown) {
          setPreview(null);
          showToast(errorText(refreshError, 'The preview expired and could not be refreshed. Open Review schedule again.'), 'error');
        }
      } else {
        showToast(errorText(err, 'The schedule could not be applied. Review a fresh preview and try again.'), 'error');
      }
    } finally {
      setIsApplying(false);
    }
  };

  const actOnSession = async (session: StudySession, action: 'start' | 'complete' | 'missed') => {
    let actualMinutes: number | undefined;
    if (action === 'complete') {
      const enteredMinutes = window.prompt('Actual study time in minutes (1–720):', String(Math.min(Math.round(session.plannedDuration * 60), 720)));
      if (enteredMinutes === null) return;
      actualMinutes = Number(enteredMinutes);
      if (!Number.isInteger(actualMinutes) || actualMinutes < 1 || actualMinutes > 720) {
        setError('Enter actual study time as a whole number from 1 to 720 minutes.');
        return;
      }
    }
    setActingSessionId(session.id);
    setError('');
    try {
      const response = await apiRequest<ApiResult<{ isPartial?: boolean; session?: Partial<StudySession> }>>(`/sessions/${action}`, 'POST', { sessionId: session.id, ...(action === 'start' || action === 'missed' ? { timeZone } : {}), ...(actualMinutes === undefined ? {} : { actualMinutes }) });
      const nextStatus = action === 'start' ? 'IN_PROGRESS' : action === 'missed' ? 'MISSED' : response.data?.isPartial ? 'PARTIALLY_COMPLETED' : 'COMPLETED';
      setOverview((current) => current ? ({ ...current, sessions: current.sessions.map((item) => item.id === session.id ? { ...item, ...response.data?.session, status: nextStatus, ...(action === 'start' ? { startedAt: new Date().toISOString() } : {}) } : item) }) : current);
      window.dispatchEvent(new CustomEvent('studyos:session-updated', { detail: { source: 'planner-action' } }));
      if (action === 'complete' && response.data?.isPartial) {
        showToast('Partial study time was saved. Review the recommendation below to decide what to do with the remaining time.', 'info');
      }
      if (action !== 'start') void loadOverview();
    } catch (err: unknown) {
      showToast(errorText(err, 'This study session could not be updated. Refresh and try again.'), 'error');
    } finally {
      setActingSessionId(null);
    }
  };

  const startPlannerSession = async () => {
    if (isStartingAnySession || !semesterId) return;
    setIsStartingAnySession(true);
    const todayKey = localDateKey(new Date());
    const findTodaySession = (sessions: StudySession[]) => sessions.find((session) => session.status === 'SCHEDULED'
      && localDateKey(new Date(session.scheduledStart)) === todayKey
      && (plannerCourseScope === 'ALL' || session.task.course.id === plannerCourseScope));
    try {
      let session = findTodaySession(overview?.sessions || []);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const todayRange = { from: todayStart.toISOString(), to: tomorrowStart.toISOString() };
      const loadedFrom = new Date(dateRange.from).getTime();
      const loadedTo = new Date(dateRange.to).getTime();
      if (!session && !(todayStart.getTime() >= loadedFrom && todayStart.getTime() <= loadedTo)) {
        const refreshedToday = await loadSessions(semesterId, todayRange, false);
        session = findTodaySession(refreshedToday);
      }
      if (!session) {
        const response = await apiRequest<ApiResult<Preview>>('/planner/preview', 'POST', { semesterId, timeZone, ...(plannerCourseScope === 'ALL' ? {} : { courseId: plannerCourseScope }) });
        if (!response.data.sessions.length) {
          setPreview(response.data);
          showToast('No session fits today yet. Review the planner conflicts or weekly duration shown in the plan.', 'info');
          return;
        }
        await apiRequest('/planner/apply', 'POST', { semesterId, previewHash: response.data.previewHash, timeZone, ...(plannerCourseScope === 'ALL' ? {} : { courseId: plannerCourseScope }) });
        const refreshed = await loadSessions(semesterId, todayRange, false);
        session = findTodaySession(refreshed);
      }
      if (!session) {
        showToast('Your plan has no session for today. Review the selected days or choose All subjects.', 'info');
        return;
      }
      await actOnSession(session, 'start');
    } catch (err: unknown) {
      showToast(errorText(err, 'A study session could not be started.'), 'error');
    } finally {
      setIsStartingAnySession(false);
    }
  };

  const saveAvailability = async () => {
    setIsSavingAvailability(true);
    setError('');
    setAvailabilityNotice('');
    try {
      const response = await apiRequest<ApiResult<{ slots: AvailabilitySlot[] }>>('/planner/availability', 'PUT', { slots: availability });
      setAvailability(response.data?.slots || []);
      if (semesterId) {
        const previewResponse = await apiRequest<ApiResult<Preview>>('/planner/preview', 'POST', { semesterId, timeZone, ...(plannerCourseScope === 'ALL' ? {} : { courseId: plannerCourseScope }) });
        if (previewResponse.data.sessions.length === 0) {
          setPreview(previewResponse.data);
          const { capacity, conflicts } = previewResponse.data;
          setAvailabilityNotice(capacity.availableHours <= 0
            ? 'Weekly durations saved, but the selected weekdays have no remaining planning time before this semester ends. Check the selected days and semester dates.'
            : conflicts.length > 0
              ? 'Weekly durations saved, but the open tasks cannot fit before their deadlines. Review the conflicts in the schedule preview.'
              : 'Weekly durations saved, but there are no open study tasks to schedule. Add an active subject or an assignment with remaining study time.');
        } else {
          await apiRequest('/planner/apply', 'POST', { semesterId, previewHash: previewResponse.data.previewHash, timeZone, ...(plannerCourseScope === 'ALL' ? {} : { courseId: plannerCourseScope }) });
          setAvailabilityNotice(`${previewResponse.data.sessions.length} study sessions created from your weekly durations.`);
        }
        await loadOverview(semesterId);
      } else {
        setAvailabilityNotice('Weekly durations saved. Select or create a semester to generate sessions.');
      }
    } catch (err: unknown) {
      showToast(errorText(err, 'Weekly study durations could not be saved.'), 'error');
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const addAvailability = () => {
    const minutes = Number(availabilityMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1439) {
      showToast('Enter a daily study duration from 1 to 1,439 minutes.', 'error');
      return;
    }
    const durationEnd = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    setAvailability((current) => [...current.filter((slot) => slot.dayOfWeek !== availabilityDay), { dayOfWeek: availabilityDay, startTime: '00:00', endTime: durationEnd, isBlocked: false }]
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    setError('');
    setAvailabilityNotice('');
  };

  const explainWorkload = async () => {
    if (!semesterId || isExplaining) return;
    const requestId = ++explanationRequestId.current;
    setIsExplaining(true);
    setError('');
    try {
      const response = await apiRequest<ApiResult<{ explanation: string; scheduleChanged: boolean }>>('/planner/explain', 'POST', { semesterId, timeZone });
      if (explanationRequestId.current === requestId) setPlannerExplanation(response.data.explanation);
    } catch (err: unknown) {
      if (explanationRequestId.current === requestId) showToast(errorText(err, 'The planner explanation is temporarily unavailable. Your schedule is unchanged.'), 'error');
    } finally {
      if (explanationRequestId.current === requestId) setIsExplaining(false);
    }
  };

  const closeExplanation = () => {
    explanationRequestId.current += 1;
    setIsExplaining(false);
    setPlannerExplanation('');
  };

  const updateRecommendation = async (recommendation: PlannerRecommendation, action: 'accept' | 'dismiss') => {
    if (actingRecommendationId) return;
    setActingRecommendationId(recommendation.id);
    setError('');
    try {
      await apiRequest(`/recommendations/${recommendation.id}/${action}`, 'POST', {});
      await loadOverview();
      if (action === 'accept') setAvailabilityNotice('Recommendation accepted. Review a fresh plan before applying session changes.');
    } catch (err: unknown) {
      showToast(errorText(err, 'This planner recommendation could not be updated.'), 'error');
    } finally {
      setActingRecommendationId(null);
    }
  };

  const allSessions = overview?.sessions || [];
  const visibleSessions = allSessions.filter((session) => {
    const matchesDate = view === 'DAY'
      ? localDateKey(new Date(session.scheduledStart)) === selectedDate
      : (() => { const weekStart = startOfWeek(new Date(`${selectedDate}T00:00:00`)); const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7); return new Date(session.scheduledStart) >= weekStart && new Date(session.scheduledStart) < weekEnd; })();
    return matchesDate && (plannerCourseScope === 'ALL' || session.task.course.id === plannerCourseScope);
  });
  const sessionsByCourse = overview?.courses.map((course) => ({
    ...course,
    sessions: visibleSessions.filter((session) => session.task.course.id === course.id),
  })) || [];
  const showingSubjectOverview = plannerCourseScope === 'ALL' && !focusedCourseId;
  const displayedSessions = focusedCourseId
    ? visibleSessions.filter((session) => session.task.course.id === focusedCourseId)
    : visibleSessions;
  const rangeLabel = view === 'DAY'
    ? formatDatePK(new Date(`${selectedDate}T00:00:00`), { weekday: 'long', month: 'long', day: 'numeric' })
    : (() => { const start = startOfWeek(new Date(`${selectedDate}T00:00:00`)); const end = new Date(start); end.setDate(end.getDate() + 6); return `${formatDatePK(start, { month: 'short', day: 'numeric' })} – ${formatDatePK(end, { month: 'short', day: 'numeric' })}`; })();

  return (
    <main className={styles.plannerContainer}>
      <header className={styles.plannerHeader}>
        <div>
          <span className={styles.eyebrow}>SEMESTER PLANNER</span>
          <h1 className={styles.title}>Your study plan</h1>
          <p className={styles.subtitle}>Your daily study goal builds the default plan. Weekly durations are optional overrides, and you can start a session any time on its target day.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.outlineButton} onClick={() => router.push('/dashboard/courses')}>Manage semesters & subjects</button>
          <button type="button" className={styles.outlineButton} onClick={() => router.push('/dashboard/assignments?action=new')}><FiPlus /> Add assignment</button>
          <button type="button" className={styles.primaryActionBtn} onClick={() => void handlePreview()} disabled={isGenerating || !semesterId}><FiRefreshCw className={isGenerating ? styles.spinning : ''} />{isGenerating ? 'Building preview…' : 'Review schedule'}</button>
        </div>
      </header>

      {semesters.length > 0 && (
        <div className={styles.semesterBar}>
          <label htmlFor="planner-semester">Semester</label>
          <select id="planner-semester" value={semesterId} onChange={(event) => setSemesterId(event.target.value)}>
            {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}{semester.status === 'ACTIVE' ? ' · Active' : ''}</option>)}
          </select>
          {overview?.horizon.endDateAssumed && <span className={styles.assumptionNote}>No end date set; capacity estimate uses a six month planning window.</span>}
        </div>
      )}

      {!loading && !semesters.length && (
        <section className={styles.emptyPanel}><div className={styles.emptyIcon}><FiCalendar /></div><h2>Start with your semester</h2><p>Create a semester, add its subjects, and tell StudyOS when you are free. Your subjects are the starting point for daily study sessions; assignments and exams can be added later.</p><button type="button" className={styles.primaryActionBtn} onClick={() => router.push('/dashboard/courses')}>Set up semesters & subjects</button></section>
      )}

      {loading && <PageSkeleton kind="collection" />}

      {!loading && overview && (
        <>
          {(() => {
            const completedSessions = overview.sessions.filter((session) => session.status === 'COMPLETED').length;
            const progressPercent = overview.capacity.sessionCount ? Math.round(completedSessions / overview.capacity.sessionCount * 100) : 0;
            return <section className={styles.metricsGrid} aria-label="Semester workload summary">
              <article className={styles.metricCard}><span>Open study tasks</span><strong>{overview.capacity.taskCount}</strong><small>Based on remaining task effort</small></article>
              <article className={styles.metricCard}><span>Available study time</span><strong>{overview.capacity.availableHours.toFixed(1)}h</strong><small>Across your semester availability</small></article>
              <article className={styles.metricCard}><span>Session progress in this view</span><strong>{completedSessions}/{overview.capacity.sessionCount}</strong><progress className={styles.progressBar} value={progressPercent} max={100} aria-label="Completed study sessions in the selected calendar view" /><small>{progressPercent}% of listed sessions completed</small></article>
              <article className={`${styles.metricCard} ${overview.capacity.conflictCount ? styles.metricWarning : ''}`}><span>Workload conflicts</span><strong>{overview.capacity.conflictCount}</strong><small>{formatUnscheduledMinutes(Math.round(overview.capacity.unscheduledHours * 60))} cannot fit before current deadlines</small></article>
            </section>;
          })()}

          {overview.conflicts.length > 0 && <section className={styles.conflictPanel} aria-label="Workload conflicts"><div className={styles.conflictHeading}><FiAlertTriangle /><div><strong>Some tasks do not fit before their deadlines</strong><p>Review the tasks below. The planner leaves unworkable effort visible instead of scheduling it past a deadline.</p></div></div><div className={styles.conflictList}>{overview.conflicts.slice(0, 5).map((conflict) => <div key={conflict.taskId}><strong>{conflict.title}</strong><span>{conflict.reason === 'DEADLINE_PASSED' ? 'Deadline has passed' : `${formatUnscheduledMinutes(conflict.unscheduledMinutes)} do not fit`} · Due {formatDatePK(conflict.deadline)}</span></div>)}</div></section>}

          <div className={styles.plannerGrid}>
            <section className={styles.timelineSection}>
              <div className={styles.sectionHeader}><div><h2>Study schedule</h2><p>Choose a subject to inspect its sessions, or review the complete study plan.</p>{isOverviewRefreshing && <small role="status">Updating the selected dates…</small>}</div><div className={styles.viewSwitch}><button type="button" className={view === 'WEEK' ? styles.viewActive : ''} onClick={() => { setView('WEEK'); setFocusedCourseId(null); }}>Week</button><button type="button" className={view === 'DAY' ? styles.viewActive : ''} onClick={() => { setView('DAY'); setFocusedCourseId(null); }}>Day</button></div></div>
              <div className={styles.calendarToolbar}><button type="button" onClick={() => changeDate(-1)} aria-label="Previous"><FiArrowLeft /></button><strong>{rangeLabel}</strong><button type="button" onClick={() => changeDate(1)} aria-label="Next"><FiArrowRight /></button><button type="button" className={styles.todayButton} onClick={() => { setSelectedDate(localDateKey(new Date())); setFocusedCourseId(null); }}>Today</button><label className={styles.sessionScopeLabel}>Plan scope<select aria-label="Subjects included in this plan" value={plannerCourseScope} onChange={(event) => { setPlannerCourseScope(event.target.value); setFocusedCourseId(null); }}><option value="ALL">All subjects</option>{overview.courses.map((course) => <option key={course.id} value={course.id}>One subject · {course.name}</option>)}</select></label><button type="button" className={styles.startPlanSessionBtn} onClick={() => void startPlannerSession()} disabled={isStartingAnySession || isApplying || isGenerating}>{isStartingAnySession ? "Starting…" : "Start session"}</button></div>
              {isOverviewRefreshing && visibleSessions.length === 0 ? <div className={styles.emptySchedule} role="status"><FiRefreshCw className={styles.spinning} /><strong>Updating selected dates</strong><span>Your existing planner is still available while this week loads.</span></div> : showingSubjectOverview ? <div className={styles.subjectOverviewGrid} aria-label="Subject study sessions">{sessionsByCourse.map((course) => {
                const completed = course.sessions.filter((session) => ['COMPLETED', 'PARTIALLY_COMPLETED'].includes(session.status)).length;
                const days = new Set(course.sessions.map((session) => localDateKey(new Date(session.scheduledStart)))).size;
                return <button type="button" className={styles.subjectOverviewCard} key={course.id} onClick={() => setFocusedCourseId(course.id)}>
                  <span className={styles.courseLabel}>{course.name}</span><strong>{course.sessions.length} {course.sessions.length === 1 ? 'session' : 'sessions'}</strong><span>{days ? `${days} study days` : `No sessions this ${view === 'DAY' ? 'day' : 'week'}`}</span>{course.sessions.slice(0, 3).map((session) => <small className={styles.subjectOutlineItem} key={session.id}>{formatDatePK(session.scheduledStart, { weekday: 'short' })} · {session.task.title}</small>)}<small>{completed} completed · click to view schedule</small>
                </button>;
              })}</div> : <>
              {plannerCourseScope === 'ALL' && focusedCourseId && <button type="button" className={styles.backToSubjectsButton} onClick={() => setFocusedCourseId(null)}>← All subjects</button>}
              {displayedSessions.length === 0 ? <div className={styles.emptySchedule}><FiCalendar /><strong>No sessions in this {view === 'DAY' ? 'day' : 'week'}</strong><span>Your plan may not have been applied yet. Review the schedule to create sessions for your selected subjects and study goal.</span><button type="button" className={styles.secondaryBtn} onClick={() => void handlePreview()} disabled={isGenerating || !semesterId}>{isGenerating ? 'Preparing plan…' : 'Review study plan'}</button></div> : <div className={styles.sessionList}>{displayedSessions.map((session) => {
                const busy = actingSessionId === session.id;
                const start = new Date(session.scheduledStart);
                const end = new Date(session.scheduledEnd);
                const todayKey = localDateKey(new Date());
                const sessionDateKey = localDateKey(start);
                const canMiss = session.status === 'SCHEDULED' && sessionDateKey < todayKey;
                const canStartToday = session.status === 'SCHEDULED' && sessionDateKey === todayKey;
                return <article key={session.id} className={styles.sessionCard}>
                  <div className={styles.sessionTime}><FiClock /><strong>{canStartToday ? 'Anytime today' : 'Scheduled day'}</strong><span>{formatDatePK(start, { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
                  <div className={styles.sessionDetails}><span className={styles.courseLabel}>{session.task.course.name}</span><h3>{session.task.title}</h3><p>{session.task.assignment?.title || 'Study task'} · {formatUnscheduledMinutes(Math.round(session.plannedDuration * 60))} planned</p></div>
                  <div className={styles.sessionActions}><span className={`${styles.statusBadge} ${styles[`status${session.status}`] || ''}`}>{session.status.replaceAll('_', ' ').toLowerCase()}</span>{session.status === 'SCHEDULED' && <button type="button" disabled={busy || (!canStartToday && !canMiss)} onClick={() => void actOnSession(session, canMiss ? 'missed' : 'start')}>{busy ? 'Saving…' : canMiss ? 'Mark missed' : canStartToday ? 'Start' : 'Starts on scheduled day'}</button>}{session.status === 'IN_PROGRESS' && <button type="button" disabled={busy} onClick={() => void actOnSession(session, 'complete')}>{busy ? 'Saving…' : 'Complete'}</button>}</div>
                </article>;
              })}</div>}
              </>}
            </section>

            <aside className={styles.sidebarSection}>
              <section id="planner-availability" className={styles.availabilityCard}><div className={styles.taskPanelHeading}><div><h2>Optional weekly overrides</h2><p>Set optional weekday overrides. Days without an override use your daily study goal; sessions can start any time on their target day.</p></div><FiClock /></div><div className={styles.availabilityForm}><label>Day<select value={availabilityDay} onChange={(event) => setAvailabilityDay(Number(event.target.value))}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Study minutes<input type="text" inputMode="numeric" value={availabilityMinutes} onChange={(event) => setAvailabilityMinutes(event.target.value)} /></label><button type="button" className={styles.addAvailabilityButton} onClick={addAvailability}><FiPlus /> Set duration</button></div>{availability.length === 0 ? <p className={styles.taskEmpty}>No weekly durations saved. Until you add them, your daily study target is used for every day.</p> : <div className={styles.availabilityList}>{availability.map((slot, index) => { const [sh, sm] = slot.startTime.split(':').map(Number); const [eh, em] = slot.endTime.split(':').map(Number); const mins = (eh * 60 + em - sh * 60 - sm + 1440) % 1440; return <div key={`${slot.dayOfWeek}-${index}`}><span>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.dayOfWeek]} - {mins} min/day</span><button type="button" onClick={() => setAvailability((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove study duration"><FiX /></button></div>; })}</div>}{availabilityNotice && <p className={styles.successNote} role="status"><FiCheck /> {availabilityNotice}</p>}<button type="button" className={styles.secondaryBtn} onClick={() => void saveAvailability()} disabled={isSavingAvailability}>{isSavingAvailability ? 'Building sessions...' : 'Save weekly availability'}</button></section>
              <section className={styles.actionCard}><div className={styles.cardIcon}><FiRefreshCw /></div><h2>Adaptive schedule</h2><p>New tasks, missed study time, or changed availability can affect feasibility. Review a fresh proposal before replacing future planner sessions.</p><button type="button" className={styles.secondaryBtn} onClick={() => void handlePreview()} disabled={isGenerating || !semesterId}>{isGenerating ? 'Calculating…' : 'Preview changes'}</button>{!plannerExplanation && <button type="button" className={styles.explainButton} onClick={() => void explainWorkload()} disabled={isExplaining || !semesterId}>{isExplaining ? 'Reviewing verified planner data…' : 'Ask AI to explain workload'}</button>}
                {(plannerExplanation || isExplaining) && <div className={styles.aiExplanation} role="status" aria-live="polite">
                  <div className={styles.aiExplanationHeader}><strong>Planner Assistant <span>Schedule unchanged</span></strong><div>
                    <button type="button" className={styles.explanationAction} onClick={() => void explainWorkload()} disabled={isExplaining || !semesterId}><FiRefreshCw />{isExplaining ? 'Updating…' : 'Regenerate'}</button>
                    <button type="button" className={styles.explanationClose} onClick={closeExplanation} aria-label="Close workload explanation" title="Close"><FiX /></button>
                  </div></div>
                  {plannerExplanation ? <div className={styles.explanationContent}><MarkdownContent content={plannerExplanation} /></div> : <div className={styles.explanationSkeleton} aria-label="Preparing workload explanation"><span /><span /><span /></div>}
                </div>}
              </section>
              <section className={styles.taskPanel}><div className={styles.taskPanelHeading}><h2>Upcoming work</h2><FiBookOpen /></div>{overview.tasks.length === 0 ? <p className={styles.taskEmpty}>Your subject sessions are planned every study day. Add assignments or exams here when you have deadline based work.</p> : overview.tasks.slice().sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).slice(0, 6).map((task) => <article className={styles.taskRow} key={task.id}><div className={styles.taskTitleRow}><strong>{task.title}</strong><span>{task.priorityScore.toFixed(0)} priority</span></div><p>{task.courseName}{task.assignmentTitle ? ` · ${task.assignmentTitle}` : task.examTitle ? ` · Exam: ${task.examTitle}` : ''}</p><div className={styles.taskMeta}><span>Due {formatDatePK(task.deadline)}</span><span>{task.remainingHours.toFixed(1)}h left</span></div><div className={styles.priorityReason}>{priorityExplanation(task) ? `Priority reflects ${priorityExplanation(task)}.` : 'Priority uses your task and course details.'}{task.historicalMultiplier !== 1 && <span> Estimate adjusted {task.historicalMultiplier > 1 ? 'up' : 'down'} using recent session history.</span>}{task.weakestMastery !== null && <span> Weakest recorded topic mastery: {task.weakestMastery.toFixed(0)}%.</span>}</div></article>)}</section>
              {overview.recommendations.length > 0 && <section className={styles.recommendationPanel}><div className={styles.taskPanelHeading}><div><h2>Study recommendations</h2><p>Accepting a recommendation does not change sessions; review the schedule proposal separately.</p></div><FiAlertTriangle /></div>{overview.recommendations.map((recommendation) => <article className={styles.recommendationRow} key={recommendation.id}><strong>{recommendation.title}</strong><p>{recommendation.message}</p><div><button type="button" onClick={() => void updateRecommendation(recommendation, 'dismiss')} disabled={actingRecommendationId === recommendation.id}>{actingRecommendationId === recommendation.id ? 'Saving…' : 'Dismiss'}</button><button type="button" onClick={() => void updateRecommendation(recommendation, 'accept')} disabled={actingRecommendationId === recommendation.id}>Accept</button></div></article>)}</section>}
            </aside>
          </div>
        </>
      )}

      {preview && typeof document !== 'undefined' && createPortal(<div className={styles.dialogOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isApplying) setPreview(null); }}><section className={styles.previewDialog} role="dialog" aria-modal="true" aria-labelledby="planner-preview-title"><button type="button" className={styles.dialogClose} onClick={() => setPreview(null)} disabled={isApplying} aria-label="Close"><FiX /></button><span className={styles.eyebrow}>SCHEDULE REVIEW</span><h2 id="planner-preview-title">Proposed plan for {preview.semester.name}</h2><p className={styles.dialogIntro}>Recommended from your {formatUnscheduledMinutes(Math.round(preview.dailyGoalHours * 60))}/day goal for {preview.courseId ? 'one subject' : 'all subjects'}. Session targets keep their dates, but you can start at any time on the target day. Review conflicts, then apply the plan.</p><div className={styles.previewMetrics}><span><strong>{preview.sessions.length}</strong> sessions</span><span><strong>{preview.capacity.scheduledHours.toFixed(1)}h</strong> scheduled</span><span><strong>{formatUnscheduledMinutes(Math.round(preview.capacity.unscheduledHours * 60))}</strong> will not fit</span></div>{preview.conflicts.length > 0 && <div className={styles.previewConflicts}><strong>Needs your attention</strong>{preview.conflicts.slice(0, 6).map((conflict) => <p key={conflict.taskId}>{conflict.title}: {conflict.reason === 'DEADLINE_PASSED' ? 'deadline has passed' : `${formatUnscheduledMinutes(conflict.unscheduledMinutes)} cannot fit before the deadline`}.</p>)}</div>}<div className={styles.previewSessionList}><strong>Next proposed sessions</strong>{preview.sessions.length === 0 ? <p>No sessions can be placed with this week's study durations and current tasks.</p> : preview.sessions.slice(0, 12).map((session, index) => <div key={`${session.taskId}-${session.startTime}-${index}`}><span>{session.title}</span><time>{formatDatePK(session.startTime, { weekday: 'short', month: 'short', day: 'numeric' })} · {session.durationHours.toFixed(1)}h</time></div>)}</div><div className={styles.dialogActions}><button type="button" className={styles.outlineButton} onClick={() => setPreview(null)} disabled={isApplying}>Keep current schedule</button><button type="button" className={styles.primaryActionBtn} onClick={() => void applyPreview()} disabled={isApplying || preview.sessions.length === 0}><FiCheck />{isApplying ? 'Applying…' : 'Apply reviewed plan'}</button></div></section></div>, document.body)}
    </main>
  );
}
