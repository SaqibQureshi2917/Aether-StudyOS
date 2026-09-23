// backend/src/controllers/session.controller.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ReschedulingEngine } from '../services/plannerEngine/rescheduling.engine';

const prisma = new PrismaClient();

// 1. Start Study Session (Connects with Focus Timer feature)
export const startSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.userId;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const session = await prisma.studySession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Study session not found.' });
    }

    const updatedSession = await prisma.studySession.update({
      where: { id: sessionId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    return res.status(200).json({
      message: 'Study session started successfully.',
      session: updatedSession,
    });
  } catch (error: any) {
    console.error('[StartSession Error]:', error);
    return res.status(500).json({ error: 'Internal server error.', details: error.message });
  }
};

// 2. Complete Study Session (Records actual vs planned duration & updates performance history)
export const completeSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, actualDurationHours } = req.body; // actualDuration in hours
    const userId = req.user?.userId;

    if (!sessionId || actualDurationHours === undefined) {
      return res.status(400).json({ error: 'sessionId and actualDurationHours are required.' });
    }

    const session = await prisma.studySession.findFirst({
      where: { id: sessionId, userId },
      include: { task: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Study session not found.' });
    }

    const endedAt = new Date();
    const isPartial = actualDurationHours < session.plannedDuration;
    const status = isPartial ? 'PARTIALLY_COMPLETED' : 'COMPLETED';

    // Update session record
    const updatedSession = await prisma.studySession.update({
      where: { id: sessionId },
      data: {
        status,
        actualDuration: actualDurationHours,
        endedAt,
      },
    });

    // Save performance history (Actual vs Estimated ratio for adaptive feedback)
    const ratio = actualDurationHours / (session.plannedDuration || 1);
    await prisma.performanceRecord.create({
      data: {
        userId: userId!,
        taskId: session.taskId,
        estimatedHours: session.plannedDuration,
        actualHours: actualDurationHours,
        ratio,
      },
    });

    // If partially completed, calculate remaining effort and queue rescheduling if necessary
    if (isPartial) {
      const remainingHours = session.plannedDuration - actualDurationHours;
      
      // Log recommendation or create planner event for missed workload
      await prisma.plannerRecommendation.create({
        data: {
          userId: userId!,
          type: 'MISSED_SESSION',
          title: 'Partial Study Session Recorded',
          message: `You completed ${actualDurationHours}h out of ${session.plannedDuration}h planned for "${session.task.title}". Remaining ${remainingHours}h can be redistributed.`,
          severity: 'INFO',
          relatedTaskId: session.taskId,
          relatedCourseId: session.task.courseId,
        },
      });
    }

    return res.status(200).json({
      message: 'Session completed and recorded successfully.',
      session: updatedSession,
      isPartial,
    });
  } catch (error: any) {
    console.error('[CompleteSession Error]:', error);
    return res.status(500).json({ error: 'Internal server error.', details: error.message });
  }
};

// 3. Mark Session Missed (Triggers automatic deficit detection)
export const markSessionMissed = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.userId;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const session = await prisma.studySession.findFirst({
      where: { id: sessionId, userId },
      include: { task: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Study session not found.' });
    }

    const updatedSession = await prisma.studySession.update({
      where: { id: sessionId },
      data: {
        status: 'MISSED',
        actualDuration: 0.0,
      },
    });

    // Create recommendation/event for missed session
    await prisma.plannerRecommendation.create({
      data: {
        userId: userId!,
        type: 'MISSED_SESSION',
        title: 'Study Session Missed',
        message: `You missed your scheduled session for "${session.task.title}" (${session.plannedDuration}h). Would you like to redistribute this workload?`,
        severity: 'WARNING',
        relatedTaskId: session.taskId,
        relatedCourseId: session.task.courseId,
      },
    });

    return res.status(200).json({
      message: 'Session marked as missed. Recommendation generated.',
      session: updatedSession,
    });
  } catch (error: any) {
    console.error('[MissedSession Error]:', error);
    return res.status(500).json({ error: 'Internal server error.', details: error.message });
  }
};