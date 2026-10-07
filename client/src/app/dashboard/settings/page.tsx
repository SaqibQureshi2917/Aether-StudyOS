'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/apiClient';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  FiUser, 
  FiMail, 
  FiBook, 
  FiSliders, 
  FiBell, 
  FiSave, 
  FiCheck, 
} from 'react-icons/fi';
import styles from './settings.module.css';
import { useToast } from '@/components/layout/toast/ToastContext';

export default function SettingsPage() {
  const { user, setAuthenticatedUser } = useAuth();
  const { showToast } = useToast();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [plannerNotice, setPlannerNotice] = useState('');
  const [goalChangeStage, setGoalChangeStage] = useState<'PLAN' | 'COMPLETED_SESSIONS' | null>(null);
  const [previousDailyGoal, setPreviousDailyGoal] = useState<number | null>(null);

  // Profile & Preference States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [major, setMajor] = useState('');
  const [semester, setSemester] = useState('');
  const [dailyHours, setDailyHours] = useState(3);
  const [aiMode, setAiMode] = useState<'balanced' | 'rigorous' | 'exam_prep'>('balanced');

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || '');
    setEmail(user.email || '');
    setMajor(user.major || '');
    setSemester(user.currentSemester || '');
    setDailyHours(user.dailyGoalHours ?? 3);
    const mode = user.aiMode?.toLowerCase();
    setAiMode(mode === 'rigorous' || mode === 'exam_prep' ? mode : 'balanced');
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setPlannerNotice('');
    try {
      const oldDailyGoal = user?.dailyGoalHours ?? 3;
      const goalChanged = Math.abs(oldDailyGoal - dailyHours) >= 1 / 60;
      const response: any = await apiRequest('/user/profile', 'PATCH', {
        fullName,
        major,
        currentSemester: semester,
        dailyGoalHours: dailyHours,
        aiMode,
      });
      const updatedUser = response.data?.user;
      if (!updatedUser) throw new Error('The updated profile was not returned by the server.');
      setAuthenticatedUser(updatedUser);
      if (goalChanged) {
        setPreviousDailyGoal(oldDailyGoal);
        setGoalChangeStage('PLAN');
        setPlannerNotice('Your daily target is saved. Choose whether the current planner should stay as it is or be updated.');
      } else setPlannerNotice('Your settings have been saved.');
      setIsSaved(true);
      window.setTimeout(() => setIsSaved(false), 3000);
    } catch (error: any) {
      showToast(error?.message || 'Could not save your profile. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updatePlannerForGoal = async (repeatCompletedSessions: boolean) => {
    setIsSaving(true);
    try {
      const semesters: any = await apiRequest('/semesters', 'GET');
      const activeSemester = semesters.data?.semesters?.find((item: { status: string }) => item.status === 'ACTIVE');
      if (!activeSemester) {
        setPlannerNotice('Your daily target is saved. Create or activate a semester before updating its planner.');
        setGoalChangeStage(null);
        return;
      }
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const repeatCycleId = repeatCompletedSessions ? crypto.randomUUID() : undefined;
      const options = { repeatCompletedSessions, ...(repeatCycleId ? { repeatCycleId } : {}) };
      const preview: any = await apiRequest('/planner/preview', 'POST', { semesterId: activeSemester.id, timeZone, ...options });
      if (!preview.data?.sessions?.length) {
        setPlannerNotice('No sessions fit the updated target and deadlines. Your existing planner sessions were left unchanged. Review the planner conflicts before trying again.');
        setGoalChangeStage(null);
        return;
      }
      await apiRequest('/planner/apply', 'POST', { semesterId: activeSemester.id, previewHash: preview.data.previewHash, timeZone, ...options });
      const repeatedCount = preview.data.repeatedCompletedCount || 0;
      setPlannerNotice(repeatCompletedSessions && repeatedCount
        ? 'Planner updated. ' + repeatedCount + ' completed study session' + (repeatedCount === 1 ? '' : 's') + ' scheduled again; their original history remains saved.'
        : 'Planner updated. Completed sessions remain saved in your study history.');
      setGoalChangeStage(null);
    } catch (error: any) {
      showToast(error?.message || 'The planner could not be updated. Your current schedule is still saved.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.settingsLayout}>
      <main className={styles.mainContent}>
        {/* Header */}
        <header className={styles.topHeader}>
          <div>
            <h1 className={styles.pageTitle}>Account & Settings</h1>
            <p className={styles.pageSubtitle}>
              Manage your academic profile, AI tutor behavior, and workspace preferences.
            </p>
          </div>

          <button 
            type="submit" 
            form="settingsForm" 
            className={styles.saveBtn}
          >
            {isSaving ? 'Saving...' : isSaved ? <><FiCheck /> Preferences Saved!</> : <><FiSave /> Save Changes</>}
          </button>
        </header>

        {plannerNotice && <p role="status">{plannerNotice}</p>}

        <form id="settingsForm" noValidate onSubmit={handleSave} className={styles.formGrid}>
          
          {/* Section 1: Academic Profile Information */}
          <section className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}><FiUser /></div>
              <div>
                <h3>Academic Profile</h3>
                <p>Your personal information and active university enrollment details.</p>
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Full Name</label>
                <div className={styles.inputWrapper}>
                  <FiUser className={styles.inputIcon} />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>University Email</label>
                <div className={styles.inputWrapper}>
                  <FiMail className={styles.inputIcon} />
                  <input
                    type="email"
                    value={email}
                    className={styles.input}
                    disabled
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Degree Major</label>
                <div className={styles.inputWrapper}>
                  <FiBook className={styles.inputIcon} />
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Current Semester</label>
                <input
                  type="text"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className={styles.input}
                  maxLength={100}
                />
              </div>
            </div>
          </section>

          {/* Section 2: AI Engine & Study Preferences */}
          <section className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}><FiSliders /></div>
              <div>
                <h3>AI Tutor Preferences</h3>
                <p>Configure daily target hours and response behavior for source-grounded answers.</p>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Daily Study Target: <strong className={styles.accentText}>{formatStudyGoal(dailyHours)}</strong>
              </label>
              <input
                type="range"
                min="7"
                max="480"
                step="1"
                value={Math.round(dailyHours * 60)}
                onChange={(e) => setDailyHours(Number(e.target.value) / 60)}
                className={styles.rangeInput}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>AI Interaction Mode</label>
              <div className={styles.modeGrid}>
                <div
                  className={aiMode === 'balanced' ? styles.activeModeCard : styles.modeCard}
                  onClick={() => setAiMode('balanced')}
                >
                  <h4>Balanced Tutor</h4>
                  <p>Step-by-step guidance with clear conceptual summaries.</p>
                </div>
                <div
                  className={aiMode === 'rigorous' ? styles.activeModeCard : styles.modeCard}
                  onClick={() => setAiMode('rigorous')}
                >
                  <h4>Deep Dive</h4>
                  <p>Strict source citation, advanced questioning, and exam-focused probing.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Notifications & Data Management */}
          <section className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}><FiBell /></div>
              <div>
                <h3>Notifications & Course Data</h3>
                <p>Notification delivery and course management are not available yet.</p>
              </div>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <strong className={styles.toggleTitle}>Deadline & Reschedule Alerts</strong>
                <p className={styles.toggleSubtitle}>Notifications are not available yet.</p>
              </div>
              <span className={styles.toggleSubtitle}>Notification delivery is not available yet.</span>
            </div>

            <div className={styles.dangerZone}>
              <div>
                <strong className={styles.dangerTitle}>Course Data</strong>
                <p className={styles.dangerSubtitle}>Manage your courses and semesters from the <Link href="/dashboard/courses">Courses workspace</Link>.</p>
              </div>
            </div>
          </section>

        </form>
      </main>

      {goalChangeStage && <div className={styles.plannerDialogOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setGoalChangeStage(null); }}>
        <section className={styles.plannerDialog} role="dialog" aria-modal="true" aria-labelledby="planner-goal-dialog-title">
          <h2 id="planner-goal-dialog-title">Daily study target changed</h2>
          {goalChangeStage === 'PLAN' ? <>
            <p>Your target changed from {formatStudyGoal(previousDailyGoal ?? 0)} to {formatStudyGoal(dailyHours)}. What should happen to your existing planner?</p>
            <div className={styles.plannerDialogActions}>
              <button type="button" className={styles.plannerKeepButton} disabled={isSaving} onClick={() => { setGoalChangeStage(null); setPlannerNotice('Daily target saved. Your existing planner sessions were left unchanged.'); }}>Keep current planner</button>
              <button type="button" className={styles.plannerUpdateButton} disabled={isSaving} onClick={() => setGoalChangeStage('COMPLETED_SESSIONS')}>Update planner</button>
            </div>
          </> : <>
            <p>Your completed study history will stay intact. Should the completed study sessions from the current plan be scheduled again as new work?</p>
            <div className={styles.plannerDialogActions}>
              <button type="button" className={styles.plannerKeepButton} disabled={isSaving} onClick={() => void updatePlannerForGoal(false)}>Skip completed sessions</button>
              <button type="button" className={styles.plannerUpdateButton} disabled={isSaving} onClick={() => void updatePlannerForGoal(true)}>{isSaving ? 'Updating…' : 'Schedule them again'}</button>
            </div>
          </>}
        </section>
      </div>}

    </div>
  );
}

function formatStudyGoal(hours: number) {
  const minutes = Math.round(hours * 60);
  const wholeHours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const duration = [wholeHours ? `${wholeHours} hr${wholeHours === 1 ? '' : 's'}` : '', remainingMinutes ? `${remainingMinutes} min` : '']
    .filter(Boolean).join(' ');
  return `${duration || '0 min'} / day`;
}
