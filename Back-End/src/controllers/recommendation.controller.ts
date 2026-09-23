// backend/src/controllers/recommendation.controller.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ReschedulingEngine } from '../services/plannerEngine/rescheduling.engine';

const prisma = new PrismaClient();

export const acceptRecommendation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recommendationId } = req.params;
    const userId = req.user?.userId;

    // 1. Fetch Recommendation
    const recommendation = await prisma.plannerRecommendation.findFirst({
      where: { id: recommendationId, userId, status: 'PENDING' },
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Pending recommendation not found.' });
    }

    // 2. If it's a missed session or workload issue, trigger Rescheduling Engine
    if (recommendation.relatedTaskId) {
      const task = await prisma.studyTask.findUnique({
        where: { id: recommendation.relatedTaskId },
      });

      if (task) {
        // Find user's available slots
        const availabilityRules = await prisma.availabilitySlot.findMany({
          where: { userId, isBlocked: false },
        });

        // Calculate remaining hours (mocking remaining workload from task or session)
        const remainingHours = task.estimatedHours - task.adjustedHours;

        if (remainingHours > 0) {
          // Get future concrete slots (simplified generation for remaining work)
          const concreteSlots = availabilityRules.map((rule, idx) => {
            const [startH, startM] = rule.startTime.split(':').map(Number);
            const [endH, endM] = rule.endTime.split(':').map(Number);
            const slotStart = new Date();
            slotStart.setDate(slotStart.getDate() + idx);
            slotStart.setHours(startH, startM, 0, 0);

            const slotEnd = new Date(slotStart);
            slotEnd.setHours(endH, endM, 0, 0);

            return {
              id: `slot-${idx}`,
              startTime: slotStart,
              endTime: slotEnd,
            };
          });

          // Run Rescheduling Engine
          const rescheduled = ReschedulingEngine.redistributeWorkload(
            [{ taskId: task.id, title: task.title, remainingHours, deadline: task.deadline }],
            concreteSlots
          );

          // Save new sessions
          await prisma.$transaction(
            rescheduled.map(session =>
              prisma.studySession.create({
                data: {
                  taskId: session.taskId,
                  userId: userId!,
                  scheduledStart: session.startTime,
                  scheduledEnd: session.endTime,
                  plannedDuration: session.durationHours,
                  status: 'SCHEDULED',
                },
              })
            )
          );
        }
      }
    }

    // 3. Mark Recommendation as Accepted
    await prisma.plannerRecommendation.update({
      where: { id: recommendationId },
      data: { status: 'ACCEPTED' },
    });

    return res.status(200).json({
      message: 'Recommendation accepted and schedule successfully updated via deterministic engine.',
    });
  } catch (error: any) {
    console.error('[AcceptRecommendation Error]:', error);
    return res.status(500).json({ error: 'Internal server error.', details: error.message });
  }
};