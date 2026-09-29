'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
// import Header from '@/components/layout/Header/Header';
import { apiRequest, getCachedApiResponse } from '@/lib/apiClient';
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

type CachedAssignmentDetail = Omit<AssignmentDetail, 'tasks'> & { studyTasks?: Task[] };

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
  const [newTaskMinutes, setNewTaskMinutes] = useState('60');
  const [taskError, setTaskError] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isGeneratingMilestones, setIsGeneratingMilestones] = useState(false);
  const [isMilestoneChoiceOpen, setIsMilestoneChoiceOpen] = useState(false);
  const [milestoneGenerationError, setMilestoneGenerationError] = useState('');

  // Custom Delete Confirmation Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  

  // Silent Fetcher
  const fetchAssignmentDetail = useCallback(async (isInitial = false) => {
    try {
      const cachedAssignment = getCachedApiResponse<{ data?: { assignment?: CachedAssignmentDetail } }>(`/assignments/${assignmentId}`)?.data?.assignment;
      if (cachedAssignment) setAssignment({ ...cachedAssignment, tasks: cachedAssignment.studyTasks || [] });
      if (isInitial && !cachedAssignment) setLoading(true);
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
      showToast(err.message || 'This milestone could not be updated. Please try again.', 'error');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError('');
    if (!newTaskTitle.trim()) {
      setTaskError('Enter a name for this milestone.');
      return;
    }
    const minutes = Number(newTaskMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60000) {
      setTaskError('Enter a whole number of minutes between 1 and 60,000.');
      return;
    }
    const allocatedMinutes = assignment?.tasks.reduce((total, task) => total + task.estimatedHours * 60, 0) ?? 0;
    const assignmentMinutes = Math.round((assignment?.estimatedHours ?? 0) * 60);
    const remainingMinutes = Math.max(0, assignmentMinutes - allocatedMinutes);
    if (minutes > remainingMinutes) {
      setTaskError(`This milestone is ${minutes} minutes, but only ${Math.floor(remainingMinutes + 0.000001)} minutes remain in this ${assignmentMinutes}-minute assignment. Reduce the milestone time to fit.`);
      return;
    }

    try {
      setIsAddingTask(true);
      await apiRequest(`/assignments/${assignmentId}/tasks`, 'POST', {
        title: newTaskTitle.trim(),
        estimatedHours: minutes / 60,
      });
      setNewTaskTitle('');
      setNewTaskMinutes('60');
      showToast('Milestone added successfully!', 'success');
      await fetchAssignmentDetail(false);
    } catch (err: any) {
      const message = err?.message || 'This milestone could not be added. Please try again.';
      setTaskError(message);
      showToast(message, 'error');
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
      setMilestoneGenerationError('');
      setIsMilestoneChoiceOpen(true);
      return;
    }
    await generateMilestones(true);
  };

  const generateMilestones = async (preserveExisting: boolean) => {
    try {
      setIsGeneratingMilestones(true);
      setMilestoneGenerationError('');
      const result: any = await apiRequest(`/assignments/${assignmentId}/tasks/regenerate`, 'POST', { preserveExisting });
      await fetchAssignmentDetail(false);
      setIsMilestoneChoiceOpen(false);
      showToast(result.data?.message || 'Your AI milestone plan is ready.', 'success');
    } catch (err: any) {
      if (isMilestoneChoiceOpen) setMilestoneGenerationError(err.message || 'Milestones could not be generated. Please try again.');
      else showToast(err.message || 'Milestones could not be generated. Please try again.', 'error');
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

          {taskError && <p className={styles.taskError} role="alert">{taskError}</p>}
          <p className={styles.taskBudget}>
            Available assignment time: {formatStudyDuration(Math.max(0, assignment.estimatedHours - assignment.tasks.reduce((total, task) => total + task.estimatedHours, 0)))}
          </p>
          <form onSubmit={handleAddTask} className={styles.addTaskForm}>
            <input
              type="text"
              placeholder="Enter milestone name"
              value={newTaskTitle}
              onChange={(e) => { setNewTaskTitle(e.target.value); setTaskError(''); }}
              required
              disabled={isAddingTask || isGeneratingMilestones}
            />
            <label className={styles.taskDurationField}>
              Minutes
              <input
                type="number"
                min="1"
                max="60000"
                step="1"
                value={newTaskMinutes}
                onChange={(e) => { setNewTaskMinutes(e.target.value); setTaskError(''); }}
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
              {isGeneratingMilestones ? 'Creating your AI plan...' : totalTasks ? 'Create AI Milestones' : 'Generate AI Milestones'}
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
      {isMilestoneChoiceOpen && (
        <div className={styles.choiceOverlay} onClick={() => !isGeneratingMilestones && setIsMilestoneChoiceOpen(false)}>
          <section className={styles.choiceDialog} role="dialog" aria-modal="true" aria-labelledby="milestone-choice-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="milestone-choice-title">What should happen to your current milestones?</h2>
            <p>You have {assignment.tasks.length} existing milestone{assignment.tasks.length === 1 ? '' : 's'}. Choose whether to keep them or replace them with a new AI plan.</p>
            {milestoneGenerationError && <p className={styles.taskError} role="alert">{milestoneGenerationError}</p>}
            <button type="button" className={styles.keepMilestonesButton} disabled={isGeneratingMilestones} onClick={() => void generateMilestones(true)}>
              {isGeneratingMilestones ? 'Creating your plan...' : 'Keep mine and add missing milestones'}
            </button>
            <button type="button" className={styles.replaceMilestonesButton} disabled={isGeneratingMilestones} onClick={() => void generateMilestones(false)}>
              Replace all with a new AI plan
            </button>
            <p className={styles.choiceNote}>Replacing permanently removes these milestones and their scheduled sessions. An active session must be stopped first.</p>
            <button type="button" className={styles.cancelChoiceButton} disabled={isGeneratingMilestones} onClick={() => setIsMilestoneChoiceOpen(false)}>Cancel</button>
          </section>
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
