'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar/Sidebar';
import OnboardingWizard from '@/components/features/Onboarding/OnboardingWizard';
import { 
  FiUser, 
  FiMail, 
  FiBook, 
  FiSliders, 
  FiBell, 
  FiSave, 
  FiTrash2, 
  FiCheck, 
  FiLock 
} from 'react-icons/fi';
import styles from './settings.module.css';

export default function SettingsPage() {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Profile & Preference States
  const [fullName, setFullName] = useState('Qureshi Developer');
  const [email, setEmail] = useState('qureshi@university.edu');
  const [major, setMajor] = useState('Computer Science');
  const [semester, setSemester] = useState('Semester 7');
  const [dailyHours, setDailyHours] = useState(3);
  const [aiMode, setAiMode] = useState<'balanced' | 'rigorous'>('balanced');
  const [enableNotifs, setEnableNotifs] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className={styles.settingsLayout}>
      <Sidebar onOpenSetupModal={() => setIsSetupOpen(true)} />

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
            {isSaved ? <><FiCheck /> Preferences Saved!</> : <><FiSave /> Save Changes</>}
          </button>
        </header>

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
                    onChange={(e) => setEmail(e.target.value)}
                    className={styles.input}
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
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className={styles.select}
                >
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                  <option value="Semester 3">Semester 3</option>
                  <option value="Semester 4">Semester 4</option>
                  <option value="Semester 5">Semester 5</option>
                  <option value="Semester 6">Semester 6</option>
                  <option value="Semester 7">Semester 7</option>
                  <option value="Final Year / Thesis">Final Year / Thesis</option>
                </select>
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
                <p>Control deadline alerts and manage uploaded course outlines.</p>
              </div>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <strong className={styles.toggleTitle}>Deadline & Reschedule Alerts</strong>
                <p className={styles.toggleSubtitle}>Receive automatic notifications when practice tasks are updated.</p>
              </div>
              <input
                type="checkbox"
                checked={enableNotifs}
                onChange={(e) => setEnableNotifs(e.target.checked)}
                className={styles.toggleCheckbox}
              />
            </div>

            <div className={styles.dangerZone}>
              <div>
                <strong className={styles.dangerTitle}>Clear Active Course Syllabi</strong>
                <p className={styles.dangerSubtitle}>Remove all uploaded course outlines and reset your planner engine.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsSetupOpen(true)}
                className={styles.resetBtn}
              >
                <FiTrash2 /> Re-upload Courses
              </button>
            </div>
          </section>

        </form>
      </main>

      {/* Onboarding / Setup Modal */}
      {isSetupOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSetupOpen(false)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className={styles.closeModalBtn} 
              onClick={() => setIsSetupOpen(false)}
            >
              ✕
            </button>
            <OnboardingWizard />
          </div>
        </div>
      )}
    </div>
  );
}