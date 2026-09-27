import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import{ AppError} from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// 1. Create Assignment
export const createAssignment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { title, description, courseId, deadline, difficulty, priority, estimatedHours } = req.body;
    
    if (!userId) throw new AppError('Unauthorized access', 401);
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200 || typeof courseId !== 'string' || !deadline) {
      throw new AppError('A title, course, and deadline are required.', 400);
    }
    
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

    // Verify course belongs to user via semester relation
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        semester: { userId }
      }
    });
    if (!course) throw new AppError('Course not found or unauthorized', 404);

    const parsedEstimate = estimatedHours === undefined ? 1 : Number(estimatedHours);
    if (!Number.isFinite(parsedEstimate) || parsedEstimate <= 0 || parsedEstimate > 1000) {
      throw new AppError('Estimated hours must be greater than 0 and at most 1000.', 400);
    }
    if (difficulty !== undefined && !['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
      throw new AppError('Assignment difficulty is invalid.', 400);
    }
    if (priority !== undefined && !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
      throw new AppError('Assignment priority is invalid.', 400);
    }

    const assignment = await prisma.assignment.create({
      data: {
        courseId,
        title: title.trim(),
        description: description || null,
        deadline: deadlineDate,
        difficulty: difficulty || 'MEDIUM',
        priority: priority || 'MEDIUM',
        estimatedHours: parsedEstimate,
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
    
    const whereClause: any = {
      course: {
        semester: { userId }
      }
    };
    if (status) whereClause.status = status as string;
    if (priority) whereClause.priority = priority as string;
    if (courseId) whereClause.courseId = courseId as string;

    const assignments = await prisma.assignment.findMany({
      where: whereClause,
      include: {
        course: { select: { id: true, name: true, colorCode: true } },
        studyTasks: { select: { id: true, status: true } },
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
      where: { 
        id, 
        course: { semester: { userId } } 
      },
      include: {
        course: { select: { name: true, colorCode: true } },
        studyTasks: { orderBy: { createdAt: 'asc' } },
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

    const assignment = await prisma.assignment.findFirst({ 
      where: { 
        id, 
        course: { semester: { userId } } 
      } 
    });
    if (!assignment) throw new AppError('Assignment not found', 404);
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
      throw new AppError('Milestone title must be between 1 and 200 characters.', 400);
    }
    const parsedHours = estimatedHours === undefined ? 1 : Number(estimatedHours);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 1000) {
      throw new AppError('Milestone hours must be greater than 0 and at most 1000.', 400);
    }

    const task = await prisma.studyTask.create({
      data: {
        courseId: assignment.courseId,
        assignmentId: id,
        title: title.trim(),
        deadline: assignment.deadline,
        estimatedHours: parsedHours,
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

// Replace the generated milestone set atomically. Row locking makes concurrent
// regenerate requests serialize instead of leaving duplicate sets behind.
export const regenerateAssignmentTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) throw new AppError('Unauthorized access', 401);

    const assignment = await prisma.assignment.findFirst({
      where: { id, course: { semester: { userId } } },
      select: { id: true, courseId: true, deadline: true },
    });
    if (!assignment) throw new AppError('Assignment not found', 404);

    const titles = [
      'Understand Requirements & Specs',
      'Dataset / Resource Preparation',
      'Core Implementation / Architecture',
      'Testing, Evaluation & Report Writing',
    ];
    const tasks = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Assignment" WHERE "id" = ${id} FOR UPDATE`;
      const activeSession = await tx.studySession.findFirst({
        where: { task: { assignmentId: id }, status: 'IN_PROGRESS' },
        select: { id: true },
      });
      if (activeSession) throw new AppError('Finish or stop the active study session before regenerating milestones.', 409);
      await tx.studyTask.deleteMany({ where: { assignmentId: id } });
      const created = [];
      for (const title of titles) {
        created.push(await tx.studyTask.create({
          data: { courseId: assignment.courseId, assignmentId: id, title, deadline: assignment.deadline, estimatedHours: 1 },
        }));
      }
      await tx.assignment.update({ where: { id }, data: { status: 'PENDING' } });
      return created;
    });

    res.status(200).json({ success: true, message: 'Milestones regenerated successfully', data: { tasks } });
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

    const assignment = await prisma.assignment.findFirst({ 
      where: { 
        id, 
        course: { semester: { userId } } 
      } 
    });
    if (!assignment) throw new AppError('Assignment not found', 404);

    if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.trim().length > 200)) {
      throw new AppError('Assignment title must be between 1 and 200 characters.', 400);
    }
    const deadlineDate = deadline === undefined ? undefined : new Date(deadline);
    if (deadlineDate && !Number.isFinite(deadlineDate.getTime())) throw new AppError('Invalid deadline date.', 400);
    if (priority !== undefined && !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
      throw new AppError('Assignment priority is invalid.', 400);
    }
    if (difficulty !== undefined && !['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
      throw new AppError('Assignment difficulty is invalid.', 400);
    }
    if (status !== undefined && !['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'].includes(status)) {
      throw new AppError('Assignment status is invalid.', 400);
    }
    const estimate = estimatedHours === undefined ? undefined : Number(estimatedHours);
    if (estimate !== undefined && (!Number.isFinite(estimate) || estimate <= 0 || estimate > 1000)) {
      throw new AppError('Estimated hours must be greater than 0 and at most 1000.', 400);
    }

    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(deadlineDate && { deadline: deadlineDate }),
        ...(priority && { priority }),
        ...(difficulty && { difficulty }),
        ...(status && { status }),
        ...(estimate !== undefined && { estimatedHours: estimate }),
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

    const assignment = await prisma.assignment.findFirst({ 
      where: { 
        id, 
        course: { semester: { userId } } 
      } 
    });
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
      where: { 
        id, 
        course: { semester: { userId } } 
      },
      include: { studyTasks: true }
    });
    if (!assignment) throw new AppError('Assignment not found', 404);

    const task = await prisma.studyTask.findFirst({ 
      where: { id: taskId, assignmentId: id } 
    });
    if (!task) throw new AppError('Task not found', 404);

    // Toggle Task State using status field
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    const { updatedTask, newAssignmentStatus } = await prisma.$transaction(async (tx) => {
      const updatedTask = await tx.studyTask.update({ where: { id: taskId }, data: { status: newStatus } });
      const allTasks = await tx.studyTask.findMany({ where: { assignmentId: id }, select: { status: true } });
      const newAssignmentStatus = allTasks.length > 0 && allTasks.every((item) => item.status === 'COMPLETED')
        ? 'COMPLETED'
        : allTasks.some((item) => item.status === 'IN_PROGRESS' || item.status === 'COMPLETED') ? 'IN_PROGRESS' : 'PENDING';
      await tx.assignment.update({ where: { id }, data: { status: newAssignmentStatus } });
      return { updatedTask, newAssignmentStatus };
    });

    res.status(200).json({
      success: true,
      data: { task: updatedTask, assignmentStatus: newAssignmentStatus },
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

    const assignment = await prisma.assignment.findFirst({ 
      where: { 
        id, 
        course: { semester: { userId } } 
      } 
    });
    if (!assignment) throw new AppError('Assignment not found', 404);

    const task = await prisma.studyTask.findFirst({ where: { id: taskId, assignmentId: id } });
    if (!task) throw new AppError('Milestone not found.', 404);
    await prisma.studyTask.delete({ where: { id: task.id } });

    res.status(200).json({
      success: true,
      message: 'Milestone task deleted',
    });
  } catch (error) {
    next(error);
  }
};

// 9. Toggle Assignment Status
export const toggleAssignmentStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const assignment = await prisma.assignment.findFirst({ 
      where: { 
        id, 
        course: { semester: { userId } } 
      } 
    });
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
