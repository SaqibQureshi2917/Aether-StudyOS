"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.explainPlannerWorkload = exports.applyPlannerSchedule = exports.previewPlannerSchedule = exports.getPlannerOverview = exports.replacePlannerAvailability = exports.getPlannerAvailability = void 0;
const zod_1 = require("zod");
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
const semester_planner_service_1 = require("../services/plannerEngine/semester-planner.service");
const ai_service_1 = require("../services/ai/ai.service");
const ai_provider_interface_1 = require("../services/ai/ai-provider.interface");
const semesterSchema = zod_1.z.object({ semesterId: zod_1.z.string().uuid('Select a valid semester.'), timeZone: zod_1.z.string().min(1).max(64).default('UTC') });
const applySchema = semesterSchema.extend({ previewHash: zod_1.z.string().regex(/^[a-f0-9]{64}$/, 'Review a valid schedule preview before applying it.') });
const availabilitySchema = zod_1.z.object({
    slots: zod_1.z.array(zod_1.z.object({
        dayOfWeek: zod_1.z.number().int().min(0).max(6),
        startTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        endTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        isBlocked: zod_1.z.boolean().default(false),
    }).refine((slot) => slot.startTime !== slot.endTime, { message: 'A study time must have a different start and end.' })).max(42),
});
function getUserId(req) {
    if (!req.user?.userId)
        throw new error_middleware_1.AppError('Your session has expired. Sign in and try again.', 401);
    return req.user.userId;
}
function validateTimeZone(timeZone) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
        return timeZone;
    }
    catch {
        throw new error_middleware_1.AppError('Your device time zone is not supported. Refresh the page and try again.', 400);
    }
}
const getPlannerAvailability = async (req, res, next) => {
    try {
        const slots = await db_1.prisma.availabilitySlot.findMany({ where: { userId: getUserId(req) }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
        return res.status(200).json({ success: true, data: { slots } });
    }
    catch (error) {
        return next(error);
    }
};
exports.getPlannerAvailability = getPlannerAvailability;
const replacePlannerAvailability = async (req, res, next) => {
    try {
        const parsed = availabilitySchema.safeParse(req.body);
        if (!parsed.success)
            throw new error_middleware_1.AppError(parsed.error.issues[0]?.message || 'Check your weekly study times.', 400);
        const userId = getUserId(req);
        const slots = await db_1.prisma.$transaction(async (tx) => {
            await tx.availabilitySlot.deleteMany({ where: { userId } });
            if (parsed.data.slots.length)
                await tx.availabilitySlot.createMany({ data: parsed.data.slots.map((slot) => ({ ...slot, userId })) });
            return tx.availabilitySlot.findMany({ where: { userId }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
        }, { isolationLevel: 'Serializable' });
        return res.status(200).json({ success: true, data: { slots } });
    }
    catch (error) {
        return next(error);
    }
};
exports.replacePlannerAvailability = replacePlannerAvailability;
const getPlannerOverview = async (req, res, next) => {
    try {
        const parsedQuery = zod_1.z.object({ semesterId: zod_1.z.string().uuid(), timeZone: zod_1.z.string().min(1).max(64).default('UTC') }).safeParse(req.query);
        if (!parsedQuery.success)
            throw new error_middleware_1.AppError('Select a valid semester to view its planner.', 400);
        const from = req.query.from === undefined ? new Date(new Date().setHours(0, 0, 0, 0)) : new Date(String(req.query.from));
        const to = req.query.to === undefined ? new Date(Date.now() + 14 * 86_400_000) : new Date(String(req.query.to));
        if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 35 * 86_400_000) {
            throw new error_middleware_1.AppError('Choose a valid planner date range of 35 days or less.', 400);
        }
        const data = await semester_planner_service_1.SemesterPlannerService.overview(getUserId(req), parsedQuery.data.semesterId, from, to, new Date(), validateTimeZone(parsedQuery.data.timeZone));
        return res.status(200).json({ success: true, data });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
            return next(new error_middleware_1.AppError('Your planner data changed while applying the schedule. Review a fresh preview and try again.', 409));
        }
        return next(error);
    }
};
exports.getPlannerOverview = getPlannerOverview;
const previewPlannerSchedule = async (req, res, next) => {
    try {
        const parsed = semesterSchema.safeParse(req.body);
        if (!parsed.success)
            throw new error_middleware_1.AppError(parsed.error.issues[0]?.message || 'Select a valid semester.', 400);
        const plan = await semester_planner_service_1.SemesterPlannerService.buildSchedule(getUserId(req), parsed.data.semesterId, new Date(), true, validateTimeZone(parsed.data.timeZone));
        return res.status(200).json({
            success: true,
            data: {
                previewHash: plan.previewHash,
                semester: { id: plan.semester.id, name: plan.semester.name },
                horizon: plan.horizon,
                tasks: plan.tasks,
                sessions: plan.result.sessions,
                conflicts: plan.result.conflicts,
                capacity: plan.result,
                existingSessionsBlockingTime: plan.blockingSessions,
            },
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.previewPlannerSchedule = previewPlannerSchedule;
const applyPlannerSchedule = async (req, res, next) => {
    try {
        const parsed = applySchema.safeParse(req.body);
        if (!parsed.success)
            throw new error_middleware_1.AppError(parsed.error.issues[0]?.message || 'Review a valid schedule preview before applying it.', 400);
        const data = await semester_planner_service_1.SemesterPlannerService.apply(getUserId(req), parsed.data.semesterId, parsed.data.previewHash, validateTimeZone(parsed.data.timeZone));
        return res.status(200).json({ success: true, data: { message: 'The reviewed study schedule was applied.', ...data } });
    }
    catch (error) {
        return next(error);
    }
};
exports.applyPlannerSchedule = applyPlannerSchedule;
const explainPlannerWorkload = async (req, res, next) => {
    try {
        const parsed = semesterSchema.safeParse(req.body);
        if (!parsed.success)
            throw new error_middleware_1.AppError(parsed.error.issues[0]?.message || 'Select a valid semester.', 400);
        const plan = await semester_planner_service_1.SemesterPlannerService.buildSchedule(getUserId(req), parsed.data.semesterId, new Date(), false, validateTimeZone(parsed.data.timeZone));
        const facts = {
            semester: plan.semester.name,
            planningHorizon: { start: plan.horizon.startDate.toISOString(), end: plan.horizon.endDate.toISOString(), endDateWasEstimated: plan.horizon.endDateAssumed },
            capacityHours: plan.result.availableHours,
            scheduledHours: plan.result.scheduledHours,
            unscheduledHours: plan.result.unscheduledHours,
            tasks: plan.tasks.map((task) => ({ title: task.title, course: task.courseName, deadline: task.deadline.toISOString(), remainingHours: task.remainingHours, priorityScore: task.priorityScore, factorScores: task.priorityBreakdown.factors })),
            conflicts: plan.result.conflicts.map((conflict) => ({ title: conflict.title, deadline: conflict.deadline.toISOString(), unscheduledHours: conflict.unscheduledHours, reason: conflict.reason })),
        };
        const explanation = await ai_service_1.aiAdapter.generateTextWithProvider({
            prompt: `Explain this verified planner data to the student:\n${JSON.stringify(facts)}`,
            systemPrompt: 'You are the StudyOS Planner Assistant. Explain only the supplied backend-calculated facts. Summarize feasible workload and explain any conflicts in plain language. Suggest user-controlled options such as adjusting availability, reviewing task estimates, or deciding which deadlines need attention. Never invent assignments, scores, availability, exact free times, dates, or achievable durations. Do not change or claim to have changed the schedule. Clearly say that any schedule change still requires the student to review and apply a deterministic planner preview. Use concise Markdown.',
            temperature: 0.2,
            maxTokens: 700,
        });
        return res.status(200).json({ success: true, data: { explanation: explanation.text, provider: explanation.provider, scheduleChanged: false } });
    }
    catch (error) {
        if (error instanceof ai_provider_interface_1.AIProviderError)
            return next(new error_middleware_1.AppError('The planner explanation is temporarily unavailable. Your schedule data is unchanged.', 503));
        return next(error);
    }
};
exports.explainPlannerWorkload = explainPlannerWorkload;
