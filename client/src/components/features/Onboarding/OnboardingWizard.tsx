'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/apiClient';
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
  FiAlertCircle,
  FiPlus,
  FiPaperclip
} from 'react-icons/fi';
import styles from './OnboardingWizard.module.css';

export interface CourseItem {
  courseName: string;
  file?: File;
}

export interface OnboardingData {
  major: string;
  semester: string;
  courseFiles: CourseItem[];
  studyGoalHours: number;
  aiMode: 'balanced' | 'rigorous' | 'exam_prep';
}

export default function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Local state for Step 2 manual addition
  const [tempSubjectName, setTempSubjectName] = useState<string>('');
  const [tempSubjectFile, setTempSubjectFile] = useState<File | null>(null);

  // Main Onboarding Form State
  const [formData, setFormData] = useState<OnboardingData>({
    major: '',
    semester: 'Semester 1',
    courseFiles: [],
    studyGoalHours: 3,
    aiMode: 'balanced',
  });

  // Step 2: Add Subject Logic (Name Mandatory, File Optional)
  const handleAddSubject = () => {
    if (!tempSubjectName.trim()) {
      setErrorMessage('Subject Name is mandatory! Please type a subject name.');
      return;
    }

    const newCourse: CourseItem = {
      courseName: tempSubjectName.trim(),
      file: tempSubjectFile || undefined,
    };

    setFormData((prev) => ({
      ...prev,
      courseFiles: [...prev.courseFiles, newCourse],
    }));

    // Reset temporary input values & clean error
    setTempSubjectName('');
    setTempSubjectFile(null);
    setErrorMessage('');
  };

  const handleRemoveSubject = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      courseFiles: prev.courseFiles.filter((_, i) => i !== index),
    }));
  };

  const handleAttachFileToItem = (index: number, file: File) => {
    setFormData((prev) => {
      const updated = [...prev.courseFiles];
      updated[index].file = file;
      return { ...prev, courseFiles: updated };
    });
  };

  // Express Backend Sync via apiClient
  const saveOnboardingToDB = async (isSkipped: boolean = false) => {
  setIsLoading(true);
  setErrorMessage('');

  try {
    const payload = {
      major: isSkipped ? 'General' : formData.major || 'General',
      semesterName: isSkipped ? 'Semester 1' : formData.semester,
      dailyGoalHours: formData.studyGoalHours,
      aiMode: formData.aiMode || 'balanced',
      courses: isSkipped ? [] : formData.courseFiles.map((c) => c.courseName),
    };

    await apiRequest('/user/onboard', 'POST', payload);

    const savedUserStr = localStorage.getItem('studyos_user');
    const savedUser = savedUserStr ? JSON.parse(savedUserStr) : {};
    savedUser.isOnboarded = true;
    savedUser.major = payload.major;
    savedUser.semester = payload.semesterName;
    localStorage.setItem('studyos_user', JSON.stringify(savedUser));

    router.replace('/dashboard');
  } catch (err: any) {
    console.error('Onboarding Express API Save Error:', err);
    setErrorMessage(err.message || 'Failed to save onboarding data.');
    // Redirection fallback if error occurs
    router.replace('/dashboard');
  } finally {
    setIsLoading(false);
  }
};

  // Skip Handler (Directly bypasses step validations)
  const handleSkip = () => {
    saveOnboardingToDB(true);
  };

  // Step Validation & Navigation Control
  const handleNext = () => {
    setErrorMessage('');

    // Step 1 Validation Rule: Major is required
    if (currentStep === 1) {
      if (!formData.major.trim()) {
        setErrorMessage('Degree Major is mandatory! Please enter your major or click "Skip for now".');
        return;
      }
      setCurrentStep(2);
      return;
    }

    // Step 2 Validation Rule: At least 1 subject must be added
    if (currentStep === 2) {
      if (formData.courseFiles.length === 0) {
        setErrorMessage('Please add at least one subject to continue, or click "Skip for now".');
        return;
      }
      setCurrentStep(3);
      return;
    }

    // Step 3 Complete: Save to DB
    if (currentStep === 3) {
      saveOnboardingToDB(false);
    }
  };

  const handleBack = () => {
    setErrorMessage('');
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
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

      {/* Validation / Error Message Alert */}
      {errorMessage && (
        <div className={styles.errorAlert}>
          <FiAlertCircle className={styles.errorIcon} /> 
          <span>{errorMessage}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* STEP 1: Academic Profile */}
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
              Tell us about your degree program and current semester.
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Degree Major <span className={styles.requiredStar}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. BS Computer Science, Software Engineering"
                value={formData.major}
                onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Current Semester</label>
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

        {/* STEP 2: Subject & Syllabus Setup */}
        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={styles.stepContent}
          >
            <div className={styles.iconBadge}><FiUploadCloud /></div>
            <h1 className={styles.stepTitle}>Your Subjects & Outlines</h1>
            <p className={styles.stepSubtitle}>
              Subject name is mandatory. Slides/PDFs are optional.
            </p>

            {/* Input Box for Subject & Optional File */}
            <div className={styles.addSubjectBox}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Subject Name <span className={styles.requiredStar}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Artificial Intelligence"
                  value={tempSubjectName}
                  onChange={(e) => setTempSubjectName(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.fileInputRow}>
                <label htmlFor="tempFile" className={styles.fileLabelBtn}>
                  <FiPaperclip /> 
                  {tempSubjectFile ? tempSubjectFile.name : 'Attach Syllabus PDF (Optional)'}
                </label>
                <input
                  id="tempFile"
                  type="file"
                  accept=".pdf,.docx,.png,.jpg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setTempSubjectFile(e.target.files[0]);
                    }
                  }}
                  className={styles.hiddenInput}
                />
                
                {tempSubjectFile && (
                  <button 
                    type="button" 
                    onClick={() => setTempSubjectFile(null)}
                    className={styles.clearFileBtn}
                  >
                    <FiX />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddSubject}
                className={styles.addSubjectBtn}
              >
                <FiPlus /> Add Subject
              </button>
            </div>

            {/* Added Subjects List */}
            {formData.courseFiles.length > 0 && (
              <div className={styles.courseFileList}>
                <h4>Added Subjects ({formData.courseFiles.length}):</h4>
                {formData.courseFiles.map((item, idx) => (
                  <div key={idx} className={styles.courseFileItem}>
                    <div className={styles.fileDetails}>
                      <FiFileText className={styles.fileIcon} />
                      <div>
                        <strong>{item.courseName}</strong>
                        {item.file ? (
                          <span className={styles.fileNameAttached}>
                            📄 {item.file.name}
                          </span>
                        ) : (
                          <label className={styles.inlineAttachBtn}>
                            + Attach Slide
                            <input
                              type="file"
                              accept=".pdf,.docx,.png,.jpg"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleAttachFileToItem(idx, e.target.files[0]);
                                }
                              }}
                              className={styles.hiddenInput}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(idx)}
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

        {/* STEP 3: Study Goals */}
        {currentStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={styles.stepContent}
          >
            <div className={styles.iconBadge}><FiTarget /></div>
            <h1 className={styles.stepTitle}>Study Goal Settings</h1>
            <p className={styles.stepSubtitle}>
              Configure daily study hours for your zero-penalty adaptive planner.
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
          disabled={isLoading}
        >
          {isLoading
            ? 'Saving...'
            : currentStep === 3
            ? 'Go to Dashboard'
            : 'Continue'}
          <FiArrowRight />
        </button>
      </div>
    </div>
  );
}