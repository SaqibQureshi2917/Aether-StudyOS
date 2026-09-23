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

    // Verify course belongs to user via semester relation
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        semester: { userId }
      }
    });
    if (!course) throw new AppError('Course not found or unauthorized', 404);

    const assignment = await prisma.assignment.create({
      data: {
        courseId,
        title,
        description: description || null,
        deadline: deadlineDate,
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

    const task = await prisma.studyTask.create({
      data: {
        courseId: assignment.courseId,
        assignmentId: id,
        title,
        deadline: assignment.deadline,
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

    const assignment = await prisma.assignment.findFirst({ 
      where: { 
        id, 
        course: { semester: { userId } } 
      } 
    });
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
        ...(estimatedHours !== undefined && { estimatedHours: parseFloat(estimatedHours) }),
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
    const updatedTask = await prisma.studyTask.update({
      where: { id: taskId },
      data: { status: newStatus },
    });

    // Check all tasks status to auto-update Assignment Status
    const allTasks = await prisma.studyTask.findMany({ where: { assignmentId: id } });
    const totalTasks = allTasks.length;
    const completedCount = allTasks.filter(t => t.status === 'COMPLETED').length;

    let newAssignmentStatus = assignment.status;
    if (totalTasks > 0 && completedCount === totalTasks) {
      newAssignmentStatus = 'COMPLETED';
    } else if (assignment.status === 'COMPLETED' && completedCount < totalTasks) {
      newAssignmentStatus = 'IN_PROGRESS';
    }

    if (newAssignmentStatus !== assignment.status) {
      await prisma.assignment.update({
        where: { id },
        data: { status: newAssignmentStatus }
      });
    }

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

    await prisma.studyTask.delete({ where: { id: taskId } });

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