'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest, getCachedApiResponse } from '@/lib/apiClient';
import { formatDatePK } from '@/lib/dateFormat';
import { useToast } from '@/components/layout/toast/ToastContext';
import {
  FiPlus,
  FiClock,
  FiCheckCircle,
  FiArrowRight,
  FiCalendar,
  FiX,
} from 'react-icons/fi';
import styles from './assignments.module.css';
import skeletonStyles from '@/styles/skeletons.module.css';

interface TaskItem {
  id: string;
  status: string;
}

interface AssignmentItem {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  status: string;
  estimatedHours: number;
  completedHours: number;
  course?: { name: string; colorCode: string };
  studyTasks: TaskItem[];
}

interface CourseItem {
  id: string;
  name: string;
}

function AssignmentsContent() {
  const searchParams = useSearchParams();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [courseLoadError, setCourseLoadError] = useState('');
  const [courseId, setCourseId] = useState('');

  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const [updatingAssignmentId, setUpdatingAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const fetchAssignments = async (showLoading = true) => {
    try {
      const cachedAssignments = getCachedApiResponse<{ data?: { assignments?: AssignmentItem[] } }>('/assignments')?.data?.assignments;
      if (cachedAssignments) setAssignments(cachedAssignments);
      if (showLoading && !cachedAssignments) setLoading(true);
      const res: any = await apiRequest('/assignments', 'GET');
      if (res.data?.assignments) {
        setAssignments(res.data.assignments);
      }
    } catch (err: any) {
      if (showLoading) showToast(err?.message || 'Assignments could not be loaded. Please try again.', 'error');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const cachedCourses = getCachedApiResponse<{ data?: { courses?: CourseItem[] } }>('/courses')?.data?.courses;
      if (cachedCourses) setCourses(cachedCourses);
      if (!cachedCourses) setCoursesLoading(true);
      const res: any = await apiRequest('/courses', 'GET');
      if (res.data?.courses) {
        setCourses(res.data.courses);
        setCourseLoadError('');
      }
    } catch (err: any) {
      setCourseLoadError('Your subjects could not be loaded. Refresh the page and try again.');
      showToast(err?.message || 'Subjects could not be loaded. Please try again.', 'error');
    } finally {
      setCoursesLoading(false);
    }
  };

  const toggleAssignmentStatus = async (assignment: AssignmentItem) => {
    try {
      setUpdatingAssignmentId(assignment.id);
      await apiRequest(`/assignments/${assignment.id}/status`, 'PATCH');
      await fetchAssignments(false);
      showToast(assignment.status === 'COMPLETED' ? 'Assignment marked in progress.' : 'Assignment marked completed.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Assignment status could not be updated.', 'error');
    } finally {
      setUpdatingAssignmentId(null);
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchCourses();
    const refreshAssignments = () => {
      if (document.visibilityState === 'visible') void fetchAssignments(false);
    };
    window.addEventListener('focus', refreshAssignments);
    return () => {
      window.removeEventListener('focus', refreshAssignments);
    };
  }, []);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      await apiRequest('/assignments', 'POST', {
        title: title.trim(),
        deadline,
        priority,
        ...(estimatedMinutes.trim() ? { estimatedHours: Number(estimatedMinutes) / 60 } : {}),
        courseId,
      });

      setIsModalOpen(false);
      setTitle('');
      setDeadline('');
      setCourseId('');
      setEstimatedMinutes('');

      showToast('Assignment created successfully!', 'success');
      void fetchAssignments(false);
    } catch (err: any) {
      const msg = typeof err.response?.data?.error?.message === 'string'
        ? err.response.data.error.message
        : typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : err.message || 'Failed to create assignment. Please log in again.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAssignments = assignments.filter((item) => {
    if (filter === 'COMPLETED') return item.status === 'COMPLETED';
    if (filter === 'PENDING') return item.status !== 'COMPLETED';
    return true;
  });

  return (
    <main className={styles.main}>
      <div className={styles.topHeader}>
        <div>
          <h1>Academic Assignments</h1>
          <p>Manage your workload, task milestones, and effort estimation.</p>
        </div>
        <button
          type="button"
          onClick={() => {
                    setIsModalOpen(true);
          }}
          className={styles.addBtn}
          disabled={isSubmitting}
        >
          <FiPlus /> Add Assignment
        </button>
      </div>

      <div className={styles.filterRow}>
        {['ALL', 'PENDING', 'COMPLETED'].map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? styles.activeFilter : styles.filterBtn}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={skeletonStyles.cardsGrid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`${skeletonStyles.skeletonBase} ${skeletonStyles.assignmentCard}`}>
              <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardTag}`} />
              <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardTitle}`} />
              <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardProgress}`} />
            </div>
          ))}
        </div>
      ) : filteredAssignments.length > 0 ? (
        <div className={styles.grid}>
          {filteredAssignments.map((item) => {
            const totalTasks = item.studyTasks?.length || 0;
            const completedTasks = item.studyTasks?.filter((t) => t.status === 'COMPLETED')?.length || 0;
            const isCompleted = item.status === 'COMPLETED';
            const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <div key={item.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.courseBadge}>
                    {item.course?.name || 'General Course'}
                  </span>
                  <span className={`${styles.priorityBadge} ${isCompleted ? styles.completedBadge : styles[item.priority?.toLowerCase() || 'medium']}`}>
                    {isCompleted ? '✓ Completed' : `${item.priority} Priority`}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleAssignmentStatus(item)}
                    className={`${styles.statusButton} ${isCompleted ? styles.statusComplete : styles.statusPending}`}
                    disabled={updatingAssignmentId === item.id}
                    aria-label={isCompleted ? 'Mark assignment in progress' : 'Mark assignment completed'}
                  >
                    {updatingAssignmentId === item.id ? 'Updating...' : isCompleted ? '✓ Completed' : 'Mark complete'}
                  </button>
                </div>

                <h3 className={styles.cardTitle}>{item.title}</h3>

                <div className={styles.cardMeta}>
                  <span><FiCalendar /> Due: {formatDatePK(item.deadline)}</span>
                  <span><FiClock /> {formatStudyDuration(item.estimatedHours)} estimated</span>
                </div>

                <div className={styles.progressContainer}>
                  <div className={styles.progressHeader}>
                    <span>Milestones: {completedTasks}/{totalTasks} complete</span>
                    <strong>{progressPct}%</strong>
                  </div>
                  <div className={styles.progressTrack}>
                    <progress className={styles.progressFill} value={progressPct} max={100} aria-label={`${progressPct}% complete`} />
                  </div>
                </div>

                <Link href={`/dashboard/assignments/${item.id}`} className={styles.openBtn}>
                  Workspace Details <FiArrowRight />
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyBox}>
          <FiCheckCircle className={styles.emptyIcon} />
          <p>No assignments found under this filter.</p>
        </div>
      )}

      {isModalOpen && (
        <div className={styles.overlay} onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Create New Assignment</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} aria-label="Close assignment form"><FiX /></button>
            </div>

            <form noValidate onSubmit={handleCreateAssignment} className={styles.form}>
              <div className={styles.group}>
                <label>Select Subject *</label>
                {coursesLoading ? <div className={`${skeletonStyles.box} ${skeletonStyles.controlSkeleton}`} role="status" aria-label="Loading subjects" /> : courseLoadError ? (
                  <div className={styles.noSubjects} role="alert">{courseLoadError}</div>
                ) : courses.length === 0 ? (
                  <div className={styles.noSubjects} role="alert">
                    <span>You have not added any subjects yet. Add a subject before creating an assignment.</span>
                    <Link href="/dashboard/courses">Add a subject</Link>
                  </div>
                ) : (
                  <select value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={isSubmitting}>
                    <option value="">Choose a subject</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>

              <div className={styles.group}>
                <label>Assignment Title *</label>
                <input
                  type="text"
                  placeholder="Enter assignment title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.group}>
                <label>Deadline Date & Time *</label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.group}>
                  <label>Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={isSubmitting}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className={styles.group}>
                  <label>Estimated Study Time (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="60000"
                    step="1"
                    value={estimatedMinutes}
                    placeholder="60"
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={isSubmitting || coursesLoading}>
                {isSubmitting ? 'Integrating with Planner...' : 'Save & Integrate with Planner'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function formatStudyDuration(hours: number) {
  const minutes = Math.round(hours * 60);
  const wholeHours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return [wholeHours ? `${wholeHours} hr${wholeHours === 1 ? '' : 's'}` : '', remainingMinutes ? `${remainingMinutes} min` : '']
    .filter(Boolean).join(' ') || '0 min';
}

export default function AssignmentsPage() {
  return (
    <Suspense fallback={
      <div className={skeletonStyles.assignmentsContainer}>
        <div className={skeletonStyles.cardsGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${skeletonStyles.skeletonBase} ${skeletonStyles.assignmentCard}`} />
          ))}
        </div>
      </div>
    }>
      <AssignmentsContent />
    </Suspense>
  );
}
