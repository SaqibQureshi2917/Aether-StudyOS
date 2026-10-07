import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { SemesterPlannerService } from '../services/plannerEngine/semester-planner.service';
import { aiAdapter } from '../services/ai/ai.service';
import { AIProviderError } from '../services/ai/ai-provider.interface';

const semesterSchema = z.object({ semesterId: z.string().uuid('Select a valid semester.'), timeZone: z.string().min(1).max(64).default('UTC'), courseId: z.string().uuid().optional() });
const scheduleOptionsShape = semesterSchema.extend({
  repeatCompletedSessions: z.boolean().default(false),
  repeatCycleId: z.string().uuid().optional(),
});
const scheduleOptionsSchema = scheduleOptionsShape.refine((value) => !value.repeatCompletedSessions || Boolean(value.repeatCycleId), { message: 'A repeat cycle is required when repeating completed sessions.' });
const applySchema = scheduleOptionsShape.extend({ previewHash: z.string().regex(/^[a-f0-9]{64}$/, 'Review a valid schedule preview before applying it.') }).refine((value) => !value.repeatCompletedSessions || Boolean(value.repeatCycleId), { message: 'A repeat cycle is required when repeating completed sessions.' });
const availabilitySchema = z.object({
  slots: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    isBlocked: z.boolean().default(false),
  }).refine((slot) => slot.startTime !== slot.endTime, { message: 'A study time must have a different start and end.' })).max(42),
});

function getUserId(req: AuthenticatedRequest) {
  if (!req.user?.userId) throw new AppError('Your session has expired. Sign in and try again.', 401);
  return req.user.userId;
}

function validateTimeZone(timeZone: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date()); return timeZone; }
  catch { throw new AppError('Your device time zone is not supported. Refresh the page and try again.', 400); }
}

export const getPlannerAvailability = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const slots = await prisma.availabilitySlot.findMany({ where: { userId: getUserId(req) }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
    return res.status(200).json({ success: true, data: { slots } });
  } catch (error) { return next(error); }
};

export const replacePlannerAvailability = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = availabilitySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Check each weekly study duration.', 400);
    const totalsByDay = new Map<number, number>();
    for (const slot of parsed.data.slots) {
      const minute = (value: string) => { const [hour, min] = value.split(':').map(Number); return hour * 60 + min; };
      const start = minute(slot.startTime);
      let duration = minute(slot.endTime) - start;
      if (duration <= 0) duration += 1440;
      const total = (totalsByDay.get(slot.dayOfWeek) ?? 0) + duration;
      if (total > 1439) throw new AppError('Weekly study duration cannot exceed 1439 minutes per day.', 400);
      totalsByDay.set(slot.dayOfWeek, total);
    }
    const userId = getUserId(req);
    const slots = await prisma.$transaction(async (tx) => {
      await tx.availabilitySlot.deleteMany({ where: { userId } });
      if (parsed.data.slots.length) await tx.availabilitySlot.createMany({ data: parsed.data.slots.map((slot) => ({ ...slot, userId })) });
      return tx.availabilitySlot.findMany({ where: { userId }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
    }, { isolationLevel: 'Serializable' });
    return res.status(200).json({ success: true, data: { slots } });
  } catch (error) { return next(error); }
};

export const getPlannerOverview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = z.object({ semesterId: z.string().uuid(), timeZone: z.string().min(1).max(64).default('UTC') }).safeParse(req.query);
    if (!parsedQuery.success) throw new AppError('Select a valid semester to view its planner.', 400);
    const from = req.query.from === undefined ? new Date(new Date().setHours(0, 0, 0, 0)) : new Date(String(req.query.from));
    const to = req.query.to === undefined ? new Date(Date.now() + 14 * 86_400_000) : new Date(String(req.query.to));
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 35 * 86_400_000) {
      throw new AppError('Choose a valid planner date range of 35 days or less.', 400);
    }
    const data = await SemesterPlannerService.overview(getUserId(req), parsedQuery.data.semesterId, from, to, new Date(), validateTimeZone(parsedQuery.data.timeZone));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
      return next(new AppError('Your planner data changed while applying the schedule. Review a fresh preview and try again.', 409));
    }
    return next(error);
  }
};

