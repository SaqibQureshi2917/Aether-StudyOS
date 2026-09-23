import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PriorityEngine } from '../services/plannerEngine/priority.engine';
import { SchedulingEngine } from '../services/plannerEngine/scheduling.engine';

const prisma = new PrismaClient();

export const generatePlannerSchedule = async (req: Request, res: Response) => {
  try {
    const { semesterId, userId } = req.body;

    if (!semesterId || !userId) {
      return res.status(400).json({ error: 'semesterId and userId are required.' });
    }

    // 1. Fetch Semester details to get date range
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
      include: {
        courses: {
          include: {
            studyTasks: {
              where: { status: 'PENDING' },
            },
          },
        },
      },
    });

    if (!semester) {
      return res.status(404).json({ error: 'Semester not found.' });
    }

    // 2. Fetch User's Availability Slots
    const availabilityRules = await prisma.availabilitySlot.findMany({
      where: { userId, isBlocked: false },
    });

    if (availabilityRules.length === 0) {
      return res.status(400).json({ error: 'No availability slots configured. Please set your study hours first.' });
    }

    // 3. Extract and score all pending tasks using PriorityEngine
    const allTasks = semester.courses.flatMap(course => course.studyTasks);
    
    const tasksWithPriority = allTasks.map(task => {
      const priorityScore = PriorityEngine.calculatePriority({
        deadline: task.deadline,
        estimatedHours: task.estimatedHours,
        difficulty: 'MEDIUM', // Can be dynamically mapped from related assignment/course
        userPriority: 'MEDIUM',
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
    await prisma.studySession.deleteMany({
      where: {
        taskId: { in: taskIds },
        status: 'SCHEDULED',
      },
    });

    const createdSessions = await prisma.$transaction(
      generatedSessions.map(session =>
        prisma.studySession.create({
          data: {
            taskId: session.taskId,
            userId,
            scheduledStart: session.startTime,
            scheduledEnd: session.endTime,
            plannedDuration: session.durationHours,
            status: 'SCHEDULED',
          },
        })
      )
    );

    return res.status(200).json({
      message: 'Semester schedule generated successfully via deterministic engine.',
      totalSessionsCreated: createdSessions.length,
      sessions: createdSessions,
    });
  } catch (error: any) {
    console.error('[PlannerController Error]:', error);
    return res.status(500).json({ error: 'Internal server error while generating schedule.', details: error.message });
  }
};