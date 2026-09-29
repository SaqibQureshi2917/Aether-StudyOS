'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest, getCachedApiResponse } from '@/lib/apiClient';

type Semester = { id: string; name: string; startDate: string; endDate: string | null; status: 'ACTIVE' | 'COMPLETED' | 'PLANNED'; _count?: { courses: number } };
type Course = { id: string; name: string; code: string | null; creditHours: number; difficulty: number; priority: number; semesterId: string; semester?: { name: string } };

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

  const load = useCallback(async () => {
    setError('');
    try {
      const cachedSemesters = getCachedApiResponse<{ data?: { semesters?: Semester[] } }>('/semesters')?.data?.semesters;
      const cachedCourses = getCachedApiResponse<{ data?: { courses?: Course[] } }>('/courses')?.data?.courses;
      if (cachedSemesters) setSemesters(cachedSemesters);
      if (cachedCourses) setCourses(cachedCourses);
      const [semesterResponse, courseResponse]: any[] = await Promise.all([
        apiRequest('/semesters', 'GET'), apiRequest('/courses', 'GET'),
      ]);
      const nextSemesters: Semester[] = semesterResponse.data?.semesters ?? [];
      setSemesters(nextSemesters);
      setCourses(courseResponse.data?.courses ?? []);
      setSemesterId((current) => current || nextSemesters.find((s) => s.status === 'ACTIVE')?.id || nextSemesters[0]?.id || '');
    } catch (cause: any) {
      setError(cause?.message || 'Could not load courses and semesters.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent, action: () => Promise<unknown>, success: string) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage(success); await load(); }
    catch (cause: any) { setError(cause?.message || 'Could not save your changes.'); }
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
    catch (cause: any) { setError(cause?.message || 'Could not update semester.'); }
    finally { setBusy(false); }
  };

  const removeSemester = async (semester: Semester) => {
    if (!window.confirm(`Delete “${semester.name}” and all its courses, assignments, and study data? This cannot be undone.`)) return;
    setBusy(true); setError(''); setMessage('');
    try { await apiRequest(`/semesters/${semester.id}`, 'DELETE'); setMessage('Semester deleted.'); await load(); }
    catch (cause: any) { setError(cause?.message || 'Could not delete semester.'); }
    finally { setBusy(false); }
  };

  const removeCourse = async (course: Course) => {
    if (!window.confirm(`Delete “${course.name}” and its linked assignments and study data? This cannot be undone.`)) return;
    setBusy(true); setError(''); setMessage('');
    try { await apiRequest(`/courses/${course.id}`, 'DELETE'); setMessage('Course deleted.'); await load(); }
    catch (cause: any) { setError(cause?.message || 'Could not delete course.'); }
    finally { setBusy(false); }
  };

  const renameCourse = async (course: Course) => {
    const name = window.prompt('Course name', course.name)?.trim();
    if (!name || name === course.name) return;
    setBusy(true); setError(''); setMessage('');
    try { await apiRequest(`/courses/${course.id}`, 'PUT', { name }); setMessage('Course updated.'); await load(); }
    catch (cause: any) { setError(cause?.message || 'Could not update course.'); }
    finally { setBusy(false); }
  };

  return <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
    <h1>Courses & Semesters</h1>
    <p>Manage your academic terms and the courses attached to them.</p>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {message && <p role="status">{message}</p>}

    <section aria-labelledby="semester-heading" style={{ marginTop: 32 }}>
      <h2 id="semester-heading">Semesters</h2>
      {semesters.length === 0 && <p>No semesters yet. Create one to add courses.</p>}
      <ul style={{ padding: 0, listStyle: 'none' }}>
        {semesters.map((semester) => <li key={semester.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #ddd' }}>
          <strong>{semester.name}</strong><span>{new Date(semester.startDate).toLocaleDateString()} – {semester.endDate ? new Date(semester.endDate).toLocaleDateString() : 'Estimated end: 6 months after start'}</span>
          <span>{semester.status} · {semester._count?.courses ?? courses.filter((c) => c.semesterId === semester.id).length} courses</span>
          {semester.status !== 'ACTIVE' && <button type="button" disabled={busy} onClick={() => void updateStatus(semester, 'ACTIVE')}>Make active</button>}
          {semester.status === 'ACTIVE' && <button type="button" disabled={busy} onClick={() => void updateStatus(semester, 'COMPLETED')}>Complete</button>}
          <button type="button" disabled={busy} onClick={() => void removeSemester(semester)}>Delete</button>
        </li>)}
      </ul>
      <form onSubmit={createSemester} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        <input aria-label="Semester name" placeholder="Enter semester name" required maxLength={100} value={semesterName} onChange={(e) => setSemesterName(e.target.value)} />
        <label>Starts <input aria-label="Semester start date" type="date" required value={semesterStart} onChange={(e) => setSemesterStart(e.target.value)} /></label>
        <label>Ends (optional) <input aria-label="Semester end date (optional)" type="date" value={semesterEnd} onChange={(e) => setSemesterEnd(e.target.value)} /></label>
        <button disabled={busy || !semesterName || !semesterStart}>Add semester</button>
      </form>
    </section>

    <section aria-labelledby="courses-heading" style={{ marginTop: 40 }}>
      <h2 id="courses-heading">Subjects</h2>
      <form onSubmit={createCourse} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '16px 0' }}>
        <select aria-label="Subject semester" required value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
          <option value="">Select semester</option>{semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input aria-label="Subject name" placeholder="Enter subject name" required maxLength={120} value={courseName} onChange={(e) => setCourseName(e.target.value)} />
        <input aria-label="Course code" placeholder="Enter course code (optional)" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
        <button disabled={busy || !semesterId || !courseName}>Add subject</button>
      </form>
      {courses.length === 0 ? <p>No courses yet.</p> : <ul style={{ padding: 0, listStyle: 'none' }}>
        {courses.map((course) => <li key={course.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #ddd' }}>
          <strong>{course.name}</strong><span>{course.code || 'No course code'}</span><span>{course.semester?.name}</span>
          <button type="button" disabled={busy} onClick={() => void renameCourse(course)}>Rename</button>
          <button type="button" disabled={busy} onClick={() => void removeCourse(course)}>Delete</button>
        </li>)}
      </ul>}
    </section>
  </main>;
}
