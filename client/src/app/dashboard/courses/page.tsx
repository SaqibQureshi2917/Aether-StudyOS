'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest, getCachedApiResponse } from '@/lib/apiClient';
import { formatDatePK } from '@/lib/dateFormat';
import ConfirmDialog from '@/components/layout/ConfirmDialog/ConfirmDialog';
import PageSkeleton from '@/components/layout/PageSkeleton/PageSkeleton';
import { useToast } from '@/components/layout/toast/ToastContext';
import styles from './courses.module.css';

type Semester = { id: string; name: string; startDate: string; endDate: string | null; status: 'ACTIVE' | 'COMPLETED' | 'PLANNED'; _count?: { courses: number } };
type Course = { id: string; name: string; code: string | null; creditHours: number; difficulty: number; priority: number; semesterId: string; status: string; semester?: { name: string } };
type ApiResponse<T> = { success: boolean; data: T };
type PendingConfirmation =
  | { kind: 'delete-semester'; semester: Semester }
  | { kind: 'delete-course'; course: Course }
  | { kind: 'course-status'; course: Course; status: 'ACTIVE' | 'ARCHIVED' };

function errorText(error: unknown, fallback: string) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : fallback;
}

function CoursesWorkspace() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedSemesterId = searchParams.get('semesterId');
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesterId, setSemesterId] = useState('');
  const [semesterName, setSemesterName] = useState('');
  const [semesterStart, setSemesterStart] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [confirmationError, setConfirmationError] = useState('');
  const [addDialog, setAddDialog] = useState<'semester' | 'subject' | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const cachedSemesters = getCachedApiResponse<{ data?: { semesters?: Semester[] } }>('/semesters')?.data?.semesters;
      const coursesEndpoint = `/courses?includeArchived=${showArchived}`;
      const cachedCourses = getCachedApiResponse<{ data?: { courses?: Course[] } }>(coursesEndpoint)?.data?.courses;
      if (cachedSemesters) { setSemesters(cachedSemesters); setHasLoaded(true); }
      if (cachedCourses) { setCourses(cachedCourses); setHasLoaded(true); }
      const [semesterResponse, courseResponse] = await Promise.all([
        apiRequest<ApiResponse<{ semesters: Semester[] }>>('/semesters', 'GET'),
        apiRequest<ApiResponse<{ courses: Course[] }>>(coursesEndpoint, 'GET'),
      ]);
      const nextSemesters: Semester[] = semesterResponse.data?.semesters ?? [];
      setSemesters(nextSemesters);
      setCourses(courseResponse.data?.courses ?? []);
      setSemesterId((current) => current || nextSemesters.find((s) => s.status === 'ACTIVE')?.id || nextSemesters[0]?.id || '');
      setHasLoaded(true);
    } catch (cause: unknown) {
      showToast(errorText(cause, 'Could not load courses and semesters.'), 'error');
      setHasLoaded(true);
    }
  }, [showArchived]);

  useEffect(() => {
    // Load the authenticated academic records as an external synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const submit = async (event: FormEvent, action: () => Promise<unknown>, success: string) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await action(); setAddDialog(null); setSemesterName(''); setSemesterStart(''); setSemesterEnd(''); setCourseName(''); setCourseCode(''); await load(); showToast(success, 'success'); }
    catch (cause: unknown) { showToast(errorText(cause, 'Could not save your changes.'), 'error'); }
    finally { setBusy(false); }
  };

  const createSemester = (event: FormEvent) => submit(event, () => apiRequest('/semesters', 'POST', {
    name: semesterName, startDate: semesterStart, endDate: semesterEnd, status: 'PLANNED',
  }), 'Semester created.');

  const createCourse = (event: FormEvent) => submit(event, () => apiRequest('/courses', 'POST', {
    semesterId: selectedSemesterId || semesterId, name: courseName, code: courseCode || undefined,
  }), 'Course created.');

  const updateStatus = async (semester: Semester, status: Semester['status']) => {
    setBusy(true); setError('');
    try { await apiRequest(`/semesters/${semester.id}`, 'PUT', { status }); await load(); showToast('Semester status updated.', 'success'); }
    catch (cause: unknown) { showToast(errorText(cause, 'Could not update semester.'), 'error'); }
    finally { setBusy(false); }
  };

  const removeSemester = (semester: Semester) => {
    setConfirmationError('');
    setPendingConfirmation({ kind: 'delete-semester', semester });
  };

  const removeCourse = (course: Course) => {
    setConfirmationError('');
    setPendingConfirmation({ kind: 'delete-course', course });
  };

  const renameCourse = async (course: Course) => {
    const name = window.prompt('Course name', course.name)?.trim();
    if (!name || name === course.name) return;
    setBusy(true); setError('');
    try { await apiRequest(`/courses/${course.id}`, 'PUT', { name }); await load(); showToast('Course updated.', 'success'); }
    catch (cause: unknown) { showToast(errorText(cause, 'Could not update course.'), 'error'); }
    finally { setBusy(false); }
  };

  const archiveCourse = async (course: Course) => {
    const status = course.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    setConfirmationError('');
    setPendingConfirmation({ kind: 'course-status', course, status });
  };

  const confirmAction = async () => {
    if (!pendingConfirmation) return;
    setBusy(true); setConfirmationError(''); setError('');
    let successMessage = '';
    try {
      if (pendingConfirmation.kind === 'delete-semester') {
        await apiRequest(`/semesters/${pendingConfirmation.semester.id}`, 'DELETE');
        successMessage = 'Semester deleted.';
      } else if (pendingConfirmation.kind === 'delete-course') {
        await apiRequest(`/courses/${pendingConfirmation.course.id}`, 'DELETE');
        successMessage = 'Subject deleted.';
      } else {
        await apiRequest(`/courses/${pendingConfirmation.course.id}`, 'PUT', { status: pendingConfirmation.status });
        successMessage = pendingConfirmation.status === 'ARCHIVED' ? 'Subject archived; records preserved.' : 'Subject restored.';
      }
      setPendingConfirmation(null);
      await load();
      showToast(successMessage, 'success');
    } catch (cause: unknown) {
      showToast(errorText(cause, 'This action could not be completed.'), 'error');
    } finally { setBusy(false); }
  };

  const visibleCourses = courses.filter((course) => `${course.name} ${course.code || ''} ${course.semester?.name || ''}`.toLowerCase().includes(search.toLowerCase()));
  const selectedSemester = semesters.find((semester) => semester.id === selectedSemesterId);
  const semesterCourses = visibleCourses.filter((course) => course.semesterId === selectedSemesterId);

  if (!hasLoaded && !error) return <PageSkeleton kind="collection" />;

  return <main className={styles.page}>
    <header className={styles.pageHeader}>{selectedSemester && <button type="button" className={styles.backButton} onClick={() => router.push('/dashboard/courses')}>← All semesters</button>}<span className={styles.eyebrow}>{selectedSemester ? 'SEMESTER WORKSPACE' : 'ACADEMIC PLANNER'}</span><h1>{selectedSemester?.name || 'Your semesters'}</h1><p className={styles.intro}>{selectedSemester ? 'Add subjects here, then open a subject workspace to upload materials and follow its study plan.' : 'Create a semester first, then add subjects inside its workspace.'}</p></header>

    {!selectedSemesterId && <section className={styles.section} aria-labelledby="semester-heading">
      <div className={styles.sectionHeading}><div><h2 id="semester-heading">Semesters</h2><p>Each semester keeps its subjects and study plan together.</p></div><button type="button" className={styles.addButton} onClick={() => setAddDialog('semester')}>＋ Add semester</button></div>
      {semesters.length === 0 && <p>No semesters yet. Create one to add courses.</p>}
      <ul className={styles.list}>
        {semesters.map((semester) => <li key={semester.id} className={`${styles.row} ${styles.semesterRow}`}>
          <Link href={`/dashboard/courses?semesterId=${semester.id}`} className={styles.openCard} aria-label={`Open ${semester.name}`}>Open semester →</Link>
          <strong>{semester.name}</strong><span>{formatDatePK(semester.startDate)} – {semester.endDate ? formatDatePK(semester.endDate) : 'Estimated end: 6 months after start'}</span>
          <span>{semester.status} · {semester._count?.courses ?? courses.filter((c) => c.semesterId === semester.id).length} courses</span>
          {semester.status !== 'ACTIVE' && <button type="button" disabled={busy} onClick={() => void updateStatus(semester, 'ACTIVE')}>Make active</button>}
          {semester.status === 'ACTIVE' && <button type="button" disabled={busy} onClick={() => void updateStatus(semester, 'COMPLETED')}>Complete</button>}
          <button type="button" disabled={busy || (semester._count?.courses ?? courses.filter((course) => course.semesterId === semester.id).length) > 0} onClick={() => removeSemester(semester)}>Delete</button>
        </li>)}
      </ul>
    </section>}

    {selectedSemester && <section className={styles.section} aria-labelledby="courses-heading">
      <div className={styles.sectionHeading}><div><h2 id="courses-heading">Subjects</h2><p>Add subjects to build their learning workspace and daily study plan.</p></div><button type="button" className={styles.addButton} onClick={() => setAddDialog('subject')}>＋ Add subject</button></div>
      <div className={styles.toolbar}>
        <input aria-label="Search subjects" placeholder="Search subjects or semester" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Include archived</label>
      </div>
      {semesterCourses.length === 0 ? <p>{courses.some((course) => course.semesterId === selectedSemesterId) ? 'No subjects match your search.' : 'No subjects yet. Add a subject to create its learning workspace.'}</p> : <ul className={styles.list}>
        {semesterCourses.map((course) => <li key={course.id} className={`${styles.row} ${styles.subjectRow}`}>
          <strong>{course.name}</strong><span>{course.code || 'No subject code'}</span><span>{course.semester?.name}</span><span>{course.status === 'ARCHIVED' ? 'Archived' : 'Active'}</span>
          <Link href={`/dashboard/courses/${course.id}`}>Open workspace</Link>
          <button type="button" disabled={busy} onClick={() => void renameCourse(course)}>Rename</button>
          <button type="button" disabled={busy} onClick={() => void archiveCourse(course)}>{course.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</button>
          <button type="button" disabled={busy} onClick={() => removeCourse(course)}>Delete if empty</button>
        </li>)}
      </ul>}
    </section>}
    {addDialog && <div className={styles.dialogOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setAddDialog(null); }}><section className={styles.addDialog} role="dialog" aria-modal="true" aria-labelledby="add-dialog-title"><button type="button" className={styles.dialogClose} onClick={() => setAddDialog(null)} disabled={busy} aria-label="Close">×</button><span className={styles.eyebrow}>{addDialog === 'semester' ? 'ACADEMIC PLANNER' : selectedSemester?.name}</span><h2 id="add-dialog-title">Add {addDialog}</h2><p>{addDialog === 'semester' ? 'Set the dates for this semester. You can add subjects after opening it.' : 'Create a subject workspace. You can add study material after it is created.'}</p>{addDialog === 'semester' ? <form noValidate onSubmit={createSemester} className={styles.dialogForm}><label>Semester name<input autoFocus maxLength={100} placeholder="e.g. Fall 2026" value={semesterName} onChange={(e) => setSemesterName(e.target.value)} /></label><label>Start date<input type="date" value={semesterStart} onChange={(e) => setSemesterStart(e.target.value)} /></label><label>End date <span>(optional)</span><input type="date" min={semesterStart || undefined} value={semesterEnd} onChange={(e) => setSemesterEnd(e.target.value)} /></label><div className={styles.dialogActions}><button type="button" className={styles.cancelButton} onClick={() => setAddDialog(null)} disabled={busy}>Cancel</button><button type="submit" className={styles.addButton} disabled={busy}>{busy ? 'Creating…' : 'Create semester'}</button></div></form> : <form noValidate onSubmit={createCourse} className={styles.dialogForm}><label>Subject name<input autoFocus maxLength={120} placeholder="e.g. Data Structures" value={courseName} onChange={(e) => setCourseName(e.target.value)} /></label><label>Subject code <span>(optional)</span><input placeholder="e.g. CS201" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} /></label><div className={styles.dialogActions}><button type="button" className={styles.cancelButton} onClick={() => setAddDialog(null)} disabled={busy}>Cancel</button><button type="submit" className={styles.addButton} disabled={busy}>{busy ? 'Creating…' : 'Create subject'}</button></div></form>}</section></div>}
    {pendingConfirmation && <ConfirmDialog
      title={pendingConfirmation.kind === 'delete-semester' ? 'Delete this semester?' : pendingConfirmation.kind === 'delete-course' ? 'Delete this subject?' : `${pendingConfirmation.status === 'ARCHIVED' ? 'Archive' : 'Restore'} this subject?`}
      description={pendingConfirmation.kind === 'delete-semester' ? `Delete “${pendingConfirmation.semester.name}”? Only empty semesters can be deleted.` : pendingConfirmation.kind === 'delete-course' ? `Delete “${pendingConfirmation.course.name}”? Subjects with academic records cannot be deleted; archive it to preserve its history.` : `Update “${pendingConfirmation.course.name}”? Its materials and academic history will be preserved.`}
      confirmLabel={pendingConfirmation.kind === 'delete-semester' || pendingConfirmation.kind === 'delete-course' ? 'Delete' : pendingConfirmation.status === 'ARCHIVED' ? 'Archive subject' : 'Restore subject'}
      busyLabel="Saving…"
      isBusy={busy}
      errorMessage={confirmationError}
      tone={pendingConfirmation.kind === 'course-status' ? 'warning' : 'danger'}
      onCancel={() => { if (!busy) { setPendingConfirmation(null); setConfirmationError(''); } }}
      onConfirm={confirmAction}
    />}
  </main>;
}

export default function CoursesPage() {
  return <Suspense fallback={<PageSkeleton kind="collection" />}><CoursesWorkspace /></Suspense>;
}
