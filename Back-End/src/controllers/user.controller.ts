import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const onboardUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { major, semester, studyGoalHours, aiMode } = req.body;

    if (!userId) {
      throw new AppError('Unauthorized access', 401);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        major: major || undefined,
        currentSemester: semester || undefined,
        dailyGoalHours: studyGoalHours ? parseFloat(studyGoalHours) : undefined,
        aiMode: aiMode ? aiMode.toUpperCase() : undefined,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Onboarding data saved',
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};