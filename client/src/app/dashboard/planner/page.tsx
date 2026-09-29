'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiAlertTriangle, FiArrowLeft, FiArrowRight, FiBookOpen, FiCalendar, FiCheck, FiClock, FiPlus, FiRefreshCw, FiX } from 'react-icons/fi';
import { apiRequest } from '@/lib/apiClient';
import styles from './planner.module.css';

type Semester = { id: string; name: string; status: string; startDate: string; endDate: string | null };
type AvailabilitySlot = { dayOfWeek: number; startTime: string; endTime: string; isBlocked: boolean };
type Task = { id: string; title: string; courseId: string; courseName: string; assignmentTitle: string | null; examTitle: string | null; isVirtualExam: boolean; deadline: string; estimatedHours: number; completedHours: number; baselineRemainingHours: number; remainingHours: number; historicalMultiplier: number; priorityScore: number; priorityBreakdown: { factors: Record<string, number>; weights: Record<string, number> }; weakestMastery: number | null };
type ScheduleConflict = { taskId: string; title: string; deadline: string; remainingHours: number; unscheduledHours: number; reason: 'DEADLINE_PASSED' | 'INSUFFICIENT_CAPACITY' };
type StudySession = {
  id: string; scheduledStart: string; scheduledEnd: string; plannedDuration: number; actualDuration: number | null; status: string; startedAt: string | null;
  task: { id: string; title: string; assignment?: { title: string } | null; course: { id: string; name: string; colorCode: string | null } };
};
type PlannerRecommendation = { id: string; type: string; title: string; message: string; severity: string; relatedTaskId: string | null; relatedCourseId: string | null; status: string };
type Overview = {
  semester: Semester; horizon: { endDateAssumed: boolean; endDate: string }; tasks: Task[]; sessions: StudySession[];
  capacity: { availableHours: number; scheduledHours: number; unscheduledHours: number; taskCount: number; sessionCount: number; conflictCount: number };
  conflicts: ScheduleConflict[];
  recommendations: PlannerRecommendation[];
};
type Preview = { previewHash: string; semester: { id: string; name: string }; sessions: Array<{ taskId: string; title: string; startTime: string; endTime: string; durationHours: number }>; conflicts: ScheduleConflict[]; capacity: { availableHours: number; scheduledHours: number; unscheduledHours: number } };
type ApiResult<T> = { success: boolean; data: T };

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
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
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [view, setView] = useState<'WEEK' | 'DAY'>('WEEK');
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [selectedCourse, setSelectedCourse] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [actingSessionId, setActingSessionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [availabilityDay, setAvailabilityDay] = useState(1);
  const [availabilityStart, setAvailabilityStart] = useState('18:00');
  const [availabilityEnd, setAvailabilityEnd] = useState('19:00');
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [availabilityNotice, setAvailabilityNotice] = useState('');
  const [timeZone, setTimeZone] = useState('UTC');
  const [plannerExplanation, setPlannerExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [actingRecommendationId, setActingRecommendationId] = useState<string | null>(null);

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
    setSemesterId((current) => current && list.some((semester) => semester.id === current)
      ? current
      : (list.find((semester) => semester.status === 'ACTIVE') || list[0])?.id || '');
    return list;
  }, []);

  const loadAvailability = useCallback(async () => {
    const response = await apiRequest<ApiResult<{ slots: AvailabilitySlot[] }>>('/planner/availability', 'GET');
    setAvailability(response.data?.slots || []);
  }, []);

  const loadOverview = useCallback(async (id = semesterId) => {
    if (!id) { setOverview(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ semesterId: id, from: dateRange.from, to: dateRange.to, timeZone });
      const response = await apiRequest<ApiResult<Overview>>(`/planner/overview?${query.toString()}`, 'GET');
      setOverview(response.data);
    } catch (err: unknown) {
      setError(errorText(err, 'Could not load your semester plan. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, semesterId, timeZone]);

  useEffect(() => {
    // Load the authenticated semester list as an external data synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSemesters().catch((err: unknown) => {
      setError(errorText(err, 'Could not load your semesters.'));
      setLoading(false);
    });
  }, [loadSemesters]);

  useEffect(() => {
    // Read the browser's external timezone setting for planner calculations.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);

  useEffect(() => {
    // Load persisted weekly availability into the planner form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAvailability().catch(() => setAvailability([]));
  }, [loadAvailability]);

  useEffect(() => {
    // Keep the visible calendar synchronized with the selected semester and date range.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (semesterId) void loadOverview(semesterId);
  }, [semesterId, dateRange, loadOverview]);

  const changeDate = (amount: number) => {
    const date = new Date(`${selectedDate}T00:00:00`);
    date.setDate(date.getDate() + amount * (view === 'WEEK' ? 7 : 1));
    setSelectedDate(localDateKey(date));
  };

  const handlePreview = async () => {
    if (!semesterId) { setError('Create a semester before planning your study schedule.'); return; }
    setIsGenerating(true);
    setError('');
    try {
      const response = await apiRequest<ApiResult<Preview>>('/planner/preview', 'POST', { semesterId, timeZone });
      setPreview(response.data);
    } catch (err: unknown) {
      setError(errorText(err, 'Could not create a schedule preview. Check your study availability and try again.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const applyPreview = async () => {
    if (!preview || isApplying) return;
    setIsApplying(true);
    setError('');
    try {
      await apiRequest('/planner/apply', 'POST', { semesterId: preview.semester.id, previewHash: preview.previewHash, timeZone });
      setPreview(null);
      await loadOverview(preview.semester.id);
    } catch (err: unknown) {
      setError(errorText(err, 'The schedule could not be applied. Review a fresh preview and try again.'));
      if (err && typeof err === 'object' && 'status' in err && err.status === 409) setPreview(null);
    } finally {
      setIsApplying(false);
    }
  };

  const actOnSession = async (session: StudySession, action: 'start' | 'complete' | 'missed') => {
    setActingSessionId(session.id);
    setError('');
    try {
      await apiRequest(`/sessions/${action}`, 'POST', { sessionId: session.id });
      await loadOverview();
    } catch (err: unknown) {
      setError(errorText(err, 'This study session could not be updated. Refresh and try again.'));
    } finally {
      setActingSessionId(null);
    }
  };

  const saveAvailability = async () => {
    setIsSavingAvailability(true);
    setError('');
    setAvailabilityNotice('');
    try {
      const response = await apiRequest<ApiResult<{ slots: AvailabilitySlot[] }>>('/planner/availability', 'PUT', { slots: availability });
      setAvailability(response.data?.slots || []);
      setAvailabilityNotice('Your weekly study hours have been saved.');
      if (semesterId) await loadOverview(semesterId);
    } catch (err: unknown) {
      setError(errorText(err, 'Your weekly study hours could not be saved.'));
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const addAvailability = () => {
    if (availabilityStart === availabilityEnd) { setError('Choose different start and end times.'); return; }
    if (availability.length >= 42) { setError('You can add up to 42 weekly study windows.'); return; }
    setAvailability((current) => [...current, { dayOfWeek: availabilityDay, startTime: availabilityStart, endTime: availabilityEnd, isBlocked: false }]
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)));
    setError('');
    setAvailabilityNotice('');
  };

  const explainWorkload = async () => {
    if (!semesterId || isExplaining) return;
    setIsExplaining(true);
    setError('');
    setPlannerExplanation('');
    try {
      const response = await apiRequest<ApiResult<{ explanation: string; scheduleChanged: boolean }>>('/planner/explain', 'POST', { semesterId, timeZone });
      setPlannerExplanation(response.data.explanation);
    } catch (err: unknown) {
      setError(errorText(err, 'The planner explanation is temporarily unavailable. Your schedule is unchanged.'));
    } finally {
      setIsExplaining(false);
    }
  };

  const updateRecommendation = async (recommendation: PlannerRecommendation, action: 'accept' | 'dismiss') => {
    if (actingRecommendationId) return;
    setActingRecommendationId(recommendation.id);
    setError('');
    try {
      await apiRequest(`/recommendations/${recommendation.id}/${action}`, 'POST', {});
      await loadOverview();
      if (action === 'accept') setAvailabilityNotice('Recommendation accepted. Review a fresh schedule preview before applying session changes.');
    } catch (err: unknown) {
      setError(errorText(err, 'This planner recommendation could not be updated.'));
    } finally {
      setActingRecommendationId(null);
    }
  };

  const allSessions = overview?.sessions || [];
  const visibleSessions = allSessions.filter((session) => {
    const matchesDate = view === 'DAY'
      ? localDateKey(new Date(session.scheduledStart)) === selectedDate
      : (() => { const weekStart = startOfWeek(new Date(`${selectedDate}T00:00:00`)); const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7); return new Date(session.scheduledStart) >= weekStart && new Date(session.scheduledStart) < weekEnd; })();
    return matchesDate && (selectedCourse === 'ALL' || session.task.course.id === selectedCourse);
  });
  const rangeLabel = view === 'DAY'
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    : (() => { const start = startOfWeek(new Date(`${selectedDate}T00:00:00`)); const end = new Date(start); end.setDate(end.getDate() + 6); return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}`; })();

  return (
    <main className={styles.plannerContainer}>
      <header className={styles.plannerHeader}>
        <div>
          <span className={styles.eyebrow}>SEMESTER PLANNER</span>
          <h1 className={styles.title}>Your study plan</h1>
          <p className={styles.subtitle}>Plan your workload, track study sessions, and review schedule changes before they are applied.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.outlineButton} onClick={() => router.push('/dashboard/assignments?action=new')}><FiPlus /> Add assignment</button>
          <button type="button" className={styles.primaryActionBtn} onClick={() => void handlePreview()} disabled={isGenerating || !semesterId}><FiRefreshCw className={isGenerating ? styles.spinning : ''} />{isGenerating ? 'Building preview…' : 'Review schedule'}</button>
        </div>
      </header>

      {error && <div className={styles.errorBanner} role="alert"><FiAlertTriangle /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss"><FiX /></button></div>}

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
        <section className={styles.emptyPanel}><div className={styles.emptyIcon}><FiCalendar /></div><h2>Set up a semester to start planning</h2><p>Add a semester, subjects, study tasks, and weekly availability. The planner will use those details to create a realistic proposal.</p><button type="button" className={styles.primaryActionBtn} onClick={() => router.push('/onboarding')}>Open semester setup</button></section>
      )}

      {loading && <div className={styles.loadingPanel} role="status">Loading your semester plan…</div>}

      {!loading && overview && (
        <>
          {(() => {
            const completedSessions = overview.sessions.filter((session) => session.status === 'COMPLETED').length;
            const progressPercent = overview.capacity.sessionCount ? Math.round(completedSessions / overview.capacity.sessionCount * 100) : 0;
            return <section className={styles.metricsGrid} aria-label="Semester workload summary">
              <article className={styles.metricCard}><span>Open study tasks</span><strong>{overview.capacity.taskCount}</strong><small>Based on remaining task effort</small></article>
              <article className={styles.metricCard}><span>Available study time</span><strong>{overview.capacity.availableHours.toFixed(1)}h</strong><small>Across your semester availability</small></article>
              <article className={styles.metricCard}><span>Session progress in this view</span><strong>{completedSessions}/{overview.capacity.sessionCount}</strong><div className={styles.progressTrack} role="progressbar" aria-label="Completed study sessions in the selected calendar view" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progressPercent}%` }} /></div><small>{progressPercent}% of listed sessions completed</small></article>
              <article className={`${styles.metricCard} ${overview.capacity.conflictCount ? styles.metricWarning : ''}`}><span>Workload conflicts</span><strong>{overview.capacity.conflictCount}</strong><small>{overview.capacity.unscheduledHours.toFixed(1)}h cannot fit before current deadlines</small></article>
            </section>;
          })()}

          {overview.conflicts.length > 0 && <section className={styles.conflictPanel} aria-label="Workload conflicts"><div className={styles.conflictHeading}><FiAlertTriangle /><div><strong>Some tasks do not fit before their deadlines</strong><p>Review the tasks below. The planner leaves unworkable effort visible instead of scheduling it past a deadline.</p></div></div><div className={styles.conflictList}>{overview.conflicts.slice(0, 5).map((conflict) => <div key={conflict.taskId}><strong>{conflict.title}</strong><span>{conflict.reason === 'DEADLINE_PASSED' ? 'Deadline has passed' : `${conflict.unscheduledHours.toFixed(1)}h do not fit`} · Due {new Date(conflict.deadline).toLocaleDateString()}</span></div>)}</div></section>}

          <div className={styles.plannerGrid}>
            <section className={styles.timelineSection}>
              <div className={styles.sectionHeader}><div><h2>Study schedule</h2><p>Start or complete sessions here. Your progress is saved to your study history.</p></div><div className={styles.viewSwitch}><button type="button" className={view === 'WEEK' ? styles.viewActive : ''} onClick={() => setView('WEEK')}>Week</button><button type="button" className={view === 'DAY' ? styles.viewActive : ''} onClick={() => setView('DAY')}>Day</button></div></div>
              <div className={styles.calendarToolbar}><button type="button" onClick={() => changeDate(-1)} aria-label="Previous"><FiArrowLeft /></button><strong>{rangeLabel}</strong><button type="button" onClick={() => changeDate(1)} aria-label="Next"><FiArrowRight /></button><button type="button" className={styles.todayButton} onClick={() => setSelectedDate(localDateKey(new Date()))}>Today</button><select aria-label="Filter by subject" value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)}><option value="ALL">All subjects</option>{overview.tasks.filter((task, index, all) => all.findIndex((item) => item.courseId === task.courseId) === index).map((task) => <option key={task.courseId} value={task.courseId}>{task.courseName}</option>)}</select></div>
              {visibleSessions.length === 0 ? <div className={styles.emptySchedule}><FiCalendar /><strong>No sessions in this {view === 'DAY' ? 'day' : 'week'}</strong><span>Review a schedule proposal or choose another date.</span></div> : <div className={styles.sessionList}>{visibleSessions.map((session) => {
                const busy = actingSessionId === session.id;
                const start = new Date(session.scheduledStart);
                const end = new Date(session.scheduledEnd);
                const canMiss = session.status === 'SCHEDULED' && end <= new Date();
                return <article key={session.id} className={styles.sessionCard}>
                  <div className={styles.sessionTime}><FiClock /><strong>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong><span>{start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
                  <div className={styles.sessionDetails}><span className={styles.courseLabel} style={{ borderColor: session.task.course.colorCode || undefined }}>{session.task.course.name}</span><h3>{session.task.title}</h3><p>{session.task.assignment?.title || 'Study task'} · {session.plannedDuration.toFixed(1)}h planned</p></div>
                  <div className={styles.sessionActions}><span className={`${styles.statusBadge} ${styles[`status${session.status}`] || ''}`}>{session.status.replaceAll('_', ' ').toLowerCase()}</span>{session.status === 'SCHEDULED' && <button type="button" disabled={busy} onClick={() => void actOnSession(session, canMiss ? 'missed' : 'start')}>{busy ? 'Saving…' : canMiss ? 'Mark missed' : 'Start'}</button>}{session.status === 'IN_PROGRESS' && <button type="button" disabled={busy} onClick={() => void actOnSession(session, 'complete')}>{busy ? 'Saving…' : 'Complete'}</button>}</div>
                </article>;
              })}</div>}
            </section>

            <aside className={styles.sidebarSection}>
              <section className={styles.availabilityCard}><div className={styles.taskPanelHeading}><div><h2>Weekly study hours</h2><p>Choose the times that are genuinely available for study.</p></div><FiClock /></div><div className={styles.availabilityForm}><label>Day<select value={availabilityDay} onChange={(event) => setAvailabilityDay(Number(event.target.value))}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>From<input type="time" value={availabilityStart} onChange={(event) => setAvailabilityStart(event.target.value)} /></label><label>To<input type="time" value={availabilityEnd} onChange={(event) => setAvailabilityEnd(event.target.value)} /></label><button type="button" className={styles.addAvailabilityButton} onClick={addAvailability}><FiPlus /> Add</button></div>{availability.length === 0 ? <p className={styles.taskEmpty}>No weekly study hours yet. Add your available times to preview a feasible schedule.</p> : <div className={styles.availabilityList}>{availability.map((slot, index) => <div key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}><span>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.dayOfWeek]} · {slot.startTime}–{slot.endTime}</span><button type="button" onClick={() => setAvailability((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove study hours"><FiX /></button></div>)}</div>}{availabilityNotice && <p className={styles.successNote} role="status"><FiCheck /> {availabilityNotice}</p>}<button type="button" className={styles.secondaryBtn} onClick={() => void saveAvailability()} disabled={isSavingAvailability}>{isSavingAvailability ? 'Saving…' : 'Save weekly hours'}</button></section>
              <section className={styles.actionCard}><div className={styles.cardIcon}><FiRefreshCw /></div><h2>Adaptive schedule</h2><p>New tasks, missed study time, or changed availability can affect feasibility. Review a fresh proposal before replacing future planner sessions.</p><button type="button" className={styles.secondaryBtn} onClick={() => void handlePreview()} disabled={isGenerating || !semesterId}>{isGenerating ? 'Calculating…' : 'Preview changes'}</button><button type="button" className={styles.explainButton} onClick={() => void explainWorkload()} disabled={isExplaining || !semesterId}>{isExplaining ? 'Reviewing verified planner data…' : 'Ask AI to explain workload'}</button>{plannerExplanation && <div className={styles.aiExplanation} role="status"><strong>Planner Assistant · schedule unchanged</strong><p>{plannerExplanation}</p></div>}</section>
              <section className={styles.taskPanel}><div className={styles.taskPanelHeading}><h2>Upcoming work</h2><FiBookOpen /></div>{overview.tasks.length === 0 ? <p className={styles.taskEmpty}>No remaining study tasks found. Add assignments or exams to plan your workload.</p> : overview.tasks.slice().sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).slice(0, 6).map((task) => <article className={styles.taskRow} key={task.id}><div className={styles.taskTitleRow}><strong>{task.title}</strong><span>{task.priorityScore.toFixed(0)} priority</span></div><p>{task.courseName}{task.assignmentTitle ? ` · ${task.assignmentTitle}` : task.examTitle ? ` · Exam: ${task.examTitle}` : ''}</p><div className={styles.taskMeta}><span>Due {new Date(task.deadline).toLocaleDateString()}</span><span>{task.remainingHours.toFixed(1)}h left</span></div><div className={styles.priorityReason}>{priorityExplanation(task) ? `Priority reflects ${priorityExplanation(task)}.` : 'Priority uses your task and course details.'}{task.historicalMultiplier !== 1 && <span> Estimate adjusted {task.historicalMultiplier > 1 ? 'up' : 'down'} using recent session history.</span>}{task.weakestMastery !== null && <span> Weakest recorded topic mastery: {task.weakestMastery.toFixed(0)}%.</span>}</div></article>)}</section>
              {overview.recommendations.length > 0 && <section className={styles.recommendationPanel}><div className={styles.taskPanelHeading}><div><h2>Study recommendations</h2><p>Accepting a recommendation does not change sessions; review the schedule proposal separately.</p></div><FiAlertTriangle /></div>{overview.recommendations.map((recommendation) => <article className={styles.recommendationRow} key={recommendation.id}><strong>{recommendation.title}</strong><p>{recommendation.message}</p><div><button type="button" onClick={() => void updateRecommendation(recommendation, 'dismiss')} disabled={actingRecommendationId === recommendation.id}>{actingRecommendationId === recommendation.id ? 'Saving…' : 'Dismiss'}</button><button type="button" onClick={() => void updateRecommendation(recommendation, 'accept')} disabled={actingRecommendationId === recommendation.id}>Accept</button></div></article>)}</section>}
            </aside>
          </div>
        </>
      )}

      {preview && <div className={styles.dialogOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isApplying) setPreview(null); }}><section className={styles.previewDialog} role="dialog" aria-modal="true" aria-labelledby="planner-preview-title"><button type="button" className={styles.dialogClose} onClick={() => setPreview(null)} disabled={isApplying} aria-label="Close"><FiX /></button><span className={styles.eyebrow}>SCHEDULE REVIEW</span><h2 id="planner-preview-title">Proposed plan for {preview.semester.name}</h2><p className={styles.dialogIntro}>This preview does not change your saved sessions. Apply it only after reviewing the proposed sessions and deadline conflicts.</p><div className={styles.previewMetrics}><span><strong>{preview.sessions.length}</strong> sessions</span><span><strong>{preview.capacity.scheduledHours.toFixed(1)}h</strong> scheduled</span><span><strong>{preview.capacity.unscheduledHours.toFixed(1)}h</strong> will not fit</span></div>{preview.conflicts.length > 0 && <div className={styles.previewConflicts}><strong>Needs your attention</strong>{preview.conflicts.slice(0, 6).map((conflict) => <p key={conflict.taskId}>{conflict.title}: {conflict.reason === 'DEADLINE_PASSED' ? 'deadline has passed' : `${conflict.unscheduledHours.toFixed(1)}h cannot fit before the deadline`}.</p>)}</div>}<div className={styles.previewSessionList}><strong>Next proposed sessions</strong>{preview.sessions.length === 0 ? <p>No sessions can be placed with your current tasks and availability.</p> : preview.sessions.slice(0, 12).map((session, index) => <div key={`${session.taskId}-${session.startTime}-${index}`}><span>{session.title}</span><time>{new Date(session.startTime).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {session.durationHours.toFixed(1)}h</time></div>)}</div><div className={styles.dialogActions}><button type="button" className={styles.outlineButton} onClick={() => setPreview(null)} disabled={isApplying}>Keep current schedule</button><button type="button" className={styles.primaryActionBtn} onClick={() => void applyPreview()} disabled={isApplying || preview.sessions.length === 0}><FiCheck />{isApplying ? 'Applying…' : 'Apply reviewed plan'}</button></div></section></div>}
    </main>
  );
}
