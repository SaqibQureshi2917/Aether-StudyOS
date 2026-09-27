'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/apiClient';
import { useToast } from '@/components/layout/toast/ToastContext';
import { 
  FiPlus, 
  FiClock, 
  FiCheckCircle, 
  FiArrowRight, 
  FiCalendar,
  FiX,
  FiAlertTriangle
} from 'react-icons/fi';
import styles from './assignments.module.css';
import skeletonStyles from '@/styles/skeletons.module.css';

interface TaskItem {
  id: string;
  isCompleted: boolean;
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
  tasks: TaskItem[];
}

interface CourseItem {
  id: string;
  name: string;
}

function AssignmentsContent() {
  const searchParams = useSearchParams();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [courseId, setCourseId] = useState('');
  
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [estimatedMinutes, setEstimatedMinutes] = useState(240);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res: any = await apiRequest('/assignments', 'GET');
      if (res.data?.assignments) {
        setAssignments(res.data.assignments);
      }
    } catch (err: any) {
      console.warn('Assignments fetch fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res: any = await apiRequest('/courses', 'GET');
      if (res.data?.courses) {
        setCourses(res.data.courses);
      }
    } catch (err) {
      console.warn('Courses fetch fallback:', err);
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchCourses();
  }, []);

  const minDateTime = new Date().toISOString().slice(0, 16);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!courseId) {
      setModalError('Please select a course for this assignment.');
      return;
    }

    const selectedDate = new Date(deadline);
    const now = new Date();
    const selectedYear = selectedDate.getFullYear();

    if (isNaN(selectedDate.getTime())) {
      setModalError('Please select a valid date and time.');
      return;
    }

    if (selectedDate < now) {
      setModalError('Assignment deadline cannot be in the past!');
      return;
    }

    if (selectedYear < 2026 || selectedYear > 2100) {
      setModalError('Please enter a valid year (e.g. 2026 - 2100).');
      return;
    }
    
    setIsSubmitting(true);

    try {
      await apiRequest('/assignments', 'POST', {
        title: title.trim(),
        deadline,
        priority,
        estimatedHours: estimatedMinutes / 60,
        courseId,
      });

      setIsModalOpen(false);
      setTitle('');
      setDeadline('');
      setCourseId('');
      setModalError('');

      showToast('Assignment created successfully!', 'success');
      fetchAssignments();
    } catch (err: any) {
      console.error('Failed to create assignment:', err);
      const msg = typeof err.response?.data?.error?.message === 'string'
        ? err.response.data.error.message
        : typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : err.message || 'Failed to create assignment. Please log in again.';
      setModalError(msg);
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
            setModalError('');
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
            const totalTasks = item.tasks?.length || 0;
            const completedTasks = item.tasks?.filter((t) => t.isCompleted)?.length || 0;
            const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const isCompleted = item.status === 'COMPLETED';

            return (
              <div key={item.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.courseBadge}>
                    {item.course?.name || 'General Course'}
                  </span>
                  <span className={`${styles.priorityBadge} ${isCompleted ? styles.completedBadge : styles[item.priority?.toLowerCase() || 'medium']}`}>
                    {isCompleted ? '✓ Completed' : `${item.priority} Priority`}
                  </span>
                </div>

                <h3 className={styles.cardTitle}>{item.title}</h3>

                <div className={styles.cardMeta}>
                  <span><FiCalendar /> Due: {new Date(item.deadline).toLocaleDateString()}</span>
                  <span><FiClock /> {formatStudyDuration(item.estimatedHours)} estimated</span>
                </div>

                <div className={styles.progressContainer}>
                  <div className={styles.progressHeader}>
                    <span>Progress ({completedTasks}/{totalTasks} Tasks)</span>
                    <strong>{progressPct}%</strong>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
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

            {modalError && (
              <div className={styles.modalErrorBanner}>
                <FiAlertTriangle />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAssignment} className={styles.form}>
              <div className={styles.group}>
                <label>Select Course *</label>
                <select 
                  value={courseId} 
                  onChange={(e) => setCourseId(e.target.value)} 
                  required
                  disabled={isSubmitting}
                >
                  <option value="">-- Choose a Course --</option>
                  {Array.isArray(courses) && courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.group}>
                <label>Assignment Title *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. CNN Image Classification Report"
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.group}>
                <label>Deadline Date & Time *</label>
                <input 
                  type="datetime-local" 
                  required 
                  min={minDateTime}
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
                    min="7" 
                    max="60000"
                    step="1"
                    value={estimatedMinutes} 
                    onChange={(e) => setEstimatedMinutes(Math.max(7, parseInt(e.target.value, 10) || 7))} 
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
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
