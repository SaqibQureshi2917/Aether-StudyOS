"use strict";
// backend/src/modules/materials/schemas/extraction.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizExtractionSchema = exports.QuizQuestionSchema = exports.AssignmentExtractionSchema = void 0;
const zod_1 = require("zod");
exports.AssignmentExtractionSchema = zod_1.z.object({
    type: zod_1.z.literal('assignment'),
    title: zod_1.z.string().min(1, 'Assignment title is required'),
    description: zod_1.z.string().nullable().optional(),
    deadline: zod_1.z.string().nullable().refine((val) => {
        if (!val)
            return true; // AI must never invent a deadline; null is allowed if missing
        return !isNaN(Date.parse(val));
    }, { message: 'Invalid deadline date format' }),
    difficulty: zod_1.z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
    estimatedHours: zod_1.z.number().positive().default(2.0),
    source: zod_1.z.object({
        documentId: zod_1.z.string(),
        page: zod_1.z.number().nullable().optional(),
    }),
    confidence: zod_1.z.number().min(0).max(1),
});
exports.QuizQuestionSchema = zod_1.z.object({
    questionText: zod_1.z.string().min(1),
    questionType: zod_1.z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']).default('MULTIPLE_CHOICE'),
    options: zod_1.z.array(zod_1.z.string()).optional(),
    correctAnswer: zod_1.z.string().min(1),
    explanation: zod_1.z.string().optional(),
});
exports.QuizExtractionSchema = zod_1.z.object({
    type: zod_1.z.literal('quiz'),
    title: zod_1.z.string().min(1),
    topics: zod_1.z.array(zod_1.z.string()),
    questions: zod_1.z.array(exports.QuizQuestionSchema),
    source: zod_1.z.object({
        documentId: zod_1.z.string(),
        page: zod_1.z.number().nullable().optional(),
    }),
    confidence: zod_1.z.number().min(0).max(1),
});
