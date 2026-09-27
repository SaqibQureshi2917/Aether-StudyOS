'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
// import Header from '@/components/layout/Header/Header';
import { apiRequest } from '@/lib/apiClient';
import { useToast } from '@/components/layout/toast/ToastContext';
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
} from 'react-icons/fi';
import styles from './assignmentDetail.module.css';
import skeletonStyles from '@/styles/skeletons.module.css';
import ConfirmDialog from '@/components/layout/ConfirmDialog/ConfirmDialog';

interface Task {
  id: string;
  title: string;
  estimatedHours: number;
  status: string;
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
  const { showToast } = useToast();

  // Task Creation State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskMinutes, setNewTaskMinutes] = useState(60);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isGeneratingMilestones, setIsGeneratingMilestones] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [regenerateError, setRegenerateError] = useState('');

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
        const { studyTasks, ...assignmentData } = res.data.assignment;
        setAssignment({ ...assignmentData, tasks: studyTasks || [] });
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
      setBusyTaskId(taskId);
      await apiRequest(`/assignments/${assignmentId}/tasks/${taskId}`, 'PATCH');
      await fetchAssignmentDetail(false);
    } catch (err: any) {
      console.error('Failed to toggle task:', err);
      showToast(err.message || 'Failed to update milestone.', 'error');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      setIsAddingTask(true);
      await apiRequest(`/assignments/${assignmentId}/tasks`, 'POST', {
        title: newTaskTitle.trim(),
        estimatedHours: newTaskMinutes / 60,
      });
      setNewTaskTitle('');
      setNewTaskMinutes(60);
      showToast('Milestone added successfully!', 'success');
      await fetchAssignmentDetail(false);
    } catch (err) {
      console.error('Failed to add task:', err);
      showToast('Failed to add milestone.', 'error');
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      setBusyTaskId(taskId);
      await apiRequest(`/assignments/${assignmentId}/tasks/${taskId}`, 'DELETE');
      showToast('Milestone deleted successfully.', 'info');
      await fetchAssignmentDetail(false);
    } catch (err: any) {
      console.error('Failed to delete task:', err);
      showToast(err.message || 'Failed to delete milestone.', 'error');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleToggleStatus = async () => {
    try {
      setIsUpdatingStatus(true);
      await apiRequest(`/assignments/${assignmentId}/status`, 'PATCH');
      await fetchAssignmentDetail(false);
    } catch (err: any) {
      console.error('Failed to update assignment status:', err);
      showToast(err.message || 'Failed to update assignment status.', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const confirmDeleteAssignment = async () => {
    try {
      setIsDeleting(true);
      setDeleteError('');
      await apiRequest(`/assignments/${assignmentId}`, 'DELETE');

      showToast('Assignment deleted Succesfully.', 'info')
      router.push('/dashboard/assignments');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete assignment. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleAICoachBreakdown = async () => {
    if (isGeneratingMilestones || isAddingTask || busyTaskId) return;
    if (assignment?.tasks.length) {
      setRegenerateError('');
      setIsRegenerateModalOpen(true);
      return;
    }
    await generateMilestones();
  };

  const generateMilestones = async () => {
    try {
      setIsGeneratingMilestones(true);
      setRegenerateError('');
      await apiRequest(`/assignments/${assignmentId}/tasks/regenerate`, 'POST');
      await fetchAssignmentDetail(false);
      setIsRegenerateModalOpen(false);
      showToast('Milestones regenerated successfully.', 'success');
    } catch (err: any) {
      console.error('AI Coach Task Generation Error:', err);
      if (isRegenerateModalOpen) setRegenerateError(err.message || 'Failed to regenerate milestones.');
      else showToast(err.message || 'Failed to generate milestones.', 'error');
    } finally {
      setIsGeneratingMilestones(false);
    }
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

  // Safe checks added here to prevent undefined length crashes!
  const totalTasks = assignment.tasks?.length || 0;
  const completedTasks = assignment.tasks?.filter((t) => t.status === 'COMPLETED')?.length || 0;
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
              disabled={isUpdatingStatus}
              className={assignment.status === 'COMPLETED' ? styles.statusCompletedBtn : styles.statusPendingBtn}
            >
              {isUpdatingStatus ? 'Updating...' : assignment.status === 'COMPLETED' ? '✓ Completed' : 'Mark as Completed'}
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
            <FiClock /> Estimated Effort: <strong>{formatStudyDuration(assignment.estimatedHours)}</strong>
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
              disabled={isAddingTask || isGeneratingMilestones}
            />
            <label className={styles.taskDurationField}>
              Minutes
              <input
                type="number"
                min="7"
                max="60000"
                step="1"
                value={newTaskMinutes}
                onChange={(e) => setNewTaskMinutes(Math.max(7, parseInt(e.target.value, 10) || 7))}
                aria-label="Milestone estimated time in minutes"
                disabled={isAddingTask || isGeneratingMilestones}
              />
            </label>
            <button type="submit" disabled={isAddingTask || isGeneratingMilestones}>
              <FiPlus /> {isAddingTask ? 'Adding...' : 'Add'}
            </button>
          </form>

          <div className={styles.taskList}>
            {assignment.tasks?.map((task) => (
              <div key={task.id} className={`${styles.taskItem} ${task.status === 'COMPLETED' ? styles.completed : ''}`}>
                <button type="button" onClick={() => handleToggleTask(task.id)} className={styles.checkBtn} disabled={Boolean(busyTaskId) || isGeneratingMilestones} aria-label={task.status === 'COMPLETED' ? 'Mark milestone incomplete' : 'Mark milestone complete'}>
                  {task.status === 'COMPLETED' ? <FiCheckSquare className={styles.checkedIcon} /> : <FiSquare />}
                </button>
                <span className={styles.taskTitle}>{task.title}</span>
                <span className={styles.taskDuration}>{formatStudyDuration(task.estimatedHours)}</span>
                <button type="button" onClick={() => handleDeleteTask(task.id)} className={styles.taskDeleteBtn} disabled={Boolean(busyTaskId) || isGeneratingMilestones} aria-label="Delete milestone">
                  {busyTaskId === task.id ? '…' : <FiTrash2 />}
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
            <button type="button" onClick={handleAICoachBreakdown} className={styles.aiBtn} disabled={isGeneratingMilestones || isAddingTask || Boolean(busyTaskId)}>
              {isGeneratingMilestones ? 'Generating milestones...' : totalTasks ? 'Regenerate Milestones' : 'Auto-Generate Milestones'}
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

      {isDeleteModalOpen && (
        <ConfirmDialog
          title="Delete this assignment?"
          description="This permanently deletes the assignment, its milestones, and linked study sessions. This action cannot be undone."
          confirmLabel="Yes, delete assignment"
          busyLabel="Deleting assignment..."
          isBusy={isDeleting}
          errorMessage={deleteError}
          tone="danger"
          onCancel={() => setIsDeleteModalOpen(false)}
          onConfirm={confirmDeleteAssignment}
        />
      )}
      {isRegenerateModalOpen && (
        <ConfirmDialog
          title="Replace existing milestones?"
          description="The current milestones and their linked scheduled study sessions will be removed and replaced with a new set. Any active study session must be stopped first."
          confirmLabel="Yes, replace milestones"
          busyLabel="Replacing milestones..."
          isBusy={isGeneratingMilestones}
          errorMessage={regenerateError}
          onCancel={() => setIsRegenerateModalOpen(false)}
          onConfirm={generateMilestones}
        />
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
