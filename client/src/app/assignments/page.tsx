'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar/Sidebar';
import Header from '@/components/layout/Header/Header';
import { apiRequest } from '@/lib/apiClient';
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

interface AssignmentItem {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  status: string;
  estimatedHours: number;
  completedHours: number;
  course?: { name: string; colorCode: string };
  tasks: Array<{ id: string; isCompleted: boolean }>;
}

function AssignmentsContent() {
  const searchParams = useSearchParams();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form & Submit States
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [estimatedHours, setEstimatedHours] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Auto-open Modal if redirected from Dashboard (+ Add Assignment)
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

  useEffect(() => {
    fetchAssignments();
  }, []);

  const minDateTime = new Date().toISOString().slice(0, 16);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
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
        estimatedHours,
      });

      setIsModalOpen(false);
      setTitle('');
      setDeadline('');
      setModalError('');
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
    <div className={styles.layout}>
      <Sidebar onOpenSetupModal={() => {}} />

      <main className={styles.main}>
        <Header />

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
          >
            <FiPlus /> Add Assignment
          </button>
        </div>

        {/* Filter Controls */}
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

        {/* Assignment Skeleton Grid vs Real Content */}
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
              const totalTasks = item.tasks.length;
              const completedTasks = item.tasks.filter((t) => t.isCompleted).length;
              const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
              const isCompleted = item.status === 'COMPLETED';

              return (
                <div key={item.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.courseBadge}>
                      {item.course?.name || 'General Course'}
                    </span>
                    <span className={`${styles.priorityBadge} ${isCompleted ? styles.completedBadge : styles[item.priority.toLowerCase()]}`}>
                      {isCompleted ? '✓ Completed' : `${item.priority} Priority`}
                    </span>
                  </div>

                  <h3 className={styles.cardTitle}>{item.title}</h3>

                  <div className={styles.cardMeta}>
                    <span><FiCalendar /> Due: {new Date(item.deadline).toLocaleDateString()}</span>
                    <span><FiClock /> {item.estimatedHours} Hours Est.</span>
                  </div>

                  {/* Progress Bar */}
                  <div className={styles.progressContainer}>
                    <div className={styles.progressHeader}>
                      <span>Progress ({completedTasks}/{totalTasks} Tasks)</span>
                      <strong>{progressPct}%</strong>
                    </div>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>

                  <Link href={`/assignments/${item.id}`} className={styles.openBtn}>
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
      </main>

      {/* Quick Add Assignment Modal */}
      {isModalOpen && (
        <div className={styles.overlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Create New Assignment</h3>
              <button type="button" onClick={() => setIsModalOpen(false)}><FiX /></button>
            </div>

            {/* Error Banner inside Modal */}
            {modalError && (
              <div className={styles.modalErrorBanner}>
                <FiAlertTriangle />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAssignment} className={styles.form}>
              <div className={styles.group}>
                <label>Assignment Title *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. CNN Image Classification Report"
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
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
                />
              </div>

              <div className={styles.row}>
                <div className={styles.group}>
                  <label>Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className={styles.group}>
                  <label>Estimated Hours</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="50"
                    value={estimatedHours} 
                    onChange={(e) => setEstimatedHours(parseInt(e.target.value))} 
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
    </div>
  );
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