import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import{ AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import { aiAdapter } from '../services/ai/ai.service';
import { AIProviderError } from '../services/ai/ai-provider.interface';

const parseAiJson = <T,>(text: string): T => {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned) as T;
};

export const previewCourseOutline = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Your session has expired. Sign in and try again.', 401);
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, semester: { userId } },
      include: { materials: { select: { title: true, extractedText: true, processingStatus: true } } },
    });
    if (!course) throw new AppError('Subject not found.', 404);
    const readable = course.materials.filter((material) => material.extractedText?.trim());
    const sourceText = readable.length
      ? readable.map((material) => `DOCUMENT: ${material.title}\n${material.extractedText}`).join('\n\n').slice(0, 42000)
      : 'No readable subject documents have been uploaded. Infer a foundational outline from the subject name and code.';
    const generated = await aiAdapter.generateText({
      prompt: `Analyze the subject's uploaded material and create a concise course outline. Subject: ${course.name}${course.code ? ` (${course.code})` : ''}. Identify topics explicitly supported by the documents and likely core topics missing from them. Never claim an inferred topic is in the files. Return JSON only: {"materialTopics":[{"title":"...","estimatedMinutes":60}],"additionalTopics":[{"title":"...","estimatedMinutes":60}]}. Use 1-40 topics total, group duplicates, 30-180 minutes per topic. If coverage cannot be judged, keep additionalTopics conservative.\n\n${sourceText}`,
      systemPrompt: 'You are a careful academic syllabus analyst. Distinguish topics visible in the source text from topics inferred as missing. Do not invent document citations, page numbers, or certainty.',
      responseFormat: 'json_object',
      temperature: 0.2,
      maxTokens: 1600,
    });
    const result = parseAiJson<{ materialTopics?: Array<{ title: string; estimatedMinutes?: number }>; additionalTopics?: Array<{ title: string; estimatedMinutes?: number }> }>(generated);
    const normalize = (topics: typeof result.materialTopics) => (topics || []).slice(0, 40).flatMap((topic) => {
      if (typeof topic?.title !== 'string' || !topic.title.trim()) return [];
      return [{ title: topic.title.trim().slice(0, 180), estimatedMinutes: Math.min(180, Math.max(30, Math.round(Number(topic.estimatedMinutes) || 60))) }];
    });
    const materialTopics = normalize(result.materialTopics);
    const coveredNames = new Set(materialTopics.map((topic) => topic.title.toLocaleLowerCase()));
    const additionalTopics = normalize(result.additionalTopics).filter((topic) => !coveredNames.has(topic.title.toLocaleLowerCase())).slice(0, Math.max(0, 40 - materialTopics.length));
    return res.status(200).json({ success: true, data: { hasMaterials: readable.length > 0, materialTitles: readable.map((material) => material.title), materialTopics, additionalTopics } });
  } catch (error) {
    if (error instanceof AIProviderError) return next(new AppError('AI outline analysis is temporarily unavailable. Your study plan was not changed.', 503));
    if (error instanceof SyntaxError) return next(new AppError('The AI returned an unreadable outline. Try again.', 502));
    return next(error);
  }
};

export const saveCourseOutline = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Your session has expired. Sign in and try again.', 401);
    const schema = z.object({ topics: z.array(z.object({ title: z.string().trim().min(1).max(180), estimatedMinutes: z.number().int().min(30).max(180), materialCovered: z.boolean() })).min(1).max(40) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Choose at least one topic for this subject outline.', 400);
    const course = await prisma.course.findFirst({ where: { id: req.params.id, semester: { userId } }, select: { id: true } });
    if (!course) throw new AppError('Subject not found.', 404);
    const normalized = parsed.data.topics.map((topic) => ({ ...topic, title: topic.title.trim() }));
    if (new Set(normalized.map((topic) => topic.title.toLocaleLowerCase())).size !== normalized.length) throw new AppError('Remove duplicate topics before saving the outline.', 400);
    const topics = await prisma.$transaction(async (tx) => {
      await tx.studySession.updateMany({ where: { userId, status: 'SCHEDULED', isManualOverride: false, scheduledEnd: { gt: new Date() }, task: { courseId: course.id, learningTopicId: { not: null } } }, data: { status: 'CANCELLED' } });
      await tx.courseLearningTopic.deleteMany({ where: { courseId: course.id } });
      await tx.courseLearningTopic.createMany({ data: normalized.map((topic, index) => ({ courseId: course.id, title: topic.title, estimatedMinutes: topic.estimatedMinutes, materialCovered: topic.materialCovered, source: topic.materialCovered ? 'MATERIAL' : 'AI', sequence: index + 1 })) });
      await tx.course.update({ where: { id: course.id }, data: { outlineReviewedAt: new Date() } });
      return tx.courseLearningTopic.findMany({ where: { courseId: course.id }, orderBy: { sequence: 'asc' } });
    });
    return res.status(201).json({ success: true, data: { topics } });
  } catch (error) { return next(error); }
};

const parseScaleValue = (value: unknown, fieldName: string, min: number, max: number, fallback: number) => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError(`${fieldName} must be between ${min} and ${max}.`, 400);
  }
  return parsed;
};

