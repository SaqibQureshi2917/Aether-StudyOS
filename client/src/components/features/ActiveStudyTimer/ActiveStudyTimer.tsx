'use client';

import { PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { FiCheck, FiPause, FiPlay } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/apiClient';
import ConfirmDialog from '@/components/layout/ConfirmDialog/ConfirmDialog';
import { useToast } from '@/components/layout/toast/ToastContext';
import styles from './ActiveStudyTimer.module.css';

type ActiveSession = {
  id: string; status: 'IN_PROGRESS' | 'PAUSED'; startedAt: string; pausedAt: string | null; pauseDuration: number;
  task: { title: string; course: { name: string } };
};
type Response<T> = { success: boolean; data: T };

export default function ActiveStudyTimer() {
  const router = useRouter();
  const { showToast } = useToast();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPartialFollowup, setShowPartialFollowup] = useState(false);
  const [position, setPosition] = useState<{ left: number | null; top: number }>({ left: null, top: 86 });
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await apiRequest<Response<{ session: ActiveSession | null }>>('/sessions/active', 'GET');
      setSession(response.data.session);
    } catch { /* Keep the visible timer on temporary network failures. */ }
  }, []);

  useEffect(() => {
    void load();
    const refreshFromOtherViews = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.source === 'timer') return;
      void load();
    };
    window.addEventListener('studyos:session-updated', refreshFromOtherViews);
    window.addEventListener('focus', load);
    try {
      const saved = localStorage.getItem('studyos-timer-position');
      if (saved) {
        const parsed = JSON.parse(saved) as { left?: unknown; top?: unknown };
        if ((parsed.left === null || typeof parsed.left === 'number') && typeof parsed.top === 'number') setPosition({ left: parsed.left as number | null, top: parsed.top });
      }
    } catch { /* Keep the default floating position. */ }
    return () => { window.removeEventListener('studyos:session-updated', refreshFromOtherViews); window.removeEventListener('focus', load); };
  }, [load]);

  useEffect(() => {
    if (session?.status !== 'IN_PROGRESS') return;
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, [session?.status]);

  const act = async (action: 'pause' | 'resume' | 'complete') => {
    if (!session || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiRequest<Response<{ isPartial?: boolean; session?: ActiveSession }>>(`/sessions/${action}`, 'POST', { sessionId: session.id });
      if (action === 'complete') {
        setSession(null);
        if (response.data?.isPartial) setShowPartialFollowup(true);
        else showToast('Study session complete. Your progress has been saved.', 'success');
      }
      else if (response.data?.session) setSession(response.data.session);
      else setSession({ ...session, status: action === 'pause' ? 'PAUSED' : 'IN_PROGRESS' });
      if (action === 'pause') showToast('Study session paused. Resume whenever you are ready.', 'info');
      if (action === 'resume') showToast('Study session resumed. Your timer is running.', 'success');
      window.dispatchEvent(new CustomEvent('studyos:session-updated', { detail: { source: 'timer', action, session: response.data?.session, isPartial: response.data?.isPartial } }));
    } catch (cause) { setError(cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string' ? cause.message : 'Session update failed.'); }
    finally { setBusy(false); }
  };

  const moveStart = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const left = Math.max(8, Math.min(window.innerWidth - 300, drag.current.left + event.clientX - drag.current.x));
    const top = Math.max(70, Math.min(window.innerHeight - 130, drag.current.top + event.clientY - drag.current.y));
    const next = { left, top };
    setPosition(next);
    try { localStorage.setItem('studyos-timer-position', JSON.stringify(next)); } catch { /* The timer remains movable until the page closes. */ }
  };

  if (!session) return <>{showPartialFollowup && <ConfirmDialog title="Session saved early" description="Your study time has been recorded. Would you like to review the remaining study time and adjust your planner?" confirmLabel="Review planner" cancelLabel="Stay here" busyLabel="Opening planner…" onConfirm={() => { setShowPartialFollowup(false); router.push('/dashboard/planner'); }} onCancel={() => setShowPartialFollowup(false)} />} </>;
  const pausedMilliseconds = session.pauseDuration * 60_000 + (session.status === 'PAUSED' && session.pausedAt ? now - new Date(session.pausedAt).getTime() : 0);
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(session.startedAt).getTime() - pausedMilliseconds) / 1000));
  const display = `${String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0')}:${String(Math.floor(elapsedSeconds % 3600 / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
  return <><aside className={styles.timer} style={{ top: position.top, ...(position.left === null ? { right: 16 } : { left: position.left }) }} aria-label="Active study timer">
    <div className={styles.handle} onPointerDown={moveStart} onPointerMove={move} onPointerUp={() => { drag.current = null; }}>
      <div className={styles.heading}><span className={session.status === 'IN_PROGRESS' ? styles.live : styles.paused} /> <strong>{session.status === 'PAUSED' ? 'Session paused' : 'Study session'}</strong></div>
      <span className={styles.subject}>{session.task.course.name}</span>
      <strong className={styles.task}>{session.task.title}</strong>
      <span className={styles.time}>{display}</span>
      <span className={styles.dragHint}>Drag this panel to move it</span>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>
      {session.status === 'IN_PROGRESS' ? <button type="button" disabled={busy} onClick={() => void act('pause')} aria-label="Pause session"><FiPause /> Pause</button> : <button type="button" disabled={busy} onClick={() => void act('resume')} aria-label="Resume session"><FiPlay /> Resume</button>}
      <button type="button" disabled={busy} onClick={() => void act('complete')} aria-label="Complete session"><FiCheck /> Complete</button>
    </div>
  </aside>{showPartialFollowup && <ConfirmDialog title="Session saved early" description="Your study time has been recorded. Would you like to review the remaining study time and adjust your planner?" confirmLabel="Review planner" cancelLabel="Stay here" busyLabel="Opening planner…" onConfirm={() => { setShowPartialFollowup(false); router.push('/dashboard/planner'); }} onCancel={() => setShowPartialFollowup(false)} />}</>;
}
