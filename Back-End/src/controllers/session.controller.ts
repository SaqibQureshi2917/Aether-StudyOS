import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { localDateParts } from '../services/plannerEngine/timezone.util';

export const startSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.body;
    const timeZone = typeof req.body?.timeZone === 'string' ? req.body.timeZone : 'UTC';
    if (!userId) throw new AppError('Unauthorized access', 401);
    if (typeof sessionId !== 'string' || !sessionId) throw new AppError('sessionId is required.', 400);
    try { new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date()); }
    catch { throw new AppError('A valid time zone is required to start this session.', 400); }

    const session = await prisma.studySession.findFirst({
      where: { id: sessionId, userId },
      include: { task: { select: { status: true } } },
    });
    if (!session) throw new AppError('Study session not found.', 404);
    if (session.status !== 'SCHEDULED') throw new AppError('Only scheduled sessions can be started.', 409);
    if (session.task.status === 'COMPLETED') throw new AppError('This study task is already complete.', 409);

    const now = new Date();
    const dateKey = (date: Date) => { const parts = localDateParts(date, timeZone); return `${parts.year}-${parts.month}-${parts.day}`; };
    const sessionDate = dateKey(session.scheduledStart);
    const today = dateKey(now);
    if (sessionDate > today) throw new AppError('This session can only be started on its scheduled date.', 409);
    if (sessionDate < today) throw new AppError('This session date has passed. Mark it missed or reschedule it before starting.', 409);
    const updatedSession = await prisma.$transaction(async (tx) => {
      const activeSession = await tx.studySession.findFirst({
        where: { userId, status: { in: ['IN_PROGRESS', 'PAUSED'] } },
        include: { task: { include: { course: { select: { name: true } } } } },
      });
      if (activeSession) {
        const action = activeSession.status === 'PAUSED' ? 'Resume' : 'Finish';
        throw new AppError(`${action} your active session for ${activeSession.task.course.name} before starting another session.`, 409);
      }

      const result = await tx.studySession.updateMany({
        where: { id: sessionId, userId, status: 'SCHEDULED' },
        data: { status: 'IN_PROGRESS', startedAt: now },
      });
      if (result.count !== 1) throw new AppError('This study session has already changed state.', 409);
      return tx.studySession.findUnique({ where: { id: sessionId } });
    }, { isolationLevel: 'Serializable' });
    res.status(200).json({ success: true, message: 'Study session started.', data: { session: updatedSession } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
      return next(new AppError('Another session started at the same time. Refresh and try again.', 409));
    }
    next(error);
  }
};
export const completeSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { sessionId, actualMinutes } = req.body;
    if (!userId) throw new AppError('Unauthorized access', 401);
    if (typeof sessionId !== 'string' || !sessionId) throw new AppError('sessionId is required.', 400);

    const session = await prisma.studySession.findFirst({
      where: { id: sessionId, userId },
      include: { task: { include: { assignment: true } } },
    });
    if (!session) throw new AppError('Study session not found.', 404);
    if (!['IN_PROGRESS', 'PAUSED'].includes(session.status) || !session.startedAt) {
      throw new AppError('Only an active study session can be completed.', 409);
    }
    if (actualMinutes !== undefined && (!Number.isInteger(actualMinutes) || actualMinutes < 1 || actualMinutes > 720)) {
      throw new AppError('Actual study time must be between 1 and 720 minutes.', 400);
    }

    const endedAt = new Date();
    const currentPause = session.status === 'PAUSED' && session.pausedAt ? endedAt.getTime() - session.pausedAt.getTime() : 0;
    const elapsedMs = Math.max(0, endedAt.getTime() - session.startedAt.getTime() - session.pauseDuration * 60_000 - currentPause);
    if (actualMinutes === undefined && elapsedMs > 12 * 60 * 60_000) {
      throw new AppError('This timer has been running for over 12 hours. Submit the actual study minutes to record it accurately.', 400);
    }
    const actualDurationHours = actualMinutes === undefined ? elapsedMs / 3_600_000 : actualMinutes / 60;
    const isPartial = actualDurationHours < session.plannedDuration;
    const status = isPartial ? 'PARTIALLY_COMPLETED' : 'COMPLETED';

    const updatedSession = await prisma.$transaction(async (tx) => {
      const changed = await tx.studySession.updateMany({
        where: { id: sessionId, userId, status: { in: ['IN_PROGRESS', 'PAUSED'] } },
        data: { status, actualDuration: actualDurationHours, endedAt, pausedAt: null },
      });
      if (changed.count !== 1) throw new AppError('This study session has already changed state.', 409);

      const taskAdjustedHours = session.task.adjustedHours + actualDurationHours;
      await tx.studyTask.update({
        where: { id: session.taskId },
        data: {
          adjustedHours: { increment: actualDurationHours },
          status: taskAdjustedHours >= session.task.estimatedHours ? 'COMPLETED' : 'IN_PROGRESS',
        },
      });

      if (session.task.assignmentId) {
        const assignmentTasks = await tx.studyTask.findMany({
          where: { assignmentId: session.task.assignmentId },
          select: { id: true, status: true },
        });
        const allTasksCompleted = assignmentTasks.length > 0 && assignmentTasks.every((task) =>
          task.id === session.taskId ? taskAdjustedHours >= session.task.estimatedHours : task.status === 'COMPLETED'
        );
        await tx.assignment.update({
          where: { id: session.task.assignmentId },
          data: {
            completedHours: { increment: actualDurationHours },
            status: allTasksCompleted ? 'COMPLETED' : 'IN_PROGRESS',
          },
        });
      }

      await tx.performanceRecord.create({
        data: {
          userId,
          taskId: session.taskId,
          estimatedHours: session.plannedDuration,
          actualHours: actualDurationHours,
          ratio: actualDurationHours / (session.plannedDuration || 1),
        },
      });

      if (isPartial) {
        const remainingHours = Math.max(0, session.plannedDuration - actualDurationHours);
        await tx.plannerRecommendation.create({
          data: {
            userId,
            type: 'MISSED_SESSION',
            title: 'Partial Study Session Recorded',
            message: `You completed ${actualDurationHours.toFixed(2)}h out of ${session.plannedDuration}h planned for "${session.task.title}". ${remainingHours.toFixed(2)}h remain.`,
            severity: 'INFO',
            relatedTaskId: session.taskId,
            relatedCourseId: session.task.courseId,
          },
        });
      }

      return tx.studySession.findUnique({ where: { id: sessionId } });
    });

    res.status(200).json({
      success: true,
      message: 'Study session completed and recorded.',
      data: { session: updatedSession, isPartial, isOverPlan: actualDurationHours > session.plannedDuration },
    });
  } catch (error) {
    next(error);
  }
};
export const pauseSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.body;
    if (!userId) throw new AppError('Unauthorized access', 401);
    if (typeof sessionId !== 'string' || !sessionId) throw new AppError('sessionId is required.', 400);
    const now = new Date();
    const updated = await prisma.studySession.updateMany({ where: { id: sessionId, userId, status: 'IN_PROGRESS' }, data: { status: 'PAUSED', pausedAt: now } });
    if (updated.count !== 1) throw new AppError('Only an active study session can be paused.', 409);
    const session = await prisma.studySession.findUnique({ where: { id: sessionId }, include: { task: { include: { course: { select: { name: true } } } } } });
    return res.status(200).json({ success: true, message: 'Study session paused.', data: { session } });
  } catch (error) { return next(error); }
};

