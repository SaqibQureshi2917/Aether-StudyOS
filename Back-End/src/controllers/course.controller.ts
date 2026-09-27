import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import{ AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

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

    const whereClause: any = {
      semester: { userId }
    };
    if (semesterId) whereClause.semesterId = semesterId as string;

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
        assignments: true,
        exams: true,
        studyTasks: true,
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

    const course = await prisma.course.findFirst({
      where: { id, semester: { userId } }
    });
    if (!course) throw new AppError('Course not found', 404);

    const updated = await prisma.course.update({
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

    await prisma.course.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
