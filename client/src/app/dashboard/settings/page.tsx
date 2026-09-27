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

export default function SettingsPage() {
  const { user, setAuthenticatedUser } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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
    setSaveError('');
    try {
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
      setIsSaved(true);
      window.setTimeout(() => setIsSaved(false), 3000);
    } catch (error: any) {
      setSaveError(error?.message || 'Could not save your profile. Please try again.');
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

        {saveError && <p role="alert">{saveError}</p>}

        <form id="settingsForm" onSubmit={handleSave} className={styles.formGrid}>
          
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
                    required
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
                    required
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
                    required
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
                  required
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
                Daily Study Target: <strong className={styles.accentText}>{dailyHours} Hours/Day</strong>
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={dailyHours}
                onChange={(e) => setDailyHours(parseInt(e.target.value))}
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

    </div>
  );
}
