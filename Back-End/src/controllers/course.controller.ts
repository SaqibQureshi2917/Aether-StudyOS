import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import{ AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// 1. Create Course
export const createCourse = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { name, code, creditHours, difficulty, priority, instructor, description, colorCode, semesterId } = req.body;

    if (!userId) throw new AppError('Unauthorized access', 401);
    if (!name || !semesterId) throw new AppError('Course name and semester ID are required.', 400);

    // Verify semester belongs to user
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId }
    });
    if (!semester) throw new AppError('Semester not found or unauthorized', 404);

    const course = await prisma.course.create({
      data: {
        name,
        code: code || null,
        creditHours: creditHours ? parseInt(creditHours) : 3,
        difficulty: difficulty ? parseInt(difficulty) : 3,
        priority: priority ? parseInt(priority) : 3,
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

    const course = await prisma.course.findFirst({
      where: { id, semester: { userId } }
    });
    if (!course) throw new AppError('Course not found', 404);

    const updated = await prisma.course.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code !== undefined && { code }),
        ...(creditHours && { creditHours: parseInt(creditHours) }),
        ...(difficulty && { difficulty: parseInt(difficulty) }),
        ...(priority && { priority: parseInt(priority) }),
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