'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBookOpen,
  FiUploadCloud,
  FiTarget,
  FiArrowRight,
  FiArrowLeft,
  FiFileText,
  FiX,
  FiFastForward,
  FiAlertCircle
} from 'react-icons/fi';
import styles from './OnboardingWizard.module.css';
import { CourseFile, OnboardingData } from './types';

export default function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Form State using typed interface
  const [formData, setFormData] = useState<OnboardingData>({
    major: '',
    semester: 'Semester 1',
    courseFiles: [],
    studyGoalHours: 3,
    aiMode: 'balanced',
  });

  const [tempCourseName, setTempCourseName] = useState<string>('');

  // Helper: Call Backend API to Save Data in Neon DB
  const saveOnboardingToDB = async (isSkipped: boolean = false) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      // 1. LocalStorage se current logged-in user nikalein
      const savedUserStr = localStorage.getItem('studyos_user');
      const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;

      if (!savedUser || !savedUser.id) {
        setErrorMessage('User session expired. Please sign in again.');
        setIsLoading(false);
        return;
      }

      // 2. Prepare payload for /api/onboarding
      const payload = {
        userId: savedUser.id,
        major: isSkipped ? null : formData.major,
        semester: isSkipped ? null : formData.semester,
        studyGoalHours: formData.studyGoalHours,
        courses: isSkipped
          ? []
          : formData.courseFiles.map((c) => ({
              courseName: c.courseName,
              fileName: c.file.name,
              fileUrl: '/uploads/' + c.file.name, // Local placeholder path
            })),
      };

      // 3. Post to Backend API
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to save onboarding data.');
        setIsLoading(false);
        return;
      }

      // 4. Update local user status to isOnboarded = true
      savedUser.isOnboarded = true;
      localStorage.setItem('studyos_user', JSON.stringify(savedUser));

      // 5. Navigate to Dashboard
      setIsLoading(false);
      router.push('/dashboard');
    } catch (err) {
      console.error('Onboarding API Save Error:', err);
      setErrorMessage('Network error. Failed to connect to server.');
      setIsLoading(false);
    }
  };

  // Skip Handler
  const handleSkip = () => {
    saveOnboardingToDB(true);
  };

  // Next / Finish Handler
  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Step 3 Complete -> Save to Neon Cloud Database
      saveOnboardingToDB(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  // Multiple Course Syllabus File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: CourseFile[] = Array.from(e.target.files).map((f) => ({
        file: f,
        courseName: tempCourseName.trim() || f.name.replace(/\.[^/.]+$/, ''),
      }));

      setFormData((prev) => ({
        ...prev,
        courseFiles: [...prev.courseFiles, ...newFiles],
      }));
      setTempCourseName('');
    }
  };

  const removeCourseFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      courseFiles: prev.courseFiles.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className={styles.wizardCard}>
      {/* Top Header with Skip Option */}
      <div className={styles.topBar}>
        <span className={styles.stepIndicator}>Step {currentStep} of 3</span>
        <button
          type="button"
          onClick={handleSkip}
          className={styles.skipBtn}
          disabled={isLoading}
        >
          Skip for now <FiFastForward />
        </button>
      </div>

      <div className={styles.progressBarTrack}>
        <motion.div
          className={styles.progressBarFill}
          animate={{ width: `${(currentStep / 3) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div className={styles.errorAlert}>
          <FiAlertCircle /> <span>{errorMessage}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {currentStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={styles.stepContent}
          >
            <div className={styles.iconBadge}><FiBookOpen /></div>
            <h1 className={styles.stepTitle}>Academic Profile</h1>
            <p className={styles.stepSubtitle}>
              Which degree program and semester are you currently enrolled in?
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>Degree Major</label>
              <input
                type="text"
                placeholder="e.g. Computer Science, BS Software Engineering"
                value={formData.major}
                onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className={styles.select}
              >
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
                <option value="Semester 3">Semester 3</option>
                <option value="Semester 4">Semester 4</option>
                <option value="Semester 5">Semester 5</option>
                <option value="Semester 6">Semester 6</option>
                <option value="Semester 7">Semester 7</option>
                <option value="Final Year Project / Thesis">Final Year Project / Thesis</option>
              </select>
            </div>
          </motion.div>
        )}

        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={styles.stepContent}
          >
            <div className={styles.iconBadge}><FiUploadCloud /></div>
            <h1 className={styles.stepTitle}>Upload Course Syllabi</h1>
            <p className={styles.stepSubtitle}>
              Upload PDFs for your individual subjects (e.g., AI, Operating Systems, Web Dev).
            </p>

            <div className={styles.uploadBox}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Subject / Course Tag (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Artificial Intelligence"
                  value={tempCourseName}
                  onChange={(e) => setTempCourseName(e.target.value)}
                  className={styles.input}
                />
              </div>

              <label htmlFor="multiFileUpload" className={styles.dropzoneLabel}>
                <FiUploadCloud className={styles.dropIcon} />
                <span>Choose Syllabus PDFs or Timetable</span>
                <input
                  id="multiFileUpload"
                  type="file"
                  multiple
                  accept=".pdf,.docx,.png,.jpg"
                  onChange={handleFileUpload}
                  className={styles.hiddenInput}
                />
              </label>
            </div>

            {formData.courseFiles.length > 0 && (
              <div className={styles.courseFileList}>
                <h4>Uploaded Subject Outlines ({formData.courseFiles.length}):</h4>
                {formData.courseFiles.map((item, idx) => (
                  <div key={idx} className={styles.courseFileItem}>
                    <div className={styles.fileDetails}>
                      <FiFileText className={styles.fileIcon} />
                      <div>
                        <strong>{item.courseName}</strong>
                        <p>{item.file.name}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCourseFile(idx)}
                      className={styles.removeBtn}
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {currentStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={styles.stepContent}
          >
            <div className={styles.iconBadge}><FiTarget /></div>
            <h1 className={styles.stepTitle}>Preferences Locked!</h1>
            <p className={styles.stepSubtitle}>
              Your StudyOS workspace is ready to generate source-grounded study plans and AI tutors.
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Daily Target: <strong className={styles.highlightText}>{formData.studyGoalHours} Hours/Day</strong>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.studyGoalHours}
                onChange={(e) =>
                  setFormData({ ...formData, studyGoalHours: parseInt(e.target.value) })
                }
                className={styles.rangeInput}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Navigation Controls */}
      <div className={styles.footerControls}>
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className={styles.backBtn}
            disabled={isLoading}
          >
            <FiArrowLeft /> Back
          </button>
        )}

        <button
          type="button"
          onClick={handleNext}
          className={styles.nextBtn}
          disabled={isLoading || (currentStep === 1 && !formData.major.trim())}
        >
          {isLoading
            ? 'Saving to Cloud DB...'
            : currentStep === 3
            ? 'Go to Dashboard'
            : 'Continue'}
          <FiArrowRight />
        </button>
      </div>
    </div>
  );
}