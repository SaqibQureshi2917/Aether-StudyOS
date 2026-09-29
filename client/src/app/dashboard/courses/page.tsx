'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest, getCachedApiResponse } from '@/lib/apiClient';
import ConfirmDialog from '@/components/layout/ConfirmDialog/ConfirmDialog';
import PageSkeleton from '@/components/layout/PageSkeleton/PageSkeleton';
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

export default function CoursesPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesterId, setSemesterId] = useState('');
  const [semesterName, setSemesterName] = useState('');
  const [semesterStart, setSemesterStart] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [confirmationError, setConfirmationError] = useState('');

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
      setError(errorText(cause, 'Could not load courses and semesters.'));
      setHasLoaded(true);
    }
  }, [showArchived]);

  useEffect(() => {
    // Load the authenticated academic records as an external synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const submit = async (event: FormEvent, action: () => Promise<unknown>, success: string) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage(success); await load(); }
    catch (cause: unknown) { setError(errorText(cause, 'Could not save your changes.')); }
    finally { setBusy(false); }
  };

  const createSemester = (event: FormEvent) => submit(event, () => apiRequest('/semesters', 'POST', {
    name: semesterName, startDate: semesterStart, endDate: semesterEnd, status: 'PLANNED',
  }), 'Semester created.');

  const createCourse = (event: FormEvent) => submit(event, () => apiRequest('/courses', 'POST', {
    semesterId, name: courseName, code: courseCode || undefined,
  }), 'Course created.');

  const updateStatus = async (semester: Semester, status: Semester['status']) => {
    setBusy(true); setError(''); setMessage('');
    try { await apiRequest(`/semesters/${semester.id}`, 'PUT', { status }); setMessage('Semester status updated.'); await load(); }
    catch (cause: unknown) { setError(errorText(cause, 'Could not update semester.')); }
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
    setBusy(true); setError(''); setMessage('');
    try { await apiRequest(`/courses/${course.id}`, 'PUT', { name }); setMessage('Course updated.'); await load(); }
    catch (cause: unknown) { setError(errorText(cause, 'Could not update course.')); }
    finally { setBusy(false); }
  };

  const archiveCourse = async (course: Course) => {
    const status = course.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    setConfirmationError('');
    setPendingConfirmation({ kind: 'course-status', course, status });
  };

  const confirmAction = async () => {
    if (!pendingConfirmation) return;
    setBusy(true); setConfirmationError(''); setError(''); setMessage('');
    try {
      if (pendingConfirmation.kind === 'delete-semester') {
        await apiRequest(`/semesters/${pendingConfirmation.semester.id}`, 'DELETE');
        setMessage('Semester deleted.');
      } else if (pendingConfirmation.kind === 'delete-course') {
        await apiRequest(`/courses/${pendingConfirmation.course.id}`, 'DELETE');
        setMessage('Subject deleted.');
      } else {
        await apiRequest(`/courses/${pendingConfirmation.course.id}`, 'PUT', { status: pendingConfirmation.status });
        setMessage(pendingConfirmation.status === 'ARCHIVED' ? 'Subject archived; records preserved.' : 'Subject restored.');
      }
      setPendingConfirmation(null);
      await load();
    } catch (cause: unknown) {
      setConfirmationError(errorText(cause, 'This action could not be completed.'));
    } finally { setBusy(false); }
  };

  const visibleCourses = courses.filter((course) => `${course.name} ${course.code || ''} ${course.semester?.name || ''}`.toLowerCase().includes(search.toLowerCase()));

  if (!hasLoaded && !error) return <PageSkeleton kind="collection" />;

  return <main className={styles.page}>
    <h1>Subjects & Semesters</h1>
    <p className={styles.intro}>Manage academic terms and subject workspaces. Archiving preserves materials and study history.</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.notice} role="status">{message}</p>}

    <section className={styles.section} aria-labelledby="semester-heading">
      <h2 id="semester-heading">Semesters</h2>
      {semesters.length === 0 && <p>No semesters yet. Create one to add courses.</p>}
      <ul className={styles.list}>
        {semesters.map((semester) => <li key={semester.id} className={styles.row}>
          <strong>{semester.name}</strong><span>{new Date(semester.startDate).toLocaleDateString()} – {semester.endDate ? new Date(semester.endDate).toLocaleDateString() : 'Estimated end: 6 months after start'}</span>
          <span>{semester.status} · {semester._count?.courses ?? courses.filter((c) => c.semesterId === semester.id).length} courses</span>
          {semester.status !== 'ACTIVE' && <button type="button" disabled={busy} onClick={() => void updateStatus(semester, 'ACTIVE')}>Make active</button>}
          {semester.status === 'ACTIVE' && <button type="button" disabled={busy} onClick={() => void updateStatus(semester, 'COMPLETED')}>Complete</button>}
          <button type="button" disabled={busy || (semester._count?.courses ?? courses.filter((course) => course.semesterId === semester.id).length) > 0} onClick={() => removeSemester(semester)}>Delete</button>
        </li>)}
      </ul>
      <form onSubmit={createSemester} className={styles.form}>
        <input aria-label="Semester name" placeholder="Enter semester name" required maxLength={100} value={semesterName} onChange={(e) => setSemesterName(e.target.value)} />
        <label>Starts <input aria-label="Semester start date" type="date" required value={semesterStart} onChange={(e) => setSemesterStart(e.target.value)} /></label>
        <label>Ends (optional) <input aria-label="Semester end date (optional)" type="date" value={semesterEnd} onChange={(e) => setSemesterEnd(e.target.value)} /></label>
        <button disabled={busy || !semesterName || !semesterStart}>Add semester</button>
      </form>
    </section>

    <section className={styles.section} aria-labelledby="courses-heading">
      <h2 id="courses-heading">Subjects</h2>
      <div className={styles.toolbar}>
        <input aria-label="Search subjects" placeholder="Search subjects or semester" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Include archived</label>
      </div>
      <form onSubmit={createCourse} className={styles.form}>
        <select aria-label="Subject semester" required value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
          <option value="">Select semester</option>{semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input aria-label="Subject name" placeholder="Enter subject name" required maxLength={120} value={courseName} onChange={(e) => setCourseName(e.target.value)} />
        <input aria-label="Course code" placeholder="Enter course code (optional)" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
        <button disabled={busy || !semesterId || !courseName}>Add subject</button>
      </form>
      {visibleCourses.length === 0 ? <p>{courses.length ? 'No subjects match your search.' : 'No subjects yet.'}</p> : <ul className={styles.list}>
        {visibleCourses.map((course) => <li key={course.id} className={styles.row}>
          <strong>{course.name}</strong><span>{course.code || 'No subject code'}</span><span>{course.semester?.name}</span><span>{course.status === 'ARCHIVED' ? 'Archived' : 'Active'}</span>
          <Link href={`/dashboard/courses/${course.id}`}>Open workspace</Link>
          <button type="button" disabled={busy} onClick={() => void renameCourse(course)}>Rename</button>
          <button type="button" disabled={busy} onClick={() => void archiveCourse(course)}>{course.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</button>
          <button type="button" disabled={busy} onClick={() => removeCourse(course)}>Delete if empty</button>
        </li>)}
      </ul>}
    </section>
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