// 1. Create Course
export const createCourse = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { name, code, creditHours, difficulty, priority, instructor, description, colorCode, semesterId } = req.body;

    if (!userId) throw new AppError('Unauthorized access', 401);
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 || typeof semesterId !== 'string') {
      throw new AppError('A course name (up to 120 characters) and semester ID are required.', 400);
    }

    // Verify semester belongs to user
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId }
    });
    if (!semester) throw new AppError('Semester not found or unauthorized', 404);

    const course = await prisma.course.create({
      data: {
        name: name.trim(),
        code: typeof code === 'string' ? code.trim() || null : null,
        creditHours: parseScaleValue(creditHours, 'Credit hours', 1, 10, 3),
        difficulty: parseScaleValue(difficulty, 'Difficulty', 1, 5, 3),
        priority: parseScaleValue(priority, 'Priority', 1, 5, 3),
        instructor: instructor || null,
        description: description || null,
        colorCode: colorCode || '#6366f1',
        semesterId,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: { course },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get All Courses
export const getCourses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { semesterId } = req.query;

    if (!userId) throw new AppError('Unauthorized access', 401);

    const whereClause: any = { semester: { userId } };
    if (semesterId) whereClause.semesterId = semesterId as string;
    if (req.query.includeArchived !== 'true') whereClause.status = { not: 'ARCHIVED' };
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const search = req.query.q.trim().slice(0, 100);
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { instructor: { contains: search, mode: 'insensitive' } },
      ];
    }

    const courses = await prisma.course.findMany({
      where: whereClause,
      include: {
        semester: { select: { name: true } },
        studyTasks: true,
        assignments: true,
      },
    });

    res.status(200).json({
      success: true,
      data: { courses },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Course By ID
export const getCourseById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const course = await prisma.course.findFirst({
      where: {
        id,
        semester: { userId }
      },
      include: {
        semester: true,
        learningTopics: { orderBy: { sequence: 'asc' } },
        assignments: true,
        exams: true,
        studyTasks: {
          where: { sessions: { some: { scheduledEnd: { gte: new Date(Date.now() - 7 * 86_400_000), lte: new Date(Date.now() + 30 * 86_400_000) } } } },
          include: { sessions: { where: { scheduledEnd: { gte: new Date(Date.now() - 7 * 86_400_000), lte: new Date(Date.now() + 30 * 86_400_000) } }, orderBy: { scheduledStart: 'asc' } } },
        },
      },
    });

    if (!course) throw new AppError('Course not found', 404);

    res.status(200).json({
      success: true,
      data: { course },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Update Course
export const updateCourse = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name, code, creditHours, difficulty, priority, status, instructor, description, colorCode } = req.body;
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 120)) {
      throw new AppError('Course name must be between 1 and 120 characters.', 400);
    }
    if (status !== undefined && !['ACTIVE', 'ARCHIVED'].includes(status)) throw new AppError('Subject status must be ACTIVE or ARCHIVED.', 400);
    if (code !== undefined && (typeof code !== 'string' || code.length > 40)) throw new AppError('Subject code must be 40 characters or fewer.', 400);
    if (instructor !== undefined && (typeof instructor !== 'string' || instructor.length > 120)) throw new AppError('Instructor name must be 120 characters or fewer.', 400);
    if (description !== undefined && (typeof description !== 'string' || description.length > 5000)) throw new AppError('Subject description must be 5,000 characters or fewer.', 400);

    const course = await prisma.course.findFirst({
      where: { id, semester: { userId } }
    });
    if (!course) throw new AppError('Course not found', 404);

    const updated = await prisma.$transaction(async (tx) => {
      const changedCourse = await tx.course.update({
        where: { id },
        data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(code !== undefined && { code }),
        ...(creditHours !== undefined && { creditHours: parseScaleValue(creditHours, 'Credit hours', 1, 10, 3) }),
        ...(difficulty !== undefined && { difficulty: parseScaleValue(difficulty, 'Difficulty', 1, 5, 3) }),
        ...(priority !== undefined && { priority: parseScaleValue(priority, 'Priority', 1, 5, 3) }),
        ...(status && { status }),
        ...(instructor !== undefined && { instructor }),
        ...(description !== undefined && { description }),
        ...(colorCode && { colorCode }),
        },
      });
      if (status === 'ARCHIVED') {
        await tx.studySession.updateMany({
          where: { userId, status: 'SCHEDULED', scheduledEnd: { gt: new Date() }, task: { courseId: id } },
          data: { status: 'CANCELLED' },
        });
      }
      return changedCourse;
    });

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: { course: updated },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Delete Course
export const deleteCourse = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const course = await prisma.course.findFirst({
      where: { id, semester: { userId } }
    });
    if (!course) throw new AppError('Course not found', 404);

    const [materials, assignments, exams, tasks] = await Promise.all([
      prisma.courseMaterial.count({ where: { courseId: id } }), prisma.assignment.count({ where: { courseId: id } }),
      prisma.exam.count({ where: { courseId: id } }), prisma.studyTask.count({ where: { courseId: id } }),
    ]);
    if (materials + assignments + exams + tasks > 0) throw new AppError('This subject has academic records. Archive it to preserve its materials, assignments, and study history.', 409);

    await prisma.course.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
