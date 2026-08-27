import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const createCourse = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { title, code, color, semesterName } = req.body;

    if (!title) {
      throw new AppError('Course title / subject name is required', 400);
    }

    if (!userId) {
      throw new AppError('Unauthorized access', 401);
    }

    let semesterId: string | undefined;
    if (semesterName) {
      let semester = await prisma.semester.findFirst({
        where: { userId, name: semesterName },
      });

      if (!semester) {
        semester = await prisma.semester.create({
          data: {
            userId,
            name: semesterName,
            startDate: new Date(),
            endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
          },
        });
      }
      semesterId = semester.id;
    }

    const course = await prisma.course.create({
      data: {
        userId,
        title,
        code: code || null, // Optional code
        color: color || '#6366f1',
        semesterId: semesterId || null,
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

export const getMyCourses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    const courses = await prisma.course.findMany({
      where: { userId },
      include: {
        materials: true,
        assignments: true,
        semester: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: { courses },
    });
  } catch (error) {
    next(error);
  }
};