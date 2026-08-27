import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

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

    // 2. Fetch Today's Scheduled Tasks (Today's Plan)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todayPlan = await prisma.plannerEntry.findMany({
      where: {
        userId,
        scheduledDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      include: {
        assignment: {
          select: { id: true, title: true, priority: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // 3. Fetch Urgent Upcoming Deadlines (Next 7 Days)
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const upcomingDeadlines = await prisma.assignment.findMany({
      where: {
        userId,
        status: { not: 'COMPLETED' },
        deadline: {
          gte: startOfToday,
          lte: sevenDaysLater,
        },
      },
      include: {
        course: { select: { name: true, colorCode: true } },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
    });

    // 4. Calculate Workload Risk (Schedule Risk Algorithm)
    const totalRemainingHours = upcomingDeadlines.reduce(
      (acc, item) => acc + Math.max(0, item.estimatedHours - item.completedHours),
      0
    );
    const availableStudyCapacity = user.dailyGoalHours * 3; // Capacity over next 3 days
    const isScheduleAtRisk = totalRemainingHours > availableStudyCapacity;

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
          major: user.major || 'Computer Science',
          semester: user.currentSemester || 'Semester 7',
          planType: user.planType, // 'FREE' | 'PRO'
          dailyGoalHours: user.dailyGoalHours,
        },
        todayPlan,
        upcomingDeadlines,
        scheduleRisk: {
          isAtRisk: isScheduleAtRisk,
          overloadHours: isScheduleAtRisk ? Math.round(totalRemainingHours - availableStudyCapacity) : 0,
          message: isScheduleAtRisk
            ? `Your current workload exceeds available study capacity by ~${Math.round(totalRemainingHours - availableStudyCapacity)} hours.`
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