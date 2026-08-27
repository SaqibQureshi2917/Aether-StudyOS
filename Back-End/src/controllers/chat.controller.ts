import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { chatService } from '../services/chat.service';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';

export const handleChatMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized access', 401);

    const { message, conversationId, mode, courseId } = req.body;
    if (!message || !mode) throw new AppError('Message and mode are required', 400);

    const result = await chatService.processChatMessage(userId, {
      message: message.trim(),
      conversationId,
      mode,
      courseId,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserChatThreads = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized access', 401);

    const threads = await prisma.conversation.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    res.status(200).json({
      success: true,
      data: { threads },
    });
  } catch (error) {
    next(error);
  }
};