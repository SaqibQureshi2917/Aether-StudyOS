import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import {AppError} from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { localDateParts, localDayBoundary } from '../services/plannerEngine/timezone.util';

export const getDashboardOverview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized access', 401);
    }

    // 1. Fetch User Profile & Subscription Plan Status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        major: true,
        currentSemester: true,
        dailyGoalHours: true,
        planType: true,
      },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const activeSemester = await prisma.semester.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    // 2. Fetch Today's Scheduled Tasks (Today's Plan) using StudySession
    const timeZone = typeof req.query.timeZone === 'string' ? req.query.timeZone : 'UTC';
    try { new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date()); }
    catch { throw new AppError('Your device time zone is not supported. Refresh the page and try again.', 400); }
    const parts = localDateParts(new Date(), timeZone);
    const today = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const startOfToday = localDayBoundary(today, timeZone, false);
    const startOfTomorrow = localDayBoundary(tomorrow, timeZone, false);

    const todayPlan = await prisma.studySession.findMany({
      where: {
        userId,
        scheduledStart: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
      },
      include: {
        task: {
          include: {
            course: { select: { name: true } },
            assignment: {
              select: { id: true, title: true, priority: true },
            },
          },
        },
      },
      orderBy: { scheduledStart: 'asc' },
    });

    // 3. Fetch Urgent Upcoming Deadlines (Next 7 Days) - Assignment uses course -> semester relation
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const upcomingDeadlines = await prisma.assignment.findMany({
      where: {
        course: {
          semester: { userId },
        },
        status: { not: 'COMPLETED' },
        deadline: { lte: sevenDaysLater },
      },
      include: {
        course: { select: { name: true, colorCode: true } },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
    });

    const urgentWorkload = await prisma.assignment.findMany({
      where: {
        course: { semester: { userId } },
        status: { not: 'COMPLETED' },
        deadline: { lte: threeDaysLater },
      },
      select: { estimatedHours: true, completedHours: true },
    });

    // 4. Calculate Workload Risk (Schedule Risk Algorithm)
    const totalRemainingHours = urgentWorkload.reduce(
      (acc, item) => acc + Math.max(0, item.estimatedHours - item.completedHours),
      0
    );

    const availableStudyCapacity = user.dailyGoalHours * 3; // Capacity over next 3 days
    const isScheduleAtRisk = totalRemainingHours > availableStudyCapacity;
    const overloadMinutes = isScheduleAtRisk
      ? Math.max(1, Math.ceil((totalRemainingHours - availableStudyCapacity) * 60 - 0.000001))
      : 0;

    // 5. Fetch Weak Topics for Adaptive Recommendations
    const weakTopics = await prisma.topicMastery.findMany({
      where: {
        userId,
        masteryPercentage: { lt: 60.0 }, // Under 60% mastery
      },
      include: {
        course: { select: { name: true } },
      },
      orderBy: { masteryPercentage: 'asc' },
      take: 3,
    });

    // Send Structured Single Response
    res.status(200).json({
      success: true,
      data: {
        user: {
          fullName: user.fullName,
          major: user.major,
          semester: user.currentSemester,
          planType: user.planType, // 'FREE' | 'PRO'
          dailyGoalHours: user.dailyGoalHours,
          activeSemesterId: activeSemester?.id ?? null,
        },
        todayPlan,
        upcomingDeadlines,
        scheduleRisk: {
          isAtRisk: isScheduleAtRisk,
          overloadHours: overloadMinutes / 60,
          overloadMinutes,
          message: isScheduleAtRisk
            ? `Your upcoming assignments need ${formatWorkloadDuration(totalRemainingHours)} of study time, but your daily goal provides ${formatWorkloadDuration(availableStudyCapacity)} over the next 3 days. You are short by ${formatWorkloadDuration(overloadMinutes / 60)}.`
            : 'Schedule is balanced.',
        },
        weakTopics,
        recommendations: weakTopics.length > 0 ? [
          {
            topic: weakTopics[0].topicName,
            courseName: weakTopics[0].course.name,
            mastery: weakTopics[0].masteryPercentage,
            suggestedAction: `Revise ${weakTopics[0].topicName} for 45 mins before your next quiz.`,
          }
        ] : [],
      },
    });
  } catch (error) {
    next(error);
  }
};

const formatWorkloadDuration = (hours: number) => {
  const totalMinutes = Math.max(0, Math.ceil(hours * 60 - 0.000001));
  const wholeHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  return [wholeHours ? `${wholeHours} hour${wholeHours === 1 ? '' : 's'}` : '', remainingMinutes ? `${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}` : '']
    .filter(Boolean)
    .join(' ') || '0 minutes';
};
