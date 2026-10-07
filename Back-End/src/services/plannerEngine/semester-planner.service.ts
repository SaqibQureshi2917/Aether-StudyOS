import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../middleware/error.middleware';
import { PriorityEngine } from './priority.engine';
import { AvailabilitySlot, ScheduleResult, SchedulingEngine, TaskInput } from './scheduling.engine';
import { localDateParts, localDateTimeToUtc, localDayBoundary } from './timezone.util';
import { EstimationEngine } from './estimation.engine';

const DAY_MS = 86_400_000;

type PlannerTaskLike = {
  id: string;
  title: string;
  estimatedHours: number;
  adjustedHours: number;
  deadline: Date;
  assignment: { title: string; deadline: Date; difficulty: 'EASY' | 'MEDIUM' | 'HARD'; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' } | null;
  exam: { id: string; title: string; date: Date; estimatedEffort: number; importance: number } | null;
  learningTopicId: string | null;
};

type PlannerRawTask = {
  task: PlannerTaskLike;
  course: { id: string; name: string; difficulty: number; priority: number; topicMasteries: Array<{ topicName: string; masteryPercentage: number }> };
  isVirtualExam: boolean;
  isVirtualDaily: boolean;
  isVirtualRepeat: boolean;
  repeatSourceSessionId?: string;
  examTitle: string | null;
  priorityOverride: number | undefined;
  sourceDeadline: Date;
};

function addMonthsUtc(date: Date, months: number) {
  const targetMonth = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDayOfMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(date.getUTCDate(), lastDayOfMonth)));
}

