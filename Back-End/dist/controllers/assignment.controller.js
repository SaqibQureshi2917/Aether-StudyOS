"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleAssignmentStatus = exports.deleteAssignmentTask = exports.toggleAssignmentTask = exports.deleteAssignment = exports.updateAssignment = exports.regenerateAssignmentTasks = exports.addAssignmentTask = exports.getAssignmentById = exports.getAssignments = exports.createAssignment = void 0;
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
const ai_service_1 = require("../services/ai/ai.service");
const zod_1 = require("zod");
// 1. Create Assignment
const createAssignment = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { title, description, courseId, deadline, difficulty, priority, estimatedHours } = req.body;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        if (typeof title !== 'string' || !title.trim() || title.trim().length > 200 || typeof courseId !== 'string' || !deadline) {
            throw new error_middleware_1.AppError('A title, course, and deadline are required.', 400);
        }
        const deadlineDate = new Date(deadline);
        const now = new Date();
        const year = deadlineDate.getFullYear();
        if (isNaN(deadlineDate.getTime())) {
            throw new error_middleware_1.AppError('Invalid deadline date format provided.', 400);
        }
        if (deadlineDate < now) {
            throw new error_middleware_1.AppError('Assignment deadline must be in the future.', 400);
        }
        if (year < 2026 || year > 2100) {
            throw new error_middleware_1.AppError('Deadline year must be between 2026 and 2100.', 400);
        }
        // Verify course belongs to user via semester relation
        const course = await db_1.prisma.course.findFirst({
            where: {
                id: courseId,
                semester: { userId }
            }
        });
        if (!course)
            throw new error_middleware_1.AppError('Course not found or unauthorized', 404);
        const parsedEstimate = estimatedHours === undefined ? 1 : Number(estimatedHours);
        if (!Number.isFinite(parsedEstimate) || parsedEstimate <= 0 || parsedEstimate > 1000) {
            throw new error_middleware_1.AppError('Estimated hours must be greater than 0 and at most 1000.', 400);
        }
        if (difficulty !== undefined && !['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
            throw new error_middleware_1.AppError('Assignment difficulty is invalid.', 400);
        }
        if (priority !== undefined && !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
            throw new error_middleware_1.AppError('Assignment priority is invalid.', 400);
        }
        const assignment = await db_1.prisma.assignment.create({
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
    }
    catch (error) {
        next(error);
    }
};
exports.createAssignment = createAssignment;
// 2. Get All User Assignments (With Status & Priority Filters)
const getAssignments = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { status, priority, courseId } = req.query;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        const whereClause = {
            course: {
                semester: { userId }
            }
        };
        if (status)
            whereClause.status = status;
        if (priority)
            whereClause.priority = priority;
        if (courseId)
            whereClause.courseId = courseId;
        const assignments = await db_1.prisma.assignment.findMany({
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
    }
    catch (error) {
        next(error);
    }
};
exports.getAssignments = getAssignments;
// 3. Get Assignment Detail by ID
const getAssignmentById = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const assignment = await db_1.prisma.assignment.findFirst({
            where: {
                id,
                course: { semester: { userId } }
            },
            include: {
                course: { select: { name: true, colorCode: true } },
                studyTasks: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!assignment)
            throw new error_middleware_1.AppError('Assignment not found', 404);
        res.status(200).json({
            success: true,
            data: { assignment },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAssignmentById = getAssignmentById;
// 4. Add Task / Milestone to Assignment
const addAssignmentTask = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { title, estimatedHours } = req.body;
        const assignment = await db_1.prisma.assignment.findFirst({
            where: {
                id,
                course: { semester: { userId } }
            }
        });
        if (!assignment)
            throw new error_middleware_1.AppError('Assignment not found', 404);
        if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
            throw new error_middleware_1.AppError('Milestone title must be between 1 and 200 characters.', 400);
        }
        const parsedHours = estimatedHours === undefined ? 1 : Number(estimatedHours);
        if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 1000) {
            throw new error_middleware_1.AppError('Milestone hours must be greater than 0 and at most 1000.', 400);
        }
        const task = await db_1.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT "id" FROM "Assignment" WHERE "id" = ${id} FOR UPDATE`;
            const existingTasks = await tx.studyTask.findMany({
                where: { assignmentId: id },
                select: { estimatedHours: true },
            });
            const alreadyAllocatedHours = existingTasks.reduce((total, item) => total + item.estimatedHours, 0);
            if (alreadyAllocatedHours + parsedHours > assignment.estimatedHours + 0.000001) {
                const remainingMinutes = Math.max(0, Math.floor((assignment.estimatedHours - alreadyAllocatedHours) * 60 + 0.000001));
                const requestedMinutes = Math.ceil(parsedHours * 60 - 0.000001);
                const assignmentMinutes = Math.round(assignment.estimatedHours * 60);
                throw new error_middleware_1.AppError(`This milestone is set to ${requestedMinutes} minutes, but only ${remainingMinutes} minutes remain in the assignment's ${assignmentMinutes}-minute time budget. Reduce the milestone time to fit.`, 400);
            }
            return tx.studyTask.create({
                data: {
                    courseId: assignment.courseId,
                    assignmentId: id,
                    title: title.trim(),
                    deadline: assignment.deadline,
                    estimatedHours: parsedHours,
                },
            });
        });
        res.status(201).json({
            success: true,
            message: 'Milestone task added',
            data: { task },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.addAssignmentTask = addAssignmentTask;
const MilestonePlanSchema = zod_1.z.object({
    milestones: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string().trim().min(4).max(160) })),
});
// Generate assignment-specific milestones and preserve existing work unless the user chooses replacement.
const regenerateAssignmentTasks = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        const preserveExisting = req.body?.preserveExisting !== false;
        const assignment = await db_1.prisma.assignment.findFirst({
            where: { id, course: { semester: { userId } } },
            select: { id: true, courseId: true, deadline: true, estimatedHours: true, title: true, description: true, course: { select: { name: true } } },
        });
        if (!assignment)
            throw new error_middleware_1.AppError('Assignment not found', 404);
        const existingTasks = await db_1.prisma.studyTask.findMany({
            where: { assignmentId: id },
            select: { id: true, title: true, estimatedHours: true },
            orderBy: { createdAt: 'asc' },
        });
        const targetCount = 4;
        const milestoneCount = preserveExisting ? Math.max(0, targetCount - existingTasks.length) : targetCount;
        if (milestoneCount === 0) {
            return res.status(200).json({
                success: true,
                message: 'You already have four or more milestones. Choose replacement to create a new AI plan.',
                data: { tasks: [], addedCount: 0 },
            });
        }
        const alreadyAllocatedHours = preserveExisting ? existingTasks.reduce((total, task) => total + task.estimatedHours, 0) : 0;
        const remainingHours = Math.max(0, assignment.estimatedHours - alreadyAllocatedHours);
        const remainingMinutes = Math.floor(remainingHours * 60 + 0.000001);
        if (remainingMinutes < milestoneCount) {
            throw new error_middleware_1.AppError(`There is not enough unallocated time for ${milestoneCount} more milestones. Only ${remainingMinutes} minutes remain. Increase the assignment time or reduce the time assigned to existing milestones.`, 400);
        }
        const prompt = `Create exactly ${milestoneCount} new study milestones for this assignment. Each milestone must be specific to the assignment and form a useful next step. Do not use generic phase names. Return JSON only in this shape: {"milestones":[{"title":"..."}]}.\n\nAssignment: ${assignment.title}\nSubject: ${assignment.course.name}\nDescription: ${(assignment.description || 'No description provided.').slice(0, 2500)}\nTotal study time: ${assignment.estimatedHours} hours\nTime remaining for new milestones: ${remainingMinutes} minutes\nExisting milestones to preserve and avoid duplicating: ${preserveExisting ? existingTasks.map((task) => task.title).join('; ') || 'None' : 'The user chose to replace these: ' + existingTasks.map((task) => task.title).join('; ')}`;
        const aiResponse = await ai_service_1.aiAdapter.generateText({
            prompt,
            systemPrompt: 'You are an academic assignment planning assistant. Break the specific assignment into concise, actionable study milestones. Use only the assignment details provided. Return valid JSON matching the requested structure and exactly the requested number of unique milestone titles.',
            temperature: 0.3,
            maxTokens: 1000,
            responseFormat: 'json_object',
        });
        let proposedMilestones;
        try {
            proposedMilestones = MilestonePlanSchema.parse(JSON.parse(aiResponse));
        }
        catch {
            throw new error_middleware_1.AppError('The AI could not create a clear milestone plan. Please try again.', 502);
        }
        const titles = [...new Set(proposedMilestones.milestones.map((milestone) => milestone.title))];
        const existingTitleSet = new Set((preserveExisting ? existingTasks : []).map((task) => task.title.trim().toLocaleLowerCase()));
        if (titles.length !== milestoneCount || titles.some((title) => existingTitleSet.has(title.trim().toLocaleLowerCase()))) {
            throw new error_middleware_1.AppError('The AI could not create the requested number of unique milestones. Please try again.', 502);
        }
        const generated = await db_1.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT "id" FROM "Assignment" WHERE "id" = ${id} FOR UPDATE`;
            const currentTasks = await tx.studyTask.findMany({
                where: { assignmentId: id },
                select: { id: true, estimatedHours: true },
            });
            const expectedIds = new Set(existingTasks.map((task) => task.id));
            if (currentTasks.length !== existingTasks.length || currentTasks.some((task) => !expectedIds.has(task.id))) {
                throw new error_middleware_1.AppError('This assignment changed while the AI was planning. Refresh the page and try again.', 409);
            }
            const activeSession = await tx.studySession.findFirst({
                where: { task: { assignmentId: id }, status: 'IN_PROGRESS' },
                select: { id: true },
            });
            if (!preserveExisting && activeSession) {
                throw new error_middleware_1.AppError('Stop the active study session before replacing these milestones.', 409);
            }
            const currentAllocatedHours = preserveExisting ? currentTasks.reduce((total, task) => total + task.estimatedHours, 0) : 0;
            const currentRemainingHours = assignment.estimatedHours - currentAllocatedHours;
            if (currentRemainingHours * 60 + 0.000001 < milestoneCount) {
                throw new error_middleware_1.AppError('The available assignment time changed. Refresh the page and review the remaining time.', 409);
            }
            if (!preserveExisting)
                await tx.studyTask.deleteMany({ where: { assignmentId: id } });
            const estimatedHoursPerMilestone = currentRemainingHours / milestoneCount;
            const created = [];
            for (const title of titles) {
                created.push(await tx.studyTask.create({
                    data: {
                        courseId: assignment.courseId,
                        assignmentId: id,
                        title,
                        deadline: assignment.deadline,
                        estimatedHours: estimatedHoursPerMilestone,
                    },
                }));
            }
            await tx.assignment.update({ where: { id }, data: { status: 'PENDING' } });
            return created;
        });
        res.status(200).json({
            success: true,
            message: preserveExisting ? 'AI milestones added while keeping your existing milestones.' : 'Existing milestones replaced with a new AI plan.',
            data: { tasks: generated, addedCount: generated.length },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.regenerateAssignmentTasks = regenerateAssignmentTasks;
// 5. Update Assignment Details
const updateAssignment = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { title, description, deadline, priority, difficulty, status, estimatedHours } = req.body;
        const assignment = await db_1.prisma.assignment.findFirst({
            where: {
                id,
                course: { semester: { userId } }
            }
        });
        if (!assignment)
            throw new error_middleware_1.AppError('Assignment not found', 404);
        if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.trim().length > 200)) {
            throw new error_middleware_1.AppError('Assignment title must be between 1 and 200 characters.', 400);
        }
        const deadlineDate = deadline === undefined ? undefined : new Date(deadline);
        if (deadlineDate && !Number.isFinite(deadlineDate.getTime()))
            throw new error_middleware_1.AppError('Invalid deadline date.', 400);
        if (priority !== undefined && !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
            throw new error_middleware_1.AppError('Assignment priority is invalid.', 400);
        }
        if (difficulty !== undefined && !['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
            throw new error_middleware_1.AppError('Assignment difficulty is invalid.', 400);
        }
        if (status !== undefined && !['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'].includes(status)) {
            throw new error_middleware_1.AppError('Assignment status is invalid.', 400);
        }
        const estimate = estimatedHours === undefined ? undefined : Number(estimatedHours);
        if (estimate !== undefined && (!Number.isFinite(estimate) || estimate <= 0 || estimate > 1000)) {
            throw new error_middleware_1.AppError('Estimated hours must be greater than 0 and at most 1000.', 400);
        }
        const updated = await db_1.prisma.assignment.update({
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
    }
    catch (error) {
        next(error);
    }
};
exports.updateAssignment = updateAssignment;
// 6. Delete Assignment
const deleteAssignment = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const assignment = await db_1.prisma.assignment.findFirst({
            where: {
                id,
                course: { semester: { userId } }
            }
        });
        if (!assignment)
            throw new error_middleware_1.AppError('Assignment not found', 404);
        await db_1.prisma.assignment.delete({ where: { id } });
        res.status(200).json({
            success: true,
            message: 'Assignment deleted successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteAssignment = deleteAssignment;
// 7. Toggle Task / Milestone Completion Status
const toggleAssignmentTask = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id, taskId } = req.params;
        const assignment = await db_1.prisma.assignment.findFirst({
            where: {
                id,
                course: { semester: { userId } }
            },
            include: { studyTasks: true }
        });
        if (!assignment)
            throw new error_middleware_1.AppError('Assignment not found', 404);
        const task = await db_1.prisma.studyTask.findFirst({
            where: { id: taskId, assignmentId: id }
        });
        if (!task)
            throw new error_middleware_1.AppError('Task not found', 404);
        // Toggle Task State using status field
        const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
        const { updatedTask, newAssignmentStatus } = await db_1.prisma.$transaction(async (tx) => {
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
    }
    catch (error) {
        next(error);
    }
};
exports.toggleAssignmentTask = toggleAssignmentTask;
// 8. Delete Task / Milestone
const deleteAssignmentTask = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id, taskId } = req.params;
        const assignment = await db_1.prisma.assignment.findFirst({
            where: {
                id,
                course: { semester: { userId } }
            }
        });
        if (!assignment)
            throw new error_middleware_1.AppError('Assignment not found', 404);
        const task = await db_1.prisma.studyTask.findFirst({ where: { id: taskId, assignmentId: id } });
        if (!task)
            throw new error_middleware_1.AppError('Milestone not found.', 404);
        await db_1.prisma.studyTask.delete({ where: { id: task.id } });
        res.status(200).json({
            success: true,
            message: 'Milestone task deleted',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteAssignmentTask = deleteAssignmentTask;
// 9. Toggle Assignment Status
const toggleAssignmentStatus = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const assignment = await db_1.prisma.assignment.findFirst({
            where: {
                id,
                course: { semester: { userId } }
            }
        });
        if (!assignment)
            throw new error_middleware_1.AppError('Assignment not found', 404);
        const nextStatus = assignment.status === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';
        const updated = await db_1.prisma.assignment.update({
            where: { id },
            data: { status: nextStatus }
        });
        res.status(200).json({
            success: true,
            data: { assignment: updated }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.toggleAssignmentStatus = toggleAssignmentStatus;
