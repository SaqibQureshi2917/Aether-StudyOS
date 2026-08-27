import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// 1. Create Assignment
export const createAssignment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { title, description, courseId, deadline, difficulty, priority, estimatedHours } = req.body;

    if (!userId) throw new AppError('Unauthorized access', 401);
    if (!title || !deadline) throw new AppError('Title and deadline are required.', 400);

    const deadlineDate = new Date(deadline);
    const now = new Date();
    const year = deadlineDate.getFullYear();

    if (isNaN(deadlineDate.getTime())) {
      throw new AppError('Invalid deadline date format provided.', 400);
    }

    if (deadlineDate < now) {
      throw new AppError('Assignment deadline must be in the future.', 400);
    }

    if (year < 2026 || year > 2100) {
      throw new AppError('Deadline year must be between 2026 and 2100.', 400);
    }

    const assignment = await prisma.assignment.create({
      data: {
        userId,
        courseId: courseId || null,
        title,
        description: description || null,
        deadline: new Date(deadline),
        difficulty: difficulty || 'MEDIUM',
        priority: priority || 'MEDIUM',
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : 1.0,
      },
      include: {
        course: { select: { name: true, colorCode: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data: { assignment },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get All User Assignments (With Status & Priority Filters)
export const getAssignments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { status, priority, courseId } = req.query;

    if (!userId) throw new AppError('Unauthorized access', 401);

    const whereClause: any = { userId };
    if (status) whereClause.status = status as string;
    if (priority) whereClause.priority = priority as string;
    if (courseId) whereClause.courseId = courseId as string;

    const assignments = await prisma.assignment.findMany({
      where: whereClause,
      include: {
        course: { select: { id: true, name: true, colorCode: true } },
        tasks: { select: { id: true, isCompleted: true } },
      },
      orderBy: { deadline: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: { assignments },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Assignment Detail by ID
export const getAssignmentById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const assignment = await prisma.assignment.findFirst({
      where: { id, userId },
      include: {
        course: { select: { name: true, colorCode: true } },
        tasks: { orderBy: { createdAt: 'asc' } },
        focusSessions: { orderBy: { startedAt: 'desc' } },
      },
    });

    if (!assignment) throw new AppError('Assignment not found', 404);

    res.status(200).json({
      success: true,
      data: { assignment },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Add Task / Milestone to Assignment
export const addAssignmentTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { title, estimatedHours } = req.body;

    const assignment = await prisma.assignment.findFirst({ where: { id, userId } });
    if (!assignment) throw new AppError('Assignment not found', 404);

    const task = await prisma.assignmentTask.create({
      data: {
        assignmentId: id,
        title,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : 1.0,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Milestone task added',
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Update Assignment Details
export const updateAssignment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { title, description, deadline, priority, difficulty, status, estimatedHours } = req.body;

    const assignment = await prisma.assignment.findFirst({ where: { id, userId } });
    if (!assignment) throw new AppError('Assignment not found', 404);

    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(deadline && { deadline: new Date(deadline) }),
        ...(priority && { priority }),
        ...(difficulty && { difficulty }),
        ...(status && { status }),
        ...(estimatedHours && { estimatedHours: parseFloat(estimatedHours) }),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Assignment updated successfully',
      data: { assignment: updated },
    });
  } catch (error) {
    next(error);
  }
};

// 6. Delete Assignment
export const deleteAssignment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const assignment = await prisma.assignment.findFirst({ where: { id, userId } });
    if (!assignment) throw new AppError('Assignment not found', 404);

    await prisma.assignment.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: 'Assignment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// 7. Toggle Task / Milestone Completion Status
export const toggleAssignmentTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id, taskId } = req.params;

    const assignment = await prisma.assignment.findFirst({ 
      where: { id, userId },
      include: { tasks: true }
    });
    if (!assignment) throw new AppError('Assignment not found', 404);

    const task = await prisma.assignmentTask.findFirst({ where: { id: taskId, assignmentId: id } });
    if (!task) throw new AppError('Task not found', 404);

    // Toggle Task State
    const updatedTask = await prisma.assignmentTask.update({
      where: { id: taskId },
      data: { isCompleted: !task.isCompleted },
    });

    // Check all tasks status to auto-update Assignment Status
    const allTasks = await prisma.assignmentTask.findMany({ where: { assignmentId: id } });
    const totalTasks = allTasks.length;
    const completedCount = allTasks.filter(t => t.isCompleted).length;

    let newStatus = assignment.status;
    if (totalTasks > 0 && completedCount === totalTasks) {
      newStatus = 'COMPLETED';
    } else if (assignment.status === 'COMPLETED' && completedCount < totalTasks) {
      newStatus = 'IN_PROGRESS';
    }

    if (newStatus !== assignment.status) {
      await prisma.assignment.update({
        where: { id },
        data: { status: newStatus }
      });
    }

    res.status(200).json({
      success: true,
      data: { task: updatedTask, assignmentStatus: newStatus },
    });
  } catch (error) {
    next(error);
  }
};

// 8. Delete Task / Milestone
export const deleteAssignmentTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id, taskId } = req.params;

    const assignment = await prisma.assignment.findFirst({ where: { id, userId } });
    if (!assignment) throw new AppError('Assignment not found', 404);

    await prisma.assignmentTask.delete({ where: { id: taskId } });

    res.status(200).json({
      success: true,
      message: 'Milestone task deleted',
    });
  } catch (error) {
    next(error);
  }
};
export const toggleAssignmentStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const assignment = await prisma.assignment.findFirst({ where: { id, userId } });
    if (!assignment) throw new AppError('Assignment not found', 404);

    const nextStatus = assignment.status === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';

    const updated = await prisma.assignment.update({
      where: { id },
      data: { status: nextStatus }
    });

    res.status(200).json({
      success: true,
      data: { assignment: updated }
    });
  } catch (error) {
    next(error);
  }
};