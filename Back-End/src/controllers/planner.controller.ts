import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { PriorityEngine } from '../services/plannerEngine/priority.engine';
import { SchedulingEngine } from '../services/plannerEngine/scheduling.engine';

export const generatePlannerSchedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { semesterId } = req.body;

    if (!userId) throw new AppError('Unauthorized access', 401);
    if (typeof semesterId !== 'string' || !semesterId) throw new AppError('semesterId is required.', 400);

    // 1. Fetch Semester details to get date range
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
      include: {
        courses: {
          include: {
            studyTasks: {
              where: { status: 'PENDING' },
              include: { assignment: true },
            },
          },
        },
      },
    });

    if (!semester) throw new AppError('Semester not found.', 404);

    // 2. Fetch User's Availability Slots
    const availabilityRules = await prisma.availabilitySlot.findMany({
      where: { userId, isBlocked: false },
    });

    if (availabilityRules.length === 0) throw new AppError('No availability slots configured. Please set your study hours first.', 400);

    // 3. Extract and score all pending tasks using PriorityEngine
    const allTasks = semester.courses.flatMap((course) => course.studyTasks.map((task) => ({ ...task, course })));
    
    const tasksWithPriority = allTasks.map(task => {
      const priorityScore = PriorityEngine.calculatePriority({
        deadline: task.deadline,
        estimatedHours: task.estimatedHours,
        difficulty: task.assignment?.difficulty ?? task.course.difficulty,
        userPriority: task.assignment?.priority ?? task.course.priority,
      });

      return {
        id: task.id,
        title: task.title,
        estimatedHours: task.estimatedHours,
        priorityScore,
        deadline: task.deadline,
      };
    });

    // 4. Map weekly availability rules to concrete calendar dates within semester bounds
    const concreteSlots: { id: string; startTime: Date; endTime: Date }[] = [];
    const currentDate = new Date(semester.startDate);
    const endDate = new Date(semester.endDate);

    let slotCounter = 1;
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday...
      const matchingRules = availabilityRules.filter(rule => rule.dayOfWeek === dayOfWeek);

      for (const rule of matchingRules) {
        const [startHour, startMin] = rule.startTime.split(':').map(Number);
        const [endHour, endMin] = rule.endTime.split(':').map(Number);

        const slotStart = new Date(currentDate);
        slotStart.setHours(startHour, startMin, 0, 0);

        const slotEnd = new Date(currentDate);
        slotEnd.setHours(endHour, endMin, 0, 0);

        if (slotStart > new Date()) { // Only schedule for future slots
          concreteSlots.push({
            id: `slot-${slotCounter++}`,
            startTime: slotStart,
            endTime: slotEnd,
          });
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 5. Run Deterministic Scheduling Engine
    const generatedSessions = SchedulingEngine.generateSchedule(tasksWithPriority, concreteSlots);

    // 6. Persist generated study sessions in the database
    // Clear previous scheduled sessions for these tasks to avoid duplicates
    const taskIds = tasksWithPriority.map(t => t.id);
    const createdSessions = await prisma.$transaction(async (tx) => {
      await tx.studySession.deleteMany({
        where: { taskId: { in: taskIds }, userId, status: 'SCHEDULED' },
      });
      return Promise.all(generatedSessions.map((session) => tx.studySession.create({
        data: {
          taskId: session.taskId,
          userId,
          scheduledStart: session.startTime,
          scheduledEnd: session.endTime,
          plannedDuration: session.durationHours,
          status: 'SCHEDULED',
        },
      })));
    });

    return res.status(200).json({
      success: true,
      data: {
      message: 'Semester schedule generated successfully via deterministic engine.',
      totalSessionsCreated: createdSessions.length,
      sessions: createdSessions,
      },
    });
  } catch (error) {
    next(error);
  }
};