function examStudyTaskId(examId: string) {
  const hex = createHash('sha256').update(`studyos-exam-task:${examId}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function dailyStudyTaskId(courseId: string, date: Date) {
  const hex = createHash('sha256').update(`studyos-daily-study:${courseId}:${dateKey(date)}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
function repeatedStudyTaskId(sessionId: string, cycleId: string) {
  const hex = createHash('sha256').update(`studyos-repeat:${sessionId}:${cycleId}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function dateKey(date: Date) { return date.toISOString().slice(0, 10); }

function slotMinutes(start: string, end: string) {
  const parse = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; };
  const startMinute = parse(start);
  let duration = parse(end) - startMinute;
  if (duration <= 0) duration += 24 * 60;
  return duration;
}

function deadlineForTimezone(date: Date, timeZone: string) {
  if (date.getUTCHours() || date.getUTCMinutes() || date.getUTCSeconds() || date.getUTCMilliseconds()) return date;
  return localDayBoundary(date, timeZone, true);
}

function subtractBlocks(slots: AvailabilitySlot[], blocks: Array<{ startTime: Date; endTime: Date }>): AvailabilitySlot[] {
  const sortedBlocks = blocks.filter((block) => block.endTime > block.startTime).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return slots.flatMap((slot) => {
    let fragments = [{ startTime: slot.startTime, endTime: slot.endTime }];
    for (const block of sortedBlocks) {
      fragments = fragments.flatMap((fragment) => {
        if (block.endTime <= fragment.startTime || block.startTime >= fragment.endTime) return [fragment];
        const left = block.startTime > fragment.startTime ? [{ startTime: fragment.startTime, endTime: block.startTime }] : [];
        const right = block.endTime < fragment.endTime ? [{ startTime: block.endTime, endTime: fragment.endTime }] : [];
        return [...left, ...right];
      });
    }
    return fragments.map((fragment, index) => ({ id: `${slot.id}-${index}`, ...fragment }));
  });
}

export class SemesterPlannerService {
  static async buildSchedule(userId: string, semesterId: string, now = new Date(), requireAvailability = true, timeZone = 'UTC', courseId?: string, repeatCompletedSessions = false, repeatCycleId?: string) {
    const [semester, plannerUser] = await Promise.all([prisma.semester.findFirst({
      where: { id: semesterId, userId },
      include: {
        courses: {
          where: { status: { not: 'ARCHIVED' }, ...(courseId ? { id: courseId } : {}) },
          select: {
            id: true, name: true, difficulty: true, priority: true, colorCode: true,
            topicMasteries: { where: { masteryPercentage: { lt: 60 } }, select: { topicName: true, masteryPercentage: true } },
            exams: { include: { studyTasks: { select: { id: true, status: true } } } },
            studyTasks: {
              include: {
                assignment: { select: { title: true, deadline: true, difficulty: true, priority: true } },
                exam: { select: { id: true, title: true, date: true, estimatedEffort: true, importance: true } },
              },
            },
            learningTopics: { orderBy: { sequence: 'asc' }, select: { id: true, title: true, sequence: true, estimatedMinutes: true, materialCovered: true } },
          },
        },
      },
    }), prisma.user.findUnique({ where: { id: userId }, select: { dailyGoalHours: true, dailySessionMinutes: true } })]);
    if (!semester) throw new AppError('Semester not found.', 404);
    if (!plannerUser) throw new AppError('User not found.', 404);
    if (courseId && semester.courses.length === 0) throw new AppError('Select a subject in this semester to build its study plan.', 404);

    // Weekly availability stores duration by day; it never sets a required start time.
    const availabilityRules = await prisma.availabilitySlot.findMany({ where: { userId, isBlocked: false } });

    const semesterStart = new Date(`${dateKey(new Date(semester.startDate))}T00:00:00.000Z`);
    const assumedEndDate = semester.endDate ? new Date(semester.endDate) : addMonthsUtc(semesterStart, 6);
    const semesterEndDate = new Date(`${dateKey(assumedEndDate)}T00:00:00.000Z`);
    const semesterEnd = localDayBoundary(semesterEndDate, timeZone, true);
    if (semesterEndDate < semesterStart) throw new AppError('The semester end date must be after its start date.', 400);

    const localToday = localDateParts(now, timeZone);
    const todayMarker = new Date(`${localToday.year}-${localToday.month}-${localToday.day}T00:00:00.000Z`);
    const horizonStart = todayMarker;
    const dayCount = Math.ceil((semesterEnd.getTime() - horizonStart.getTime()) / DAY_MS);
    if (dayCount > 740) throw new AppError('Semester planning is limited to a two-year schedule window.', 400);

    const availability: AvailabilitySlot[] = [];
    const weeklyMinutes = new Map<number, number>();
    for (const rule of availabilityRules) weeklyMinutes.set(rule.dayOfWeek, (weeklyMinutes.get(rule.dayOfWeek) ?? 0) + slotMinutes(rule.startTime, rule.endTime));
    const currentDay = new Date(horizonStart);
    let previousSlotEnd: Date | null = null;
    for (let day = 0; day <= dayCount; day += 1) {
      const dayStart = localDateTimeToUtc(currentDay.getUTCFullYear(), currentDay.getUTCMonth() + 1, currentDay.getUTCDate(), 0, 0, timeZone);
      const nextDay = new Date(currentDay);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const weekday = currentDay.getUTCDay();
      const plannedMinutes = weeklyMinutes.get(weekday) ?? plannerUser.dailyGoalHours * 60;
      let startTime = dayStart < now ? now : dayStart;
      if (previousSlotEnd && startTime < previousSlotEnd) startTime = previousSlotEnd;
      const endTime = new Date(Math.min(semesterEnd.getTime(), startTime.getTime() + plannedMinutes * 60_000));
      if (plannedMinutes > 0 && startTime < semesterEnd && endTime > startTime) {
        availability.push({ id: `flexible-day-${day}`, startTime, endTime });
        previousSlotEnd = endTime;
      }
      currentDay.setUTCDate(currentDay.getUTCDate() + 1);
    }

    const rawTasks: PlannerRawTask[] = semester.courses.flatMap((course) => [
      ...course.studyTasks
        .filter((task) => !task.isDailyStudy && ['PENDING', 'IN_PROGRESS'].includes(task.status) && Math.max(0, task.estimatedHours - task.adjustedHours) > 0)
        .map((task) => ({
          task,
          course,
          isVirtualExam: false,
          isVirtualDaily: false,
          isVirtualRepeat: false,
          examTitle: task.exam?.title ?? null,
          priorityOverride: task.exam?.importance,
          sourceDeadline: task.exam?.date ?? task.deadline,
        })),
      ...course.exams
        .filter((exam) => exam.studyTasks.length === 0)
        .map((exam) => ({
          task: {
            id: examStudyTaskId(exam.id),
            title: `Prepare for ${exam.title}`,
            estimatedHours: Math.max(0, exam.estimatedEffort),
            adjustedHours: 0,
            deadline: exam.date,
            assignment: null,
            learningTopicId: null,
            exam: { id: exam.id, title: exam.title, date: exam.date, estimatedEffort: exam.estimatedEffort, importance: exam.importance },
          },
          course,
          isVirtualExam: true,
          isVirtualDaily: false,
          isVirtualRepeat: false,
          examTitle: exam.title,
          priorityOverride: exam.importance,
          sourceDeadline: exam.date,
        })),
    ]);
    // Subject learning is the baseline plan. One small, topic-focused task is
    // created per active subject and calendar day, independently of assignments.
    const studyDayKeys = new Set(availability.map((slot) => { const parts = localDateParts(slot.startTime, timeZone); return `${parts.year}-${parts.month}-${parts.day}`; }));
    const dailyLearningTasks = semester.courses.length ? Array.from({ length: Math.max(0, dayCount + 1) }, (_, dayOffset) => {
      const studyDate = new Date(horizonStart);
      studyDate.setUTCDate(studyDate.getUTCDate() + dayOffset);
      const studyDateKey = dateKey(studyDate);
      if (!studyDayKeys.has(studyDateKey)) return [];
      const goalHoursForDay = (weeklyMinutes.get(studyDate.getUTCDay()) ?? plannerUser.dailyGoalHours * 60) / 60;
      const plannedMinutes = goalHoursForDay * 60;
      if (goalHoursForDay <= 0 || plannedMinutes <= 0) return [];
      // Split integer minutes, not fractional hours, so rounding each task up
      // cannot create phantom "not fit" minutes when the target fits exactly.
      const totalDailyMinutes = Math.round(plannedMinutes);
      const baseSubjectMinutes = Math.floor(totalDailyMinutes / semester.courses.length);
      const extraSubjectMinutes = totalDailyMinutes % semester.courses.length;
      return semester.courses.map((course, courseIndex) => {
        const topic = course.learningTopics.length ? course.learningTopics[dayOffset % course.learningTopics.length] : null;
        // Use a stable local calendar deadline. Today's availability starts at
        // `now`, so using that slot's end here made the task deadline shift on
        // every preview/apply request and invalidated every fresh preview.
        const deadline = localDayBoundary(studyDate, timeZone, true);
        const title = topic ? `Study: ${topic.title}` : `Study ${course.name}: core concepts`;
        const subjectMinutes = baseSubjectMinutes + (courseIndex < extraSubjectMinutes ? 1 : 0);
        const task = {
          id: dailyStudyTaskId(course.id, studyDate), title,
          estimatedHours: subjectMinutes / 60, adjustedHours: 0, deadline,
          assignment: null, exam: null, learningTopicId: topic?.id ?? null,
          isVirtualDaily: true,
        };
        return { task, course, isVirtualExam: false, isVirtualDaily: true, isVirtualRepeat: false, examTitle: null, priorityOverride: course.priority, sourceDeadline: deadline };
      });
    }).flat() : [];
    const activePlan = repeatCompletedSessions && repeatCycleId
      ? await prisma.plannerPlan.findFirst({ where: { semesterId, isActive: true }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      : null;
    const completedDailySessions = activePlan ? await prisma.studySession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        createdAt: { gte: activePlan.createdAt },
        task: { isDailyStudy: true, course: { semesterId, ...(courseId ? { id: courseId } : {}) } },
      },
      include: { task: { select: { title: true, courseId: true, learningTopicId: true } } },
      orderBy: { createdAt: 'asc' },
    }) : [];
    const coursesById = new Map(semester.courses.map((course) => [course.id, course]));
    rawTasks.push(...completedDailySessions.flatMap((session) => {
      const course = coursesById.get(session.task.courseId);
      if (!course || session.plannedDuration <= 0) return [];
      const task = {
        id: repeatedStudyTaskId(session.id, repeatCycleId!),
        title: `Repeat: ${session.task.title}`,
        estimatedHours: session.plannedDuration,
        adjustedHours: 0,
        deadline: semesterEnd,
        assignment: null,
        exam: null,
        learningTopicId: session.task.learningTopicId,
      };
      return [{ task, course, isVirtualExam: false, isVirtualDaily: false, isVirtualRepeat: true, repeatSourceSessionId: session.id, examTitle: null, priorityOverride: course.priority, sourceDeadline: semesterEnd }];
    }));
    const priorDailySessions = dailyLearningTasks.length ? await prisma.studySession.findMany({
      where: { userId, taskId: { in: dailyLearningTasks.map(({ task }) => task.id) }, status: { in: ['COMPLETED', 'PARTIALLY_COMPLETED', 'MISSED'] } },
      select: { taskId: true, status: true },
    }) : [];
    const recordedDailyTaskIds = new Set(priorDailySessions.filter((session) => session.status === 'COMPLETED').map((session) => session.taskId));
    const pendingDailyTasks = dailyLearningTasks.filter(({ task }) => !recordedDailyTaskIds.has(task.id));
    rawTasks.push(...pendingDailyTasks);
    const rawTaskIds = rawTasks.map(({ task }) => task.id);
    const history = rawTaskIds.length ? await prisma.performanceRecord.findMany({
      where: { userId, taskId: { in: rawTaskIds } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(1000, rawTaskIds.length * 5),
      select: { taskId: true, ratio: true },
    }) : [];
    const ratiosByTask = new Map<string, number[]>();
    for (const record of history) {
      const ratios = ratiosByTask.get(record.taskId) ?? [];
      if (ratios.length < 5 && Number.isFinite(record.ratio) && record.ratio > 0) ratios.push(Math.min(1.5, Math.max(0.5, record.ratio)));
      ratiosByTask.set(record.taskId, ratios);
    }

    const taskRows = rawTasks.map(({ task, course, isVirtualExam, isVirtualDaily, isVirtualRepeat, repeatSourceSessionId, examTitle, priorityOverride, sourceDeadline }) => {
      const ratios = ratiosByTask.get(task.id) ?? [];
      const estimate = EstimationEngine.estimateRemaining(task.estimatedHours, task.adjustedHours, ratios);
      const { baselineRemainingHours, adjustmentMultiplier: historicalMultiplier, remainingHours } = estimate;
      const deadline = deadlineForTimezone(sourceDeadline, timeZone);
      const weakestMastery = course.topicMasteries.length ? Math.min(...course.topicMasteries.map((topic) => topic.masteryPercentage)) : null;
      const academicRisk = weakestMastery === null ? 0 : Math.max(0, ((60 - weakestMastery) / 60) * 100);
      const priorityBreakdown = PriorityEngine.explain({
        deadline,
        estimatedHours: remainingHours,
        difficulty: task.assignment?.difficulty ?? course.difficulty,
        userPriority: task.assignment?.priority ?? priorityOverride ?? course.priority,
        isOverdue: deadline < now,
        academicRisk,
      }, now);
      return { task, course, isVirtualExam, isVirtualDaily: Boolean(isVirtualDaily), isVirtualRepeat: Boolean(isVirtualRepeat), repeatSourceSessionId, examTitle, priorityOverride, baselineRemainingHours, remainingHours, historicalMultiplier, deadline, priorityScore: isVirtualDaily ? priorityBreakdown.score * 0.45 : priorityBreakdown.score, priorityBreakdown, weakestMastery };
    }).filter(({ remainingHours }) => remainingHours > 0);

    const tasks: TaskInput[] = taskRows.map(({ task, remainingHours, deadline, priorityScore }) => ({
      id: task.id,
      title: task.title,
      remainingHours,
      deadline,
      priorityScore,
      sessionMinutes: Math.max(1, Math.round(plannerUser.dailyGoalHours * 60)),
    }));
    const allSemesterTasks = await prisma.studyTask.findMany({ where: { course: { semesterId: semester.id, ...(courseId ? { id: courseId } : {}) } }, select: { id: true } });
    const allTaskIds = allSemesterTasks.map((task) => task.id);
    const blockingSessions = allTaskIds.length ? await prisma.studySession.findMany({
      where: {
        userId,
        taskId: { in: allTaskIds },
        OR: [
          { status: { in: ['IN_PROGRESS', 'PAUSED'] } },
          { status: 'SCHEDULED', isManualOverride: true, scheduledEnd: { gt: now } },
        ],
      },
      select: { id: true, taskId: true, scheduledStart: true, scheduledEnd: true, status: true },
    }) : [];

    const freeSlots = subtractBlocks(availability, blockingSessions.map((session) => ({
      startTime: ['IN_PROGRESS', 'PAUSED'].includes(session.status) && session.scheduledStart < now ? now : session.scheduledStart,
      endTime: ['IN_PROGRESS', 'PAUSED'].includes(session.status) && session.scheduledEnd <= now ? new Date(now.getTime() + 60 * 60_000) : session.scheduledEnd,
    })));
    const result = SchedulingEngine.generateSchedule(tasks, freeSlots, now);
    const previewHash = createHash('sha256').update(JSON.stringify({
      semesterId,
      courseId: courseId ?? null,
      timeZone,
      dailySessionMinutes: Math.max(1, Math.round(plannerUser.dailyGoalHours * 60)),
      weeklyAvailability: Array.from(weeklyMinutes.entries()).sort(([a], [b]) => a - b),
      // Priority scores include a clock-sensitive deadline urgency factor. Hash
      // only their stable inputs so a preview does not expire while the user is
      // reviewing it; task effort, deadlines, priority inputs, and blockers still
      // invalidate the preview when the underlying plan actually changes.
      tasks: taskRows.map(({ task, remainingHours, deadline, priorityBreakdown }) => [
        task.id,
        remainingHours,
        deadline.toISOString(),
        priorityBreakdown.factors.remainingEffort,
        priorityBreakdown.factors.difficulty,
        priorityBreakdown.factors.userPriority,
        priorityBreakdown.factors.academicRisk,
      ]).sort(([a], [b]) => String(a).localeCompare(String(b))),
      blockingSessions: blockingSessions.map((session) => [session.id, session.taskId, session.status, session.scheduledStart.toISOString(), session.scheduledEnd.toISOString()]),
    })).digest('hex');

    return {
      semester,
      allSemesterTaskIds: allSemesterTasks.map((task) => task.id),
      dailyGoalHours: plannerUser.dailyGoalHours,
      dailySessionMinutes: Math.max(1, Math.round(plannerUser.dailyGoalHours * 60)),
      dailyStudyTasks: taskRows.filter(({ isVirtualDaily }) => isVirtualDaily).map(({ task, course, deadline }) => ({ id: task.id, title: task.title, courseId: course.id, deadline, estimatedHours: task.estimatedHours, learningTopicId: task.learningTopicId ?? null })),
      repeatStudyTasks: taskRows.filter(({ isVirtualRepeat }) => isVirtualRepeat).map(({ task, course, deadline, repeatSourceSessionId }) => ({ id: task.id, title: task.title, courseId: course.id, deadline, estimatedHours: task.estimatedHours, learningTopicId: task.learningTopicId ?? null, repeatSourceSessionId })),
      repeatedCompletedCount: taskRows.filter(({ isVirtualRepeat }) => isVirtualRepeat).length,
      tasks: taskRows.filter(({ isVirtualDaily }) => !isVirtualDaily).map(({ task, course, isVirtualExam, isVirtualRepeat, repeatSourceSessionId, examTitle, baselineRemainingHours, remainingHours, historicalMultiplier, priorityScore, priorityBreakdown, weakestMastery, deadline }) => ({
        id: task.id,
        title: task.title,
        courseId: course.id,
        examId: task.exam?.id ?? null,
        isDailyStudy: false,
        courseName: course.name,
        assignmentTitle: task.assignment?.title ?? null,
        examTitle,
        isVirtualExam,
        isVirtualRepeat,
        repeatSourceSessionId,
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

  static async overview(userId: string, semesterId: string, from = new Date(new Date().setHours(0, 0, 0, 0)), to = new Date(Date.now() + 14 * DAY_MS), now = new Date(), timeZone = 'UTC') {
    const plan = await this.buildSchedule(userId, semesterId, now, false, timeZone);
    const sessions = await this.sessionsInRange(userId, semesterId, from, to);
    const openSuggestions = await prisma.plannerRecommendation.findMany({
      where: { userId, status: 'PENDING', OR: [{ relatedCourseId: { in: plan.semester.courses.map((course) => course.id) } }, { relatedCourseId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return {
      semester: { id: plan.semester.id, name: plan.semester.name, startDate: plan.semester.startDate, endDate: plan.semester.endDate },
      courses: plan.semester.courses.map((course) => ({ id: course.id, name: course.name, colorCode: course.colorCode })),
      dailyGoalHours: plan.dailyGoalHours,
      dailySessionMinutes: plan.dailySessionMinutes,
      horizon: plan.horizon,
      tasks: plan.tasks,
      sessions,
      capacity: {
        availableHours: plan.result.availableHours,
        scheduledHours: plan.result.scheduledHours,
        unscheduledHours: plan.result.unscheduledHours,
        taskCount: plan.tasks.length + plan.dailyStudyTasks.length,
        sessionCount: sessions.length,
        conflictCount: plan.result.conflicts.length,
      },
      conflicts: plan.result.conflicts,
      recommendations: openSuggestions,
    };
  }

  static async sessionsInRange(userId: string, semesterId: string, from: Date, to: Date) {
    return prisma.studySession.findMany({
      where: {
        userId,
        status: { not: 'CANCELLED' },
        task: { course: { semesterId, status: { not: 'ARCHIVED' } } },
        scheduledStart: { gte: from, lte: to },
      },
      include: { task: { include: { course: { select: { id: true, name: true, colorCode: true } }, assignment: { select: { id: true, title: true } } } } },
      orderBy: { scheduledStart: 'asc' },
    });
  }

  static async apply(userId: string, semesterId: string, expectedHash: string, timeZone = 'UTC', courseId?: string, repeatCompletedSessions = false, repeatCycleId?: string) {
    const appliedAt = new Date();
    const plan = await this.buildSchedule(userId, semesterId, appliedAt, true, timeZone, courseId, repeatCompletedSessions, repeatCycleId);
    if (plan.previewHash !== expectedHash) throw new AppError('Your tasks or availability changed after this preview. Review a fresh preview before applying it.', 409);
    const virtualExamTasks = plan.tasks.filter((task) => task.isVirtualExam);
    const taskIds = [...plan.allSemesterTaskIds, ...virtualExamTasks.map((task) => task.id), ...plan.dailyStudyTasks.map((task) => task.id), ...plan.repeatStudyTasks.map((task) => task.id)];
    await prisma.$transaction(async (tx) => {
      for (const examTask of virtualExamTasks) {
        const alreadyLinked = await tx.studyTask.findFirst({ where: { examId: examTask.examId }, select: { id: true } });
        if (!alreadyLinked) {
          await tx.studyTask.create({
            data: {
              id: examTask.id,
              courseId: examTask.courseId,
              examId: examTask.examId,
              title: examTask.title,
              estimatedHours: examTask.estimatedHours,
              deadline: examTask.deadline,
            },
          });
        }
      }
      if (plan.repeatStudyTasks.length) {
        await tx.studyTask.createMany({
          data: plan.repeatStudyTasks.map((task) => ({
            id: task.id,
            courseId: task.courseId,
            learningTopicId: task.learningTopicId,
            isDailyStudy: false,
            title: task.title,
            estimatedHours: task.estimatedHours,
            deadline: task.deadline,
          })),
          skipDuplicates: true,
        });
      }
      for (let offset = 0; offset < plan.dailyStudyTasks.length; offset += 250) {
        const batch = plan.dailyStudyTasks.slice(offset, offset + 250);
        const values = Prisma.join(batch.map((task) => Prisma.sql`(${task.id}::text, ${task.courseId}::text, ${task.title}::text, ${task.estimatedHours}::double precision, ${task.deadline}::timestamp(3), ${task.learningTopicId}::text, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`));
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "StudyTask" ("id", "courseId", "title", "estimatedHours", "deadline", "learningTopicId", "isDailyStudy", "createdAt", "updatedAt")
          VALUES ${values}
          ON CONFLICT ("id") DO UPDATE SET
            "title" = EXCLUDED."title",
            "estimatedHours" = EXCLUDED."estimatedHours",
            "deadline" = EXCLUDED."deadline",
            "learningTopicId" = EXCLUDED."learningTopicId",
            "isDailyStudy" = true,
            "status" = 'PENDING'::"StatusState",
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "StudyTask"."adjustedHours" = 0
        `);
      }
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
      // A semester can contain hundreds or thousands of sessions. Insert them
      // in bounded batches so a long run of individual INSERTs cannot exhaust
      // Prisma's interactive transaction timeout.
      for (let offset = 0; offset < plan.result.sessions.length; offset += 250) {
        const batch = plan.result.sessions.slice(offset, offset + 250);
        await tx.studySession.createMany({
          data: batch.map((session) => ({
            taskId: session.taskId,
            userId,
            scheduledStart: session.startTime,
            scheduledEnd: session.endTime,
            plannedDuration: session.durationHours,
            status: 'SCHEDULED',
          })),
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });

    return { totalSessionsCreated: plan.result.sessions.length, conflicts: plan.result.conflicts, capacity: plan.result };
  }
}
