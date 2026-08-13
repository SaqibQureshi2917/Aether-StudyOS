export interface CourseFile {
  file: File;
  courseName: string;
}

export interface OnboardingData {
  major: string;
  semester: string;
  courseFiles: CourseFile[];
  studyGoalHours: number;
  aiMode: 'balanced' | 'rigorous' | 'exam_prep';
}