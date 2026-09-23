import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const completeOnboarding = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { major, currentSemester, dailyGoalHours, aiMode } = req.body;

    if (!userId) {
      throw new AppError('Unauthorized access', 401);
    }

    // Update user profile and set isOnboarded to true
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        major: major || null,
        currentSemester: currentSemester || null,
        dailyGoalHours: dailyGoalHours ? parseFloat(dailyGoalHours) : 3.0,
        aiMode: aiMode || 'BALANCED',
        isOnboarded: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        major: true,
        currentSemester: true,
        dailyGoalHours: true,
        aiMode: true,
        isOnboarded: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully!',
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};