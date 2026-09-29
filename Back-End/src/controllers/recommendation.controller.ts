import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';

async function setRecommendationStatus(req: AuthenticatedRequest, res: Response, next: NextFunction, status: 'ACCEPTED' | 'DISMISSED') {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Your session has expired. Sign in and try again.', 401);
    const result = await prisma.plannerRecommendation.updateMany({
      where: { id: req.params.recommendationId, userId, status: 'PENDING' },
      data: { status },
    });
    if (result.count !== 1) throw new AppError('This recommendation is no longer available.', 404);
    return res.status(200).json({
      success: true,
      data: {
        status,
        message: status === 'ACCEPTED'
          ? 'Recommendation accepted. Review a fresh schedule proposal to decide whether to change your sessions.'
          : 'Recommendation dismissed.',
      },
    });
  } catch (error) {
    return next(error);
  }
}

export const acceptRecommendation = (req: AuthenticatedRequest, res: Response, next: NextFunction) => setRecommendationStatus(req, res, next, 'ACCEPTED');
export const dismissRecommendation = (req: AuthenticatedRequest, res: Response, next: NextFunction) => setRecommendationStatus(req, res, next, 'DISMISSED');