export const getPlannerSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = z.object({ semesterId: z.string().uuid() }).safeParse(req.query);
    if (!parsedQuery.success) throw new AppError('Select a valid semester to view its sessions.', 400);
    const from = req.query.from === undefined ? new Date(new Date().setHours(0, 0, 0, 0)) : new Date(String(req.query.from));
    const to = req.query.to === undefined ? new Date(Date.now() + 14 * 86_400_000) : new Date(String(req.query.to));
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 35 * 86_400_000) {
      throw new AppError('Choose a valid planner date range of 35 days or less.', 400);
    }
    const sessions = await SemesterPlannerService.sessionsInRange(getUserId(req), parsedQuery.data.semesterId, from, to);
    return res.status(200).json({ success: true, data: { sessions } });
  } catch (error) { return next(error); }
};

export const previewPlannerSchedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = scheduleOptionsSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Select a valid semester.', 400);
    const plan = await SemesterPlannerService.buildSchedule(getUserId(req), parsed.data.semesterId, new Date(), true, validateTimeZone(parsed.data.timeZone), parsed.data.courseId, parsed.data.repeatCompletedSessions, parsed.data.repeatCycleId);
    return res.status(200).json({
      success: true,
      data: {
        previewHash: plan.previewHash,
        courseId: parsed.data.courseId ?? null,
        timeZone: parsed.data.timeZone,
        dailyGoalHours: plan.dailyGoalHours,
        semester: { id: plan.semester.id, name: plan.semester.name },
        horizon: plan.horizon,
        tasks: plan.tasks,
        sessions: plan.result.sessions,
        conflicts: plan.result.conflicts,
        capacity: plan.result,
        existingSessionsBlockingTime: plan.blockingSessions,
        repeatedCompletedCount: plan.repeatedCompletedCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const applyPlannerSchedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Review a valid schedule preview before applying it.', 400);
    const data = await SemesterPlannerService.apply(getUserId(req), parsed.data.semesterId, parsed.data.previewHash, validateTimeZone(parsed.data.timeZone), parsed.data.courseId, parsed.data.repeatCompletedSessions, parsed.data.repeatCycleId);
    return res.status(200).json({ success: true, data: { message: 'The reviewed study schedule was applied.', ...data } });
  } catch (error) {
    return next(error);
  }
};

export const explainPlannerWorkload = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = semesterSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Select a valid semester.', 400);
    const plan = await SemesterPlannerService.buildSchedule(getUserId(req), parsed.data.semesterId, new Date(), false, validateTimeZone(parsed.data.timeZone));
    const facts = {
      semester: plan.semester.name,
      planningHorizon: { start: plan.horizon.startDate.toISOString(), end: plan.horizon.endDate.toISOString(), endDateWasEstimated: plan.horizon.endDateAssumed },
      capacityHours: plan.result.availableHours,
      scheduledHours: plan.result.scheduledHours,
      unscheduledHours: plan.result.unscheduledHours,
      tasks: plan.tasks.map((task) => ({ title: task.title, course: task.courseName, deadline: task.deadline.toISOString(), remainingHours: task.remainingHours, priorityScore: task.priorityScore, factorScores: task.priorityBreakdown.factors })),
      conflicts: plan.result.conflicts.map((conflict) => ({ title: conflict.title, deadline: conflict.deadline.toISOString(), unscheduledHours: conflict.unscheduledHours, unscheduledMinutes: conflict.unscheduledMinutes, reason: conflict.reason })),
    };
    const explanation = await aiAdapter.generateTextWithProvider({
      prompt: `Explain this verified planner data to the student:\n${JSON.stringify(facts)}`,
      systemPrompt: 'You are the StudyOS Planner Assistant. Explain only the supplied backend-calculated facts in clear, concise Markdown. Use these sections in order: “## Workload overview”, “## What needs attention”, and “## Suggested next steps”. Under each section, write at most 3 short bullets; omit a section when the supplied facts do not support it. Describe workload feasibility and explain deadline conflicts in plain language. Suggest user-controlled options such as adjusting availability, reviewing task estimates, or deciding which deadlines need attention. Never invent assignments, scores, availability, exact free times, dates, or achievable durations. Do not change or claim to have changed the schedule. Clearly say that any schedule change still requires the student to review and apply a deterministic planner preview. Do not use tables, raw JSON, or long paragraphs.',
      temperature: 0.2,
      maxTokens: 700,
    });
    return res.status(200).json({ success: true, data: { explanation: explanation.text, provider: explanation.provider, scheduleChanged: false } });
  } catch (error) {
    if (error instanceof AIProviderError) return next(new AppError('The planner explanation is temporarily unavailable. Your schedule data is unchanged.', 503));
    return next(error);
  }
};
