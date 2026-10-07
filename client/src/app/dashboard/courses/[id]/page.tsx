'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { apiRequest, downloadApiFile } from '@/lib/apiClient';
import { formatDatePK, formatDateTimePK } from '@/lib/dateFormat';
import PageSkeleton from '@/components/layout/PageSkeleton/PageSkeleton';
import ConfirmDialog from '@/components/layout/ConfirmDialog/ConfirmDialog';
import styles from './subject.module.css';

type Subject = { id: string; name: string; code: string | null; instructor: string | null; description: string | null; status: string; outlineReviewedAt: string | null; semester: { id: string; name: string }; learningTopics: Array<{ id: string; title: string; sequence: number; estimatedMinutes: number; source: string; materialCovered: boolean }>; assignments: Array<{ id: string; title: string; deadline: string; status: string }>; exams: Array<{ id: string; title: string; date: string }>; studyTasks: Array<{ id: string; title: string; sessions: Array<{ id: string; scheduledStart: string; scheduledEnd: string; plannedDuration: number; status: string; startedAt: string | null; actualDuration?: number | null }> }> };
type Draft = { title: string; description?: string | null; deadline?: string | null; difficulty?: string; estimatedHours?: number; confidence?: number };
type Material = { id: string; title: string; fileType: string | null; fileSizeBytes: number; isIndexed: boolean; processingStatus: string; createdAt: string; metadata?: { assignmentDraft?: Draft | null; confirmedAssignmentId?: string } | null };
type OutlineTopic = { title: string; estimatedMinutes: number };
type OutlinePreview = { hasMaterials: boolean; materialTitles: string[]; materialTopics: OutlineTopic[]; additionalTopics: OutlineTopic[] };
type ApiResponse<T> = { success: boolean; data: T; message?: string };

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function errorText(error: unknown, fallback: string) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : fallback;
}

