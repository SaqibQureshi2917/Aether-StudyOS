'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
// import Header from '@/components/layout/Header/Header';
import { apiRequest } from '@/lib/apiClient';
import { 
  FiArrowLeft, 
  FiCalendar, 
  FiClock, 
  FiCheckSquare, 
  FiSquare, 
  FiTrash2, 
  FiPlus, 
  FiZap, 
  FiPlay,
  FiAlertTriangle,
  FiX
} from 'react-icons/fi';
import styles from './assignmentDetail.module.css';
import skeletonStyles from '@/styles/skeletons.module.css';

interface Task {
  id: string;
  title: string;
  estimatedHours: number;
  isCompleted: boolean;
}

interface AssignmentDetail {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  priority: string;
  difficulty: string;
  status: string;
  estimatedHours: number;
  completedHours: number;
  course?: { name: string; colorCode: string };
  tasks: Task[];
}

export default function AssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Task Creation State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Custom Delete Confirmation Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Silent Fetcher
  const fetchAssignmentDetail = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res: any = await apiRequest(`/assignments/${assignmentId}`, 'GET');
      if (res.data?.assignment) {
        setAssignment(res.data.assignment);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load assignment details');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    if (assignmentId) fetchAssignmentDetail(true);
  }, [assignmentId, fetchAssignmentDetail]);

  const handleToggleTask = async (taskId: string) => {
    try {
      await apiRequest(`/assignments/${assignmentId}/tasks/${taskId}`, 'PATCH');
      fetchAssignmentDetail(false);
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      setIsAddingTask(true);
      await apiRequest(`/assignments/${assignmentId}/tasks`, 'POST', {
        title: newTaskTitle.trim(),
        estimatedHours: 1,
      });
      setNewTaskTitle('');
      fetchAssignmentDetail(false);
    } catch (err) {
      console.error('Failed to add task:', err);
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiRequest(`/assignments/${assignmentId}/tasks/${taskId}`, 'DELETE');
      fetchAssignmentDetail(false);
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleToggleStatus = async () => {
    try {
      await apiRequest(`/assignments/${assignmentId}/status`, 'PATCH');
      fetchAssignmentDetail(false);
    } catch (err) {
      console.error('Failed to update assignment status:', err);
    }
  };

  const confirmDeleteAssignment = async () => {
    try {
      setIsDeleting(true);
      setDeleteError('');
      await apiRequest(`/assignments/${assignmentId}`, 'DELETE');
      router.push('/dashboard/assignments');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete assignment. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleAICoachBreakdown = async () => {
    const defaultMilestones = [
      'Understand Requirements & Specs',
      'Dataset / Resource Preparation',
      'Core Implementation / Architecture',
      'Testing, Evaluation & Report Writing'
    ];

    for (const title of defaultMilestones) {
      try {
        await apiRequest(`/assignments/${assignmentId}/tasks`, 'POST', { title, estimatedHours: 1 });
      } catch (err) {
        console.error('AI Coach Task Add Error:', err);
      }
    }
    fetchAssignmentDetail(false);
  };

  // CSS Skeleton Loader Block
  if (loading) {
    return (
      <main className={styles.main}>
        {/* <Header /> */}
        <div className={skeletonStyles.assignmentsContainer}>
          <div className={skeletonStyles.headerRow}>
            <div className={`${skeletonStyles.box} ${skeletonStyles.boxBackLink}`} />
            <div className={`${skeletonStyles.box} ${skeletonStyles.boxActionBtn}`} />
          </div>

          <div className={`${skeletonStyles.skeletonBase} ${skeletonStyles.detailHero}`}>
            <div className={`${skeletonStyles.box} ${skeletonStyles.boxHeroTag}`} />
            <div className={`${skeletonStyles.box} ${skeletonStyles.boxHeroTitle}`} />
            <div className={`${skeletonStyles.box} ${skeletonStyles.boxHeroBar}`} />
          </div>

          <div className={skeletonStyles.detailWorkspace}>
            <div className={skeletonStyles.skeletonBase}>
              <div className={`${skeletonStyles.box} ${skeletonStyles.boxSectionTitle}`} />
              {[1, 2, 3].map((i) => (
                <div key={i} className={`${skeletonStyles.box} ${skeletonStyles.boxCardFull}`} />
              ))}
            </div>

            <div className={skeletonStyles.sideColumn}>
              <div className={`${skeletonStyles.skeletonBase} ${skeletonStyles.boxSideCard}`} />
              <div className={`${skeletonStyles.skeletonBase} ${skeletonStyles.boxSideCard}`} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !assignment) {
    return (
      <main className={styles.main}>
        {/* <Header /> */}
        <div className={styles.error}>{error || 'Assignment not found'}</div>
      </main>
    );
  }

  const totalTasks = assignment.tasks.length;
  const completedTasks = assignment.tasks.filter((t) => t.isCompleted).length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <main className={styles.main}>
      {/* <Header /> */}

      <div className={styles.topNav}>
        <Link href="/dashboard/assignments" className={styles.backBtn}>
          <FiArrowLeft /> Back to Assignments
        </Link>
        <button 
          type="button" 
          onClick={() => setIsDeleteModalOpen(true)} 
          className={styles.deleteBtn}
        >
          <FiTrash2 /> Delete Assignment
        </button>
      </div>

      {/* Hero Card */}
      <div className={styles.heroCard}>
        <div className={styles.heroHeader}>
          <span className={styles.courseTag}>{assignment.course?.name || 'General Course'}</span>
          <div className={styles.badgeRow}>
            <span className={styles.priorityBadge}>{assignment.priority} Priority</span>
            <button 
              type="button" 
              onClick={handleToggleStatus}
              className={assignment.status === 'COMPLETED' ? styles.statusCompletedBtn : styles.statusPendingBtn}
            >
              {assignment.status === 'COMPLETED' ? '✓ Completed' : 'Mark as Completed'}
            </button>
          </div>
        </div>

        <h1 className={styles.title}>{assignment.title}</h1>
        {assignment.description && <p className={styles.description}>{assignment.description}</p>}

        <div className={styles.metaGrid}>
          <div>
            <FiCalendar /> Due Date: <strong>{new Date(assignment.deadline).toLocaleString()}</strong>
          </div>
          <div>
            <FiClock /> Estimated Effort: <strong>{assignment.estimatedHours} Hours</strong>
          </div>
        </div>

        <div className={styles.progressBox}>
          <div className={styles.progressLabel}>
            <span>Milestone Progress ({completedTasks}/{totalTasks})</span>
            <strong>{progressPct}%</strong>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* Milestones & AI Coach Workspace */}
      <div className={styles.workspaceGrid}>
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <h3>Assignment Milestones</h3>
            <span>{completedTasks} of {totalTasks} Done</span>
          </div>

          <form onSubmit={handleAddTask} className={styles.addTaskForm}>
            <input
              type="text"
              placeholder="Add new milestone (e.g. Prepare dataset)..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
            />
            <button type="submit" disabled={isAddingTask}>
              <FiPlus /> Add
            </button>
          </form>

          <div className={styles.taskList}>
            {assignment.tasks.map((task) => (
              <div key={task.id} className={`${styles.taskItem} ${task.isCompleted ? styles.completed : ''}`}>
                <button type="button" onClick={() => handleToggleTask(task.id)} className={styles.checkBtn}>
                  {task.isCompleted ? <FiCheckSquare className={styles.checkedIcon} /> : <FiSquare />}
                </button>
                <span className={styles.taskTitle}>{task.title}</span>
                <button type="button" onClick={() => handleDeleteTask(task.id)} className={styles.taskDeleteBtn}>
                  <FiTrash2 />
                </button>
              </div>
            ))}

            {totalTasks === 0 && (
              <div className={styles.emptyTasks}>
                No milestones defined yet. Use AI Coach below to breakdown this assignment!
              </div>
            )}
          </div>
        </div>

        <div className={styles.sideBlock}>
          <div className={styles.aiCoachCard}>
            <div className={styles.aiHeader}>
              <FiZap className={styles.zapIcon} />
              <h4>AI Assignment Coach</h4>
            </div>
            <p>Need help breaking this assignment down into manageable study milestones?</p>
            <button type="button" onClick={handleAICoachBreakdown} className={styles.aiBtn}>
              Auto-Generate Milestones
            </button>
          </div>

          <div className={styles.focusCard}>
            <h4>Focus Timer Engine</h4>
            <p>Ready to start working on this assignment?</p>
            <button type="button" className={styles.focusBtn}>
              <FiPlay /> Launch Focus Session
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className={styles.deleteModalOverlay} onClick={() => setIsDeleteModalOpen(false)}>
          <div className={styles.deleteModalCard} onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className={styles.closeModalBtn} 
              onClick={() => setIsDeleteModalOpen(false)}
            >
              <FiX />
            </button>

            <div className={styles.deleteModalHeader}>
              <div className={styles.warningIconWrapper}>
                <FiAlertTriangle className={styles.warningIcon} />
              </div>
              <div>
                <h3>Delete Assignment?</h3>
                <p>This action cannot be undone. All linked tasks will be permanently removed.</p>
              </div>
            </div>

            {deleteError && (
              <div className={styles.modalErrorBanner}>
                <span>{deleteError}</span>
              </div>
            )}

            <div className={styles.deleteModalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmDeleteBtn}
                onClick={confirmDeleteAssignment}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}