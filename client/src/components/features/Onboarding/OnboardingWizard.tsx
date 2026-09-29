'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBookOpen,
  FiUploadCloud,
  FiTarget,
  FiArrowRight,
  FiArrowLeft,
  FiX,
  FiFastForward,
  FiAlertCircle,
  FiPlus,
  FiFileText,
} from 'react-icons/fi';
import styles from './OnboardingWizard.module.css';
import { useToast } from '@/components/layout/toast/ToastContext';

export interface CourseItem {
  courseName: string;
  files: File[];
}

export interface OnboardingData {
  major: string;
  semester: string;
  semesterStartDate: string;
  semesterEndDate: string;
  courseFiles: CourseItem[];
  studyGoalHours: number;
  aiMode: 'balanced' | 'rigorous' | 'exam_prep';
}

export default function OnboardingWizard() {
  const router = useRouter();
  const { setAuthenticatedUser } = useAuth();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Local state for Step 2 course addition
  const [tempSubjectName, setTempSubjectName] = useState<string>('');
  const [tempSubjectFiles, setTempSubjectFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Main Onboarding Form State
  const [formData, setFormData] = useState<OnboardingData>({
    major: '',
    semester: 'Semester 1',
    semesterStartDate: '',
    semesterEndDate: '',
    courseFiles: [],
    studyGoalHours: 3,
    aiMode: 'balanced',
  });

  // Step 2: Add Subject Logic
  const handleAddSubject = () => {
    if (!tempSubjectName.trim()) {
      setErrorMessage('Subject Name is mandatory! Please type a subject name.');
      return;
    }

    const newCourse: CourseItem = { courseName: tempSubjectName.trim(), files: tempSubjectFiles };

    setFormData((prev) => ({
      ...prev,
      courseFiles: [...prev.courseFiles, newCourse],
    }));

    // Reset temporary input values & clean error
    setTempSubjectName('');
    setTempSubjectFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setErrorMessage('');
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const invalidFile = selectedFiles.find((file) => {
      const supportedType = /\.(pdf|docx|pptx)$/i.test(file.name);
      return !supportedType || file.size > 15 * 1024 * 1024;
    });
    if (invalidFile) {
      setErrorMessage(`${invalidFile.name} is not supported. Choose a PDF, DOCX, or PPTX up to 15 MB.`);
      event.target.value = '';
      return;
    }
    setTempSubjectFiles((previous) => [...previous, ...selectedFiles]);
    setErrorMessage('');
    event.target.value = '';
  };

  const uploadSubjectFiles = async (courses: Array<{ id: string; name: string }>) => {
    let failedCount = 0;
    for (const subject of formData.courseFiles) {
      const course = courses.find((item) => item.name.trim().toLocaleLowerCase() === subject.courseName.trim().toLocaleLowerCase());
      for (const file of subject.files) {
        if (!course) {
          failedCount += 1;
          continue;
        }
        const fileData = new FormData();
        fileData.append('file', file);
        fileData.append('courseId', course.id);
        try {
          const result: any = await apiRequest('/materials/upload', 'POST', fileData);
          const extracted = result.data?.extractedAssignment;
          if (extracted && !extracted.deadline) {
            showToast(`Assignment "${extracted.title}" was found, but the file has no due date. Add it from Assignments using this title and your due date.`, 'info');
          }
        } catch {
          failedCount += 1;
        }
      }
    }
    return failedCount;
  };

  const handleRemoveSubject = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      courseFiles: prev.courseFiles.filter((_, i) => i !== index),
    }));
  };

  // Express Backend Sync via apiClient
  const saveOnboardingToDB = async (isSkipped: boolean = false) => {
  setIsLoading(true);
  setErrorMessage('');

  try {
    const payload = {
      major: isSkipped ? 'General' : formData.major || 'General',
      semester: isSkipped ? 'Semester 1' : formData.semester,
      semesterStartDate: isSkipped ? undefined : formData.semesterStartDate,
      semesterEndDate: isSkipped ? undefined : formData.semesterEndDate,
      studyGoalHours: formData.studyGoalHours,
      aiMode: formData.aiMode || 'balanced',
      courses: isSkipped ? [] : formData.courseFiles.map((c) => c.courseName),
    };

    const response: any = await apiRequest('/user/onboard', 'POST', payload);
    if (response.data?.user) {
      setAuthenticatedUser(response.data.user);
    }

    if (!isSkipped && formData.courseFiles.some((course) => course.files.length > 0)) {
      const failedUploads = await uploadSubjectFiles(response.data?.courses || []);
      if (failedUploads > 0) {
        showToast(`Onboarding is complete, but ${failedUploads} file${failedUploads === 1 ? '' : 's'} could not be uploaded. You can add them later from Materials.`, 'error');
      } else {
        showToast('Onboarding and course files saved successfully.', 'success');
      }
    }

    router.replace('/dashboard');
  } catch (err: any) {
    setErrorMessage(err.message || 'Failed to save onboarding data.');
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
      if (!formData.semesterStartDate || (formData.semesterEndDate && formData.semesterStartDate >= formData.semesterEndDate)) {
        setErrorMessage('Enter a valid semester start date. The end date must be later if provided.');
        return;
      }
      setCurrentStep(2);
      return;
    }

    // Step 2 Validation Rule: Course names are required; course documents are optional.
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
              Tell us about your degree program and current semester. If you do not know the end date, we will estimate a six-month semester.
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Degree Major <span className={styles.requiredStar}>*</span>
              </label>
              <input
                type="text"
                placeholder="Enter your major"
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

            <div className={styles.formGroup}>
              <label className={styles.label}>Semester Start Date <span className={styles.requiredStar}>*</span></label>
              <input
                type="date"
                value={formData.semesterStartDate}
                onChange={(e) => setFormData({ ...formData, semesterStartDate: e.target.value })}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Semester End Date <span>(optional)</span></label>
              <input
                type="date"
                value={formData.semesterEndDate}
                onChange={(e) => setFormData({ ...formData, semesterEndDate: e.target.value })}
                className={styles.input}
                min={formData.semesterStartDate || undefined}
              />
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
            <h1 className={styles.stepTitle}>Your Subjects</h1>
            <p className={styles.stepSubtitle}>
              Add your active subjects by name. Subject files are optional and can be attached now or later.
            </p>

            {/* Input Box for Subject */}
            <div className={styles.addSubjectBox}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Subject Name <span className={styles.requiredStar}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter subject name"
                  value={tempSubjectName}
                  onChange={(e) => setTempSubjectName(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.optionalFilesGroup}>
                <span className={styles.optionalLabel}>Subject files <span>(optional)</span></span>
                <div className={styles.fileInputRow}>
                  <input
                    ref={fileInputRef}
                    id="onboarding-course-files"
                    className={styles.hiddenInput}
                    type="file"
                    accept=".pdf,.docx,.pptx"
                    multiple
                    onChange={handleFilesSelected}
                  />
                  <label htmlFor="onboarding-course-files" className={styles.fileLabelBtn}>
                    <FiUploadCloud /> Choose PDFs, DOCX, or PPTX
                  </label>
                </div>
                {tempSubjectFiles.length > 0 && (
                  <ul className={styles.pendingFileList}>
                    {tempSubjectFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        <FiFileText /> <span>{file.name}</span>
                        <button type="button" onClick={() => setTempSubjectFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`}><FiX /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <small>Each file must be 15 MB or smaller.</small>
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
                      <FiBookOpen className={styles.fileIcon} />
                      <div>
                        <strong>{item.courseName}</strong>
                        {item.files.map((file, fileIndex) => (
                          <span key={`${file.name}-${fileIndex}`} className={styles.fileNameAttached}>{file.name}</span>
                        ))}
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
              Daily Target: <strong className={styles.highlightText}>{formatStudyGoal(formData.studyGoalHours)}</strong>
              </label>
              <input
                type="range"
                min="7"
                max="600"
                step="1"
                value={Math.round(formData.studyGoalHours * 60)}
                onChange={(e) =>
                  setFormData({ ...formData, studyGoalHours: Number(e.target.value) / 60 })
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

function formatStudyGoal(hours: number) {
  const minutes = Math.round(hours * 60);
  const wholeHours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const duration = [wholeHours ? `${wholeHours} hr${wholeHours === 1 ? '' : 's'}` : '', remainingMinutes ? `${remainingMinutes} min` : '']
    .filter(Boolean).join(' ');
  return `${duration || '0 min'} / day`;
}