export default function SubjectWorkspacePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [subject, setSubject] = useState<Subject | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPartialFollowup, setShowPartialFollowup] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [pendingMaterialDelete, setPendingMaterialDelete] = useState<Material | null>(null);
  const [materialDeleteError, setMaterialDeleteError] = useState('');
  const [outlinePreview, setOutlinePreview] = useState<OutlinePreview | null>(null);
  const [outlineScope, setOutlineScope] = useState<'MATERIAL_ONLY' | 'FULL_COURSE'>('FULL_COURSE');

  const load = useCallback(async (showSetupNotice = false) => {
    const [subjectResponse, materialsResponse] = await Promise.all([
      apiRequest<ApiResponse<{ course: Subject }>>(`/courses/${id}`, 'GET'),
      apiRequest<ApiResponse<{ materials: Material[] }>>(`/materials?courseId=${encodeURIComponent(id)}`, 'GET'),
    ]);
    const loadedSubject = subjectResponse.data.course;
    const loadedMaterials = materialsResponse.data.materials || [];
    setSubject(loadedSubject);
    setMaterials(loadedMaterials);
    if (showSetupNotice && loadedMaterials.length > 0 && !loadedSubject.outlineReviewedAt) setNotice('Your materials are ready. Select “Build course outline” to review their topics for the planner.');
    else if (showSetupNotice && loadedSubject.learningTopics.length === 0) setNotice('Select “Build course outline” when you are ready to prepare this subject’s daily study topics.');
  }, [id]);

  useEffect(() => {
    // Load authenticated subject data as an external synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(true).catch((cause: unknown) => setError(errorText(cause, 'Could not load this subject.')));
  }, [load]);

  useEffect(() => {
    const syncTimerAction = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail?.source !== 'timer' || !event.detail.session?.id) return;
      const updated = event.detail.session as { id: string; status: string; startedAt?: string | null; actualDuration?: number | null };
      setSubject((current) => current ? ({ ...current, studyTasks: current.studyTasks.map((task) => ({ ...task, sessions: task.sessions.map((session) => session.id === updated.id ? { ...session, status: updated.status, startedAt: updated.startedAt ?? session.startedAt, actualDuration: updated.actualDuration ?? session.actualDuration } : session) })) }) : current);
    };
    window.addEventListener('studyos:session-updated', syncTimerAction);
    return () => window.removeEventListener('studyos:session-updated', syncTimerAction);
  }, []);

  useEffect(() => {
    const nextLocalDay = new Date();
    nextLocalDay.setHours(24, 0, 0, 50);
    const clock = window.setTimeout(() => setCurrentTime(Date.now()), Math.max(1, nextLocalDay.getTime() - Date.now()));
    return () => window.clearTimeout(clock);
  }, [currentTime]);

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) { setError('Choose a file to upload.'); return; }
    const body = new FormData();
    body.append('file', file);
    body.append('courseId', id);
    if (title.trim()) body.append('title', title.trim());
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await apiRequest<ApiResponse<unknown>>('/materials/upload', 'POST', body);
      setNotice(response.message || 'Material uploaded.');
      setFile(null); setTitle('');
      const input = document.getElementById('subject-material-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
    } catch (cause: unknown) { setError(errorText(cause, 'The material could not be uploaded.')); }
    finally { setBusy(false); }
  };

  const updateSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest(`/courses/${id}`, 'PUT', { name: form.get('name'), code: form.get('code'), instructor: form.get('instructor'), description: form.get('description') });
      setNotice('Subject details saved.'); await load();
    } catch (cause: unknown) { setError(errorText(cause, 'Subject details could not be saved.')); }
    finally { setBusy(false); }
  };

  const download = async (material: Material) => {
    try {
      const result = await downloadApiFile(`/materials/${material.id}/download`);
      const objectUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = result.filename || material.title; anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (cause: unknown) { setError(errorText(cause, 'The file could not be downloaded.')); }
  };

  const rename = async (material: Material) => {
    const nextTitle = window.prompt('Document title', material.title)?.trim();
    if (!nextTitle || nextTitle === material.title) return;
    setBusy(true); setError('');
    try { await apiRequest(`/materials/${material.id}`, 'PATCH', { title: nextTitle }); setNotice('Document renamed.'); await load(); }
    catch (cause: unknown) { setError(errorText(cause, 'The document could not be renamed.')); }
    finally { setBusy(false); }
  };

  const remove = async (material: Material) => {
    setMaterialDeleteError('');
    setPendingMaterialDelete(material);
  };

  const confirmRemove = async () => {
    if (!pendingMaterialDelete) return;
    setBusy(true); setMaterialDeleteError('');
    try {
      await apiRequest(`/materials/${pendingMaterialDelete.id}`, 'DELETE');
      setPendingMaterialDelete(null); setNotice('Document deleted.'); await load();
    } catch (cause: unknown) { setMaterialDeleteError(errorText(cause, 'The document could not be deleted.')); }
    finally { setBusy(false); }
  };

  const confirmAssignment = async (material: Material) => {
    if (!deadline) { setError('Choose the assignment deadline that you reviewed in the source document.'); return; }
    setBusy(true); setError('');
    try {
      await apiRequest(`/materials/${material.id}/confirm-assignment`, 'POST', { deadline: new Date(deadline).toISOString() });
      setNotice('Assignment confirmed and added to your assignments.'); setDeadline(''); await load();
    } catch (cause: unknown) { setError(errorText(cause, 'Assignment draft could not be confirmed.')); }
    finally { setBusy(false); }
  };

  const actOnSession = async (session: NonNullable<Subject['studyTasks'][number]['sessions'][number]>, action: 'start' | 'complete' | 'missed') => {
    let actualMinutes: number | undefined;
    if (action === 'complete') {
      const value = window.prompt('Actual study time in minutes (1–720):', String(Math.min(Math.round(session.plannedDuration * 60), 720)));
      if (value === null) return;
      actualMinutes = Number(value);
      if (!Number.isInteger(actualMinutes) || actualMinutes < 1 || actualMinutes > 720) { setError('Enter a whole number from 1 to 720 minutes.'); return; }
    }
    setBusy(true); setError('');
    try {
      const response = await apiRequest<ApiResponse<{ isPartial?: boolean }>>(`/sessions/${action}`, 'POST', { sessionId: session.id, ...(action === 'start' || action === 'missed' ? { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } : {}), ...(actualMinutes === undefined ? {} : { actualMinutes }) });
      const nextStatus = action === 'start' ? 'IN_PROGRESS' : action === 'missed' ? 'MISSED' : response.data?.isPartial ? 'PARTIALLY_COMPLETED' : 'COMPLETED';
      setSubject((current) => current ? ({ ...current, studyTasks: current.studyTasks.map((task) => ({ ...task, sessions: task.sessions.map((item) => item.id === session.id ? { ...item, status: nextStatus, ...(action === 'start' ? { startedAt: new Date().toISOString() } : {}) } : item) })) }) : current);
      window.dispatchEvent(new Event('studyos:session-updated'));
      setNotice(action === 'start' ? 'Today’s study session has started.' : action === 'missed' ? 'Session marked missed. Its history has been saved.' : response.data?.isPartial ? 'Your completed study time has been saved.' : 'Study session complete. Your progress has been saved.');
      if (action === 'complete' && response.data?.isPartial) setShowPartialFollowup(true);
    }
    catch (cause: unknown) { setError(errorText(cause, 'This study session could not be updated.')); }
    finally { setBusy(false); }
  };

  const reindex = async (material: Material) => {
    setBusy(true); setError('');
    try { await apiRequest(`/materials/${material.id}/index`, 'POST'); setNotice('Document is ready for Tutor search.'); await load(); }
    catch (cause: unknown) { setError(errorText(cause, 'Document indexing failed.')); await load().catch(() => undefined); }
    finally { setBusy(false); }
  };

  const previewOutline = async () => {
    setBusy(true); setError(''); setOutlinePreview(null);
    try {
      const response = await apiRequest<ApiResponse<OutlinePreview>>(`/courses/${id}/outline-preview`, 'POST', {});
      setOutlinePreview(response.data);
      setOutlineScope(response.data.hasMaterials && response.data.additionalTopics.length === 0 ? 'MATERIAL_ONLY' : 'FULL_COURSE');
    } catch (cause: unknown) { setError(errorText(cause, 'The course outline could not be prepared.')); }
    finally { setBusy(false); }
  };

  const saveOutline = async () => {
    if (!outlinePreview) return;
    const chosen = outlineScope === 'MATERIAL_ONLY' ? outlinePreview.materialTopics : [...outlinePreview.materialTopics, ...outlinePreview.additionalTopics];
    const seen = new Set<string>();
    const topics = chosen.filter((topic) => { const key = topic.title.toLocaleLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
      .map((topic) => ({ ...topic, materialCovered: outlinePreview.materialTopics.some((covered) => covered.title.toLocaleLowerCase() === topic.title.toLocaleLowerCase()) }));
    setBusy(true); setError('');
    try {
      const response = await apiRequest<ApiResponse<{ topics: Subject['learningTopics'] }>>(`/courses/${id}/outline`, 'PUT', { topics });
      setOutlinePreview(null); setNotice(`${response.data.topics.length} topics saved. Building your daily sessions…`);
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const preview = await apiRequest<ApiResponse<{ previewHash: string; semester: { id: string }; sessions: unknown[] }>>('/planner/preview', 'POST', { semesterId: subject?.semester.id, timeZone });
        if (preview.data.sessions.length) {
          await apiRequest('/planner/apply', 'POST', { semesterId: preview.data.semester.id, previewHash: preview.data.previewHash, timeZone });
          setNotice(`${response.data.topics.length}-topic plan saved. ${preview.data.sessions.length} daily and assignment sessions have been scheduled.`);
        } else setNotice('Outline saved. Add your study hours in the Planner to create daily sessions.');
      } catch {
        setNotice('Outline saved. Add your weekly study hours in the Planner to create daily sessions.');
      }
      await load();
    } catch (cause: unknown) { setError(errorText(cause, 'The course outline could not be saved.')); }
    finally { setBusy(false); }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] || null);
  if (!subject) return error
    ? <main className={styles.page}><p className={styles.error} role="alert">{error}</p><Link className={styles.back} href="/dashboard/courses">Back to subjects</Link></main>
    : <PageSkeleton kind="subject" />;

  const visibleMaterials = materials.filter((material) => material.title.toLowerCase().includes(search.toLowerCase()));
  const pendingAssignments = subject?.assignments.filter((assignment) => assignment.status !== 'COMPLETED').length || 0;
  const upcomingExams = subject?.exams.filter((exam) => new Date(exam.date) >= new Date()).length || 0;
  const subjectSessions = subject?.studyTasks.flatMap((task) => task.sessions.map((session) => ({ ...session, taskTitle: task.title }))).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)) || [];

  return <main className={styles.page}>
    <Link className={styles.back} href="/dashboard/courses">← All subjects</Link>
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
    {subject && <>
      <header className={styles.hero}><div><span className={styles.eyebrow}>{subject.semester.name} · SUBJECT WORKSPACE</span><h1>{subject.name}</h1><p>{subject.code || 'No subject code'}{subject.instructor ? ` · ${subject.instructor}` : ''}</p></div><span className={styles.status}>{subject.status.toLowerCase()}</span></header>
      <nav className={styles.links}><Link href={`/dashboard/chat?courseId=${subject.id}`}>Ask Tutor about this subject</Link><Link href="/dashboard/planner">Open study planner</Link><Link href="/dashboard/assignments">All assignments</Link></nav>
      <section className={styles.metrics}><article><strong>{materials.length}</strong><span>Materials</span></article><article><strong>{pendingAssignments}</strong><span>Open assignments</span></article><article><strong>{upcomingExams}</strong><span>Upcoming exams</span></article></section>
      <section className={styles.panel}><div className={styles.sectionHeader}><div><h2>Course learning plan</h2><p>Build topic sessions from the subject name and uploaded documents. Daily study does not depend on assignments or exams.</p></div><button type="button" disabled={busy} onClick={() => void previewOutline()}>{busy ? 'Preparing…' : subject.learningTopics.length ? 'Update course outline' : 'Build course outline'}</button></div>
        {subject.learningTopics.length > 0 && <ul className={styles.workList}>{subject.learningTopics.map((topic) => <li key={topic.id}><strong>{topic.sequence}. {topic.title}</strong><span>{topic.estimatedMinutes} min · {topic.materialCovered ? 'Found in uploaded material' : 'AI-added topic'}</span></li>)}</ul>}
        {outlinePreview && <div className={styles.outlineReview}><strong>{outlinePreview.hasMaterials ? 'Uploaded material coverage' : 'No readable material found'}</strong><p>{outlinePreview.hasMaterials ? `AI found ${outlinePreview.materialTopics.length} topics in ${outlinePreview.materialTitles.length} readable file(s) and ${outlinePreview.additionalTopics.length} likely missing topic(s).` : 'AI prepared an outline from the subject name. You can upload notes later to refine it.'} Choose what should be included in the planner.</p>{outlinePreview.hasMaterials && <label><input type="radio" name="outline-scope" checked={outlineScope === 'MATERIAL_ONLY'} onChange={() => setOutlineScope('MATERIAL_ONLY')} disabled={outlinePreview.materialTopics.length === 0} /> Plan only topics found in my files ({outlinePreview.materialTopics.length})</label>}<label><input type="radio" name="outline-scope" checked={outlineScope === 'FULL_COURSE'} onChange={() => setOutlineScope('FULL_COURSE')} /> Include a complete AI outline{outlinePreview.hasMaterials ? ` (${outlinePreview.materialTopics.length + outlinePreview.additionalTopics.length} topics)` : ` (${outlinePreview.additionalTopics.length} topics)`}</label><div className={styles.outlineActions}><button type="button" onClick={() => setOutlinePreview(null)} disabled={busy}>Cancel</button><button type="button" onClick={() => void saveOutline()} disabled={busy || (outlineScope === 'MATERIAL_ONLY' ? outlinePreview.materialTopics.length === 0 : outlinePreview.materialTopics.length + outlinePreview.additionalTopics.length === 0)}>{busy ? 'Saving…' : 'Save learning plan'}</button></div></div>}
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}><h2>Subject details</h2><form className={styles.form} onSubmit={updateSubject}>
          <label>Subject name<input name="name" required maxLength={120} defaultValue={subject.name} /></label>
          <label>Code<input name="code" maxLength={40} defaultValue={subject.code || ''} /></label>
          <label>Instructor<input name="instructor" maxLength={120} defaultValue={subject.instructor || ''} /></label>
          <label>Description<textarea name="description" maxLength={5000} defaultValue={subject.description || ''} rows={4} /></label>
          <button disabled={busy}>Save details</button>
        </form></section>
        <section className={styles.panel}><h2>Upload academic material</h2><p>PDF, DOCX, PPTX, and TXT files up to 15 MB. Indexed files become available to Study Tutor.</p><form className={styles.form} onSubmit={upload}>
          <label>Choose file<input id="subject-material-file" required type="file" accept=".pdf,.docx,.pptx,.txt" onChange={handleFile} /></label>
          <label>Display title (optional)<input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <button disabled={busy || !file}>{busy ? 'Working…' : 'Upload material'}</button>
        </form></section>
      </div>
      <section className={styles.panel}><div className={styles.sectionHeader}><div><h2>Academic materials</h2><p>Search, download, rename, re-index, or remove subject documents.</p></div><input aria-label="Search materials" placeholder="Search documents" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        {visibleMaterials.length === 0 ? <p className={styles.empty}>{materials.length ? 'No materials match your search.' : 'No materials uploaded for this subject yet.'}</p> : <div className={styles.materialList}>{visibleMaterials.map((material) => {
          const draft = material.metadata?.assignmentDraft;
          return <article className={styles.material} key={material.id}><div className={styles.fileIcon}>FILE</div><div className={styles.materialInfo}><h3>{material.title}</h3><p>{material.fileType || 'Document'} · {Math.max(1, Math.round(material.fileSizeBytes / 1024))} KB · {formatDatePK(material.createdAt)}</p><span className={material.processingStatus === 'INDEXED' ? styles.ready : styles.processing}>{material.processingStatus.toLowerCase().replaceAll('_', ' ')}</span></div><div className={styles.actions}><button type="button" onClick={() => void download(material)}>Download</button><button type="button" disabled={busy} onClick={() => void rename(material)}>Rename</button>{!material.isIndexed && material.processingStatus !== 'PROCESSING' && <button type="button" disabled={busy} onClick={() => void reindex(material)}>Retry indexing</button>}<button type="button" disabled={busy} onClick={() => void remove(material)}>Delete</button></div>
            {draft && <div className={styles.draft}><strong>Assignment draft · review before adding</strong><p>{draft.title}{draft.description ? ` — ${draft.description}` : ''}</p><p>AI confidence: {typeof draft.confidence === 'number' ? `${Math.round(draft.confidence * 100)}%` : 'not provided'}. Confirm the correct due date before creating an assignment.</p><label>Deadline<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><button type="button" disabled={busy || !deadline} onClick={() => void confirmAssignment(material)}>Confirm assignment</button></div>}
          </article>;
        })}</div>}
      </section>
      <section className={styles.panel}><h2>Assignments & exams</h2>{subject.assignments.length === 0 && subject.exams.length === 0 ? <p className={styles.empty}>No assignments or exams are recorded for this subject.</p> : <ul className={styles.workList}>{subject.assignments.map((assignment) => <li key={assignment.id}><strong>{assignment.title}</strong><span>{assignment.status.toLowerCase().replaceAll('_', ' ')} · due {formatDatePK(assignment.deadline)}</span></li>)}{subject.exams.map((exam) => <li key={exam.id}><strong>{exam.title}</strong><span>Exam · {formatDatePK(exam.date)}</span></li>)}</ul>}<Link href="/dashboard/assignments">Manage assignments</Link></section>
      <section className={styles.panel}>
        <h2>Study sessions</h2>
        <p>You can start today&apos;s session at any time. Future sessions unlock on their scheduled date; past sessions must be marked missed or rescheduled.</p>
        {subjectSessions.length === 0 ? <p className={styles.empty}>No sessions scheduled for this subject. Add weekly availability in the Planner, then preview and apply a schedule.</p> : (
          <ul className={styles.workList}>{subjectSessions.map((session) => {
            const todayKey = localDateKey(new Date(currentTime));
            const sessionDateKey = localDateKey(new Date(session.scheduledStart));
            const isPastDay = sessionDateKey < todayKey;
            const isToday = sessionDateKey === todayKey;
            return <li key={session.id}>
              <div><strong>{session.taskTitle}</strong><span>{formatDateTimePK(session.scheduledStart)} · {session.plannedDuration.toFixed(1)}h</span></div>
              <div className={styles.sessionControls}>
                <span>{session.status.toLowerCase().replaceAll('_', ' ')}</span>
                {session.status === 'SCHEDULED' && <button type="button" disabled={busy || (!isPastDay && !isToday)} onClick={() => void actOnSession(session, isPastDay ? 'missed' : 'start')} title={!isPastDay && !isToday ? 'This session unlocks on its scheduled date.' : undefined}>{isPastDay ? 'Mark missed' : isToday ? 'Start' : 'Starts on scheduled day'}</button>}
                {session.status === 'IN_PROGRESS' && <button type="button" disabled={busy} onClick={() => void actOnSession(session, 'complete')}>Complete</button>}
              </div>
            </li>;
          })}</ul>
        )}
        <Link href="/dashboard/planner">View weekly planner</Link>
      </section>
    </>}
    {showPartialFollowup && <ConfirmDialog title="Session saved early" description="Your study time has been recorded. Would you like to review the remaining study time and adjust your planner?" confirmLabel="Review planner" cancelLabel="Stay here" busyLabel="Opening planner…" onConfirm={() => { setShowPartialFollowup(false); router.push('/dashboard/planner'); }} onCancel={() => setShowPartialFollowup(false)} />}
    {pendingMaterialDelete && <ConfirmDialog
      title="Delete this material?"
      description={`Delete “${pendingMaterialDelete.title}”? Its indexed Tutor content and saved citations will also be removed.`}
      confirmLabel="Delete material"
      busyLabel="Deleting material…"
      isBusy={busy}
      errorMessage={materialDeleteError}
      tone="danger"
      onCancel={() => { if (!busy) { setPendingMaterialDelete(null); setMaterialDeleteError(''); } }}
      onConfirm={confirmRemove}
    />}
  </main>;
}
