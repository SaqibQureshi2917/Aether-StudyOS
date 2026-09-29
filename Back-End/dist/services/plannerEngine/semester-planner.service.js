"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemesterPlannerService = void 0;
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const db_1 = require("../../config/db");
const error_middleware_1 = require("../../middleware/error.middleware");
const priority_engine_1 = require("./priority.engine");
const scheduling_engine_1 = require("./scheduling.engine");
const timezone_util_1 = require("./timezone.util");
const DAY_MS = 86_400_000;
function parseClock(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
        return null;
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
}
function addMonthsUtc(date, months) {
    const targetMonth = date.getUTCMonth() + months;
    const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDayOfMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(date.getUTCDate(), lastDayOfMonth)));
}
function dateKey(date) { return date.toISOString().slice(0, 10); }
function deadlineForTimezone(date, timeZone) {
    if (date.getUTCHours() || date.getUTCMinutes() || date.getUTCSeconds() || date.getUTCMilliseconds())
        return date;
    return (0, timezone_util_1.localDayBoundary)(date, timeZone, true);
}
function subtractBlocks(slots, blocks) {
    const sortedBlocks = blocks.filter((block) => block.endTime > block.startTime).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    return slots.flatMap((slot) => {
        let fragments = [{ startTime: slot.startTime, endTime: slot.endTime }];
        for (const block of sortedBlocks) {
            fragments = fragments.flatMap((fragment) => {
                if (block.endTime <= fragment.startTime || block.startTime >= fragment.endTime)
                    return [fragment];
                const left = block.startTime > fragment.startTime ? [{ startTime: fragment.startTime, endTime: block.startTime }] : [];
                const right = block.endTime < fragment.endTime ? [{ startTime: block.endTime, endTime: fragment.endTime }] : [];
                return [...left, ...right];
            });
        }
        return fragments.map((fragment, index) => ({ id: `${slot.id}-${index}`, ...fragment }));
    });
}
class SemesterPlannerService {
    static async buildSchedule(userId, semesterId, now = new Date(), requireAvailability = true, timeZone = 'UTC') {
        const semester = await db_1.prisma.semester.findFirst({
            where: { id: semesterId, userId },
            include: {
                courses: {
                    select: {
                        id: true, name: true, difficulty: true, priority: true,
                        topicMasteries: { where: { masteryPercentage: { lt: 60 } }, select: { topicName: true, masteryPercentage: true } },
                        studyTasks: {
                            where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
                            include: { assignment: { select: { title: true, deadline: true, difficulty: true, priority: true } } },
                        },
                    },
                },
            },
        });
        if (!semester)
            throw new error_middleware_1.AppError('Semester not found.', 404);
        const availabilityRules = await db_1.prisma.availabilitySlot.findMany({ where: { userId, isBlocked: false } });
        if (availabilityRules.length === 0 && requireAvailability)
            throw new error_middleware_1.AppError('Add your study availability before creating a schedule preview.', 400);
        const semesterStart = new Date(`${dateKey(new Date(semester.startDate))}T00:00:00.000Z`);
        const assumedEndDate = semester.endDate ? new Date(semester.endDate) : addMonthsUtc(semesterStart, 6);
        const semesterEndDate = new Date(`${dateKey(assumedEndDate)}T00:00:00.000Z`);
        const semesterEnd = (0, timezone_util_1.localDayBoundary)(semesterEndDate, timeZone, true);
        if (semesterEndDate < semesterStart)
            throw new error_middleware_1.AppError('The semester end date must be after its start date.', 400);
        const localToday = (0, timezone_util_1.localDateParts)(now, timeZone);
        const todayMarker = new Date(`${localToday.year}-${localToday.month}-${localToday.day}T00:00:00.000Z`);
        const horizonStart = todayMarker > semesterStart ? todayMarker : semesterStart;
        const dayCount = Math.ceil((semesterEnd.getTime() - horizonStart.getTime()) / DAY_MS);
        if (dayCount > 740)
            throw new error_middleware_1.AppError('Semester planning is limited to a two-year schedule window.', 400);
        const availability = [];
        const currentDay = new Date(horizonStart);
        let slotId = 0;
        for (let day = 0; day <= dayCount; day += 1) {
            const weekday = currentDay.getUTCDay();
            for (const rule of availabilityRules) {
                if (rule.dayOfWeek !== weekday)
                    continue;
                const startMinute = parseClock(rule.startTime);
                const endMinute = parseClock(rule.endTime);
                if (startMinute === null || endMinute === null || startMinute === endMinute)
                    continue;
                const startTime = (0, timezone_util_1.localDateTimeToUtc)(currentDay.getUTCFullYear(), currentDay.getUTCMonth() + 1, currentDay.getUTCDate(), Math.floor(startMinute / 60), startMinute % 60, timeZone);
                const endDate = new Date(currentDay);
                if (endMinute <= startMinute)
                    endDate.setUTCDate(endDate.getUTCDate() + 1);
                const endTime = (0, timezone_util_1.localDateTimeToUtc)(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, endDate.getUTCDate(), Math.floor(endMinute / 60), endMinute % 60, timeZone);
                if (startTime <= semesterEnd && endTime > now)
                    availability.push({ id: `weekly-${slotId++}`, startTime, endTime: endTime > semesterEnd ? semesterEnd : endTime });
            }
            currentDay.setUTCDate(currentDay.getUTCDate() + 1);
        }
        const rawTasks = semester.courses.flatMap((course) => course.studyTasks.map((task) => ({ task, course })));
        const rawTaskIds = rawTasks.map(({ task }) => task.id);
        const history = rawTaskIds.length ? await db_1.prisma.performanceRecord.findMany({
            where: { userId, taskId: { in: rawTaskIds } },
            orderBy: { createdAt: 'desc' },
            take: Math.min(1000, rawTaskIds.length * 5),
            select: { taskId: true, ratio: true },
        }) : [];
        const ratiosByTask = new Map();
        for (const record of history) {
            const ratios = ratiosByTask.get(record.taskId) ?? [];
            if (ratios.length < 5 && Number.isFinite(record.ratio) && record.ratio > 0)
                ratios.push(Math.min(1.5, Math.max(0.5, record.ratio)));
            ratiosByTask.set(record.taskId, ratios);
        }
        const taskRows = rawTasks.map(({ task, course }) => {
            const baselineRemainingHours = Math.max(0, task.estimatedHours - task.adjustedHours);
            const ratios = ratiosByTask.get(task.id) ?? [];
            const historicalMultiplier = ratios.length
                ? Math.min(1.25, Math.max(0.8, ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length))
                : 1;
            const remainingHours = baselineRemainingHours * historicalMultiplier;
            const deadline = deadlineForTimezone(task.deadline, timeZone);
            const weakestMastery = course.topicMasteries.length ? Math.min(...course.topicMasteries.map((topic) => topic.masteryPercentage)) : null;
            const academicRisk = weakestMastery === null ? 0 : Math.max(0, ((60 - weakestMastery) / 60) * 100);
            const priorityBreakdown = priority_engine_1.PriorityEngine.explain({
                deadline,
                estimatedHours: remainingHours,
                difficulty: task.assignment?.difficulty ?? course.difficulty,
                userPriority: task.assignment?.priority ?? course.priority,
                isOverdue: deadline < now,
                academicRisk,
            }, now);
            return { task, course, baselineRemainingHours, remainingHours, historicalMultiplier, deadline, priorityScore: priorityBreakdown.score, priorityBreakdown, weakestMastery };
        }).filter(({ remainingHours }) => remainingHours > 0);
        const tasks = taskRows.map(({ task, remainingHours, deadline, priorityScore }) => ({
            id: task.id,
            title: task.title,
            remainingHours,
            deadline,
            priorityScore,
        }));
        const allSemesterTasks = await db_1.prisma.studyTask.findMany({ where: { course: { semesterId: semester.id } }, select: { id: true } });
        const allTaskIds = allSemesterTasks.map((task) => task.id);
        const blockingSessions = allTaskIds.length ? await db_1.prisma.studySession.findMany({
            where: {
                userId,
                taskId: { in: allTaskIds },
                OR: [
                    { status: 'IN_PROGRESS' },
                    { status: 'SCHEDULED', isManualOverride: true, scheduledEnd: { gt: now } },
                ],
            },
            select: { scheduledStart: true, scheduledEnd: true, status: true },
        }) : [];
        const freeSlots = subtractBlocks(availability, blockingSessions.map((session) => ({
            startTime: session.status === 'IN_PROGRESS' && session.scheduledStart < now ? now : session.scheduledStart,
            endTime: session.status === 'IN_PROGRESS' && session.scheduledEnd <= now ? new Date(now.getTime() + 60 * 60_000) : session.scheduledEnd,
        })));
        const result = scheduling_engine_1.SchedulingEngine.generateSchedule(tasks, freeSlots, now);
        const previewHash = (0, crypto_1.createHash)('sha256').update(JSON.stringify({
            semesterId,
            timeZone,
            tasks: tasks.map((task) => [task.id, task.remainingHours, task.priorityScore, task.deadline.toISOString()]),
            sessions: result.sessions.map((session) => [session.taskId, session.title, session.startTime.toISOString(), session.endTime.toISOString()]),
            conflicts: result.conflicts.map((conflict) => [conflict.taskId, conflict.title, conflict.reason, conflict.unscheduledHours]),
            capacity: [result.availableHours, result.scheduledHours, result.unscheduledHours],
            blockingSessions: blockingSessions.map((session) => [session.scheduledStart.toISOString(), session.scheduledEnd.toISOString()]),
        })).digest('hex');
        return {
            semester,
            allSemesterTaskIds: allSemesterTasks.map((task) => task.id),
            tasks: taskRows.map(({ task, course, baselineRemainingHours, remainingHours, historicalMultiplier, priorityScore, priorityBreakdown, weakestMastery, deadline }) => ({
                id: task.id,
                title: task.title,
                courseId: course.id,
                courseName: course.name,
                assignmentTitle: task.assignment?.title ?? null,
                deadline,
                estimatedHours: task.estimatedHours,
                completedHours: task.adjustedHours,
                baselineRemainingHours,
                remainingHours,
                historicalMultiplier,
                priorityScore,
                priorityBreakdown,
                weakestMastery,
            })),
            result,
            previewHash,
            horizon: { startDate: horizonStart, endDate: semesterEnd, endDateAssumed: !semester.endDate },
            blockingSessions: blockingSessions.length,
        };
    }
    static async overview(userId, semesterId, from = new Date(new Date().setHours(0, 0, 0, 0)), to = new Date(Date.now() + 14 * DAY_MS), now = new Date(), timeZone = 'UTC') {
        const plan = await this.buildSchedule(userId, semesterId, now, false, timeZone);
        const sessions = await db_1.prisma.studySession.findMany({
            where: {
                userId,
                task: { course: { semesterId } },
                scheduledStart: { gte: from, lte: to },
            },
            include: { task: { include: { course: { select: { id: true, name: true, colorCode: true } }, assignment: { select: { id: true, title: true } } } } },
            orderBy: { scheduledStart: 'asc' },
        });
        const openSuggestions = await db_1.prisma.plannerRecommendation.findMany({
            where: { userId, status: 'PENDING', OR: [{ relatedCourseId: { in: plan.semester.courses.map((course) => course.id) } }, { relatedCourseId: null }] },
            orderBy: { createdAt: 'desc' },
            take: 5,
        });
        return {
            semester: { id: plan.semester.id, name: plan.semester.name, startDate: plan.semester.startDate, endDate: plan.semester.endDate },
            horizon: plan.horizon,
            tasks: plan.tasks,
            sessions,
            capacity: {
                availableHours: plan.result.availableHours,
                scheduledHours: plan.result.scheduledHours,
                unscheduledHours: plan.result.unscheduledHours,
                taskCount: plan.tasks.length,
                sessionCount: sessions.length,
                conflictCount: plan.result.conflicts.length,
            },
            conflicts: plan.result.conflicts,
            recommendations: openSuggestions,
        };
    }
    static async apply(userId, semesterId, expectedHash, timeZone = 'UTC') {
        const appliedAt = new Date();
        const plan = await this.buildSchedule(userId, semesterId, appliedAt, true, timeZone);
        if (plan.previewHash !== expectedHash)
            throw new error_middleware_1.AppError('Your tasks or availability changed after this preview. Review a fresh preview before applying it.', 409);
        const taskIds = plan.allSemesterTaskIds;
        const sessions = await db_1.prisma.$transaction(async (tx) => {
            if (taskIds.length) {
                await tx.studySession.updateMany({
                    where: { userId, taskId: { in: taskIds }, status: 'SCHEDULED', isManualOverride: false, scheduledEnd: { gt: appliedAt } },
                    data: { status: 'CANCELLED' },
                });
            }
            await tx.plannerPlan.updateMany({ where: { semesterId, isActive: true }, data: { isActive: false } });
            const previousPlan = await tx.plannerPlan.findFirst({ where: { semesterId }, orderBy: { version: 'desc' }, select: { version: true } });
            await tx.plannerPlan.create({
                data: {
                    semesterId,
                    version: (previousPlan?.version ?? 0) + 1,
                    isActive: true,
                    metadata: {
                        previewHash: plan.previewHash,
                        availableHours: plan.result.availableHours,
                        scheduledHours: plan.result.scheduledHours,
                        unscheduledHours: plan.result.unscheduledHours,
                        conflictCount: plan.result.conflicts.length,
                        createdAt: new Date().toISOString(),
                    },
                },
            });
            return Promise.all(plan.result.sessions.map((session) => tx.studySession.create({
                data: {
                    taskId: session.taskId,
                    userId,
                    scheduledStart: session.startTime,
                    scheduledEnd: session.endTime,
                    plannedDuration: session.durationHours,
                    status: 'SCHEDULED',
                },
            })));
        }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
        return { totalSessionsCreated: sessions.length, sessions, conflicts: plan.result.conflicts, capacity: plan.result };
    }
}
exports.SemesterPlannerService = SemesterPlannerService;
