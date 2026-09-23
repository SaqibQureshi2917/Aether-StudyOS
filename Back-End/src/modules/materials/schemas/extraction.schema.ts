// backend/src/modules/materials/schemas/extraction.schema.ts

import { z } from 'zod';

export const AssignmentExtractionSchema = z.object({
  type: z.literal('assignment'),
  title: z.string().min(1, 'Assignment title is required'),
  description: z.string().nullable().optional(),
  deadline: z.string().nullable().refine((val) => {
    if (!val) return true; // AI must never invent a deadline; null is allowed if missing
    return !isNaN(Date.parse(val));
  }, { message: 'Invalid deadline date format' }),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  estimatedHours: z.number().positive().default(2.0),
  source: z.object({
    documentId: z.string(),
    page: z.number().nullable().optional(),
  }),
  confidence: z.number().min(0).max(1),
});

export const QuizQuestionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']).default('MULTIPLE_CHOICE'),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string().optional(),
});

export const QuizExtractionSchema = z.object({
  type: z.literal('quiz'),
  title: z.string().min(1),
  topics: z.array(z.string()),
  questions: z.array(QuizQuestionSchema),
  source: z.object({
    documentId: z.string(),
    page: z.number().nullable().optional(),
  }),
  confidence: z.number().min(0).max(1),
});

export type AssignmentExtractionDTO = z.infer<typeof AssignmentExtractionSchema>;
export type QuizExtractionDTO = z.infer<typeof QuizExtractionSchema>;