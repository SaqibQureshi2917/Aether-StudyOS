"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markSessionMissed = exports.completeSession = exports.startSession = void 0;
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
const startSession = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { sessionId } = req.body;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        if (typeof sessionId !== 'string' || !sessionId)
            throw new error_middleware_1.AppError('sessionId is required.', 400);
        const session = await db_1.prisma.studySession.findFirst({
            where: { id: sessionId, userId },
            include: { task: { select: { status: true } } },
        });
        if (!session)
            throw new error_middleware_1.AppError('Study session not found.', 404);
        if (session.status !== 'SCHEDULED')
            throw new error_middleware_1.AppError('Only scheduled sessions can be started.', 409);
        if (session.task.status === 'COMPLETED')
            throw new error_middleware_1.AppError('This study task is already complete.', 409);
        const now = new Date();
        const updatedSession = await db_1.prisma.$transaction(async (tx) => {
            const activeSession = await tx.studySession.findFirst({
                where: { userId, status: 'IN_PROGRESS' },
                select: { id: true },
            });
            if (activeSession)
                throw new error_middleware_1.AppError('Finish the active study session before starting another.', 409);
            const result = await tx.studySession.updateMany({
                where: { id: sessionId, userId, status: 'SCHEDULED' },
                data: { status: 'IN_PROGRESS', startedAt: now },
            });
            if (result.count !== 1)
                throw new error_middleware_1.AppError('This study session has already changed state.', 409);
            return tx.studySession.findUnique({ where: { id: sessionId } });
        }, { isolationLevel: 'Serializable' });
        res.status(200).json({ success: true, message: 'Study session started.', data: { session: updatedSession } });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
            return next(new error_middleware_1.AppError('Another session started at the same time. Refresh and try again.', 409));
        }
        next(error);
    }
};
exports.startSession = startSession;
const completeSession = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { sessionId } = req.body;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        if (typeof sessionId !== 'string' || !sessionId)
            throw new error_middleware_1.AppError('sessionId is required.', 400);
        const session = await db_1.prisma.studySession.findFirst({
            where: { id: sessionId, userId },
            include: { task: { include: { assignment: true } } },
        });
        if (!session)
            throw new error_middleware_1.AppError('Study session not found.', 404);
        if (session.status !== 'IN_PROGRESS' || !session.startedAt) {
            throw new error_middleware_1.AppError('Only an active study session can be completed.', 409);
        }
        const endedAt = new Date();
        const elapsedMs = Math.max(0, endedAt.getTime() - session.startedAt.getTime() - session.pauseDuration * 60_000);
        const actualDurationHours = elapsedMs / 3_600_000;
        const isPartial = actualDurationHours < session.plannedDuration;
        const status = isPartial ? 'PARTIALLY_COMPLETED' : 'COMPLETED';
        const updatedSession = await db_1.prisma.$transaction(async (tx) => {
            const changed = await tx.studySession.updateMany({
                where: { id: sessionId, userId, status: 'IN_PROGRESS' },
                data: { status, actualDuration: actualDurationHours, endedAt },
            });
            if (changed.count !== 1)
                throw new error_middleware_1.AppError('This study session has already changed state.', 409);
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
                const allTasksCompleted = assignmentTasks.length > 0 && assignmentTasks.every((task) => task.id === session.taskId ? taskAdjustedHours >= session.task.estimatedHours : task.status === 'COMPLETED');
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
            data: { session: updatedSession, isPartial },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.completeSession = completeSession;
const markSessionMissed = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { sessionId } = req.body;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        if (typeof sessionId !== 'string' || !sessionId)
            throw new error_middleware_1.AppError('sessionId is required.', 400);
        const session = await db_1.prisma.studySession.findFirst({
            where: { id: sessionId, userId },
            include: { task: true },
        });
        if (!session)
            throw new error_middleware_1.AppError('Study session not found.', 404);
        if (session.status !== 'SCHEDULED' || session.scheduledEnd > new Date()) {
            throw new error_middleware_1.AppError('Only elapsed scheduled sessions can be marked missed.', 409);
        }
        const updatedSession = await db_1.prisma.$transaction(async (tx) => {
            const changed = await tx.studySession.updateMany({
                where: { id: sessionId, userId, status: 'SCHEDULED' },
                data: { status: 'MISSED', actualDuration: 0, endedAt: new Date() },
            });
            if (changed.count !== 1)
                throw new error_middleware_1.AppError('This study session has already changed state.', 409);
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
    }
    catch (error) {
        next(error);
    }
};
exports.markSessionMissed = markSessionMissed;