export const resumeSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.body;
    if (!userId) throw new AppError('Unauthorized access', 401);
    if (typeof sessionId !== 'string' || !sessionId) throw new AppError('sessionId is required.', 400);
    const existing = await prisma.studySession.findFirst({ where: { id: sessionId, userId, status: 'PAUSED', pausedAt: { not: null } }, select: { pausedAt: true } });
    if (!existing?.pausedAt) throw new AppError('Only a paused study session can be resumed.', 409);
    const now = new Date();
    const pausedMinutes = Math.max(0, (now.getTime() - existing.pausedAt.getTime()) / 60_000);
    const result = await prisma.studySession.updateMany({
      where: { id: sessionId, userId, status: 'PAUSED', pausedAt: existing.pausedAt },
      data: { status: 'IN_PROGRESS', pausedAt: null, pauseDuration: { increment: pausedMinutes } },
    });
    if (result.count !== 1) throw new AppError('This paused session changed state. Refresh and try again.', 409);
    const session = await prisma.studySession.findUnique({ where: { id: sessionId }, include: { task: { include: { course: { select: { name: true } } } } } });
    return res.status(200).json({ success: true, message: 'Study session resumed.', data: { session } });
  } catch (error) { return next(error); }
};

export const getActiveSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized access', 401);
    const session = await prisma.studySession.findFirst({
      where: { userId, status: { in: ['IN_PROGRESS', 'PAUSED'] } },
      include: { task: { include: { course: { select: { id: true, name: true, colorCode: true } } } } },
      orderBy: { startedAt: 'desc' },
    });
    return res.status(200).json({ success: true, data: { session } });
  } catch (error) { return next(error); }
};

export const markSessionMissed = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.body;
    const timeZone = typeof req.body?.timeZone === 'string' ? req.body.timeZone : 'UTC';
    if (!userId) throw new AppError('Unauthorized access', 401);
    if (typeof sessionId !== 'string' || !sessionId) throw new AppError('sessionId is required.', 400);
    try { new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date()); }
    catch { throw new AppError('A valid time zone is required to update this session.', 400); }

    const session = await prisma.studySession.findFirst({
      where: { id: sessionId, userId },
      include: { task: true },
    });
    if (!session) throw new AppError('Study session not found.', 404);
    if (session.status !== 'SCHEDULED') throw new AppError('Only scheduled sessions can be marked missed.', 409);
    const dateKey = (date: Date) => { const parts = localDateParts(date, timeZone); return `${parts.year}-${parts.month}-${parts.day}`; };
    if (dateKey(session.scheduledStart) >= dateKey(new Date())) throw new AppError('A session can only be marked missed after its scheduled date has passed.', 409);

    const updatedSession = await prisma.$transaction(async (tx) => {
      const changed = await tx.studySession.updateMany({
        where: { id: sessionId, userId, status: 'SCHEDULED' },
        data: { status: 'MISSED', actualDuration: 0, endedAt: new Date() },
      });
      if (changed.count !== 1) throw new AppError('This study session has already changed state.', 409);

      await tx.plannerRecommendation.create({
        data: {
          userId,
          type: 'MISSED_SESSION',
          title: 'Study Session Missed',
          message: `You missed your scheduled session for "${session.task.title}" (${session.plannedDuration}h).`,
          severity: 'WARNING',
          relatedTaskId: session.taskId,
          relatedCourseId: session.task.courseId,
        },
      });

      return tx.studySession.findUnique({ where: { id: sessionId } });
    });

    res.status(200).json({ success: true, message: 'Study session marked missed.', data: { session: updatedSession } });
  } catch (error) {
    next(error);
  }
};
