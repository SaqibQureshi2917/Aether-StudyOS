"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCourse = exports.updateCourse = exports.getCourseById = exports.getCourses = exports.createCourse = void 0;
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
const parseScaleValue = (value, fieldName, min, max, fallback) => {
    if (value === undefined)
        return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw new error_middleware_1.AppError(`${fieldName} must be between ${min} and ${max}.`, 400);
    }
    return parsed;
};
// 1. Create Course
const createCourse = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { name, code, creditHours, difficulty, priority, instructor, description, colorCode, semesterId } = req.body;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 || typeof semesterId !== 'string') {
            throw new error_middleware_1.AppError('A course name (up to 120 characters) and semester ID are required.', 400);
        }
        // Verify semester belongs to user
        const semester = await db_1.prisma.semester.findFirst({
            where: { id: semesterId, userId }
        });
        if (!semester)
            throw new error_middleware_1.AppError('Semester not found or unauthorized', 404);
        const course = await db_1.prisma.course.create({
            data: {
                name: name.trim(),
                code: typeof code === 'string' ? code.trim() || null : null,
                creditHours: parseScaleValue(creditHours, 'Credit hours', 1, 10, 3),
                difficulty: parseScaleValue(difficulty, 'Difficulty', 1, 5, 3),
                priority: parseScaleValue(priority, 'Priority', 1, 5, 3),
                instructor: instructor || null,
                description: description || null,
                colorCode: colorCode || '#6366f1',
                semesterId,
            },
        });
        res.status(201).json({
            success: true,
            message: 'Course created successfully',
            data: { course },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createCourse = createCourse;
// 2. Get All Courses
const getCourses = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { semesterId } = req.query;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        const whereClause = { semester: { userId } };
        if (semesterId)
            whereClause.semesterId = semesterId;
        if (req.query.includeArchived !== 'true')
            whereClause.status = { not: 'ARCHIVED' };
        if (typeof req.query.q === 'string' && req.query.q.trim()) {
            const search = req.query.q.trim().slice(0, 100);
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { instructor: { contains: search, mode: 'insensitive' } },
            ];
        }
        const courses = await db_1.prisma.course.findMany({
            where: whereClause,
            include: {
                semester: { select: { name: true } },
                studyTasks: true,
                assignments: true,
            },
        });
        res.status(200).json({
            success: true,
            data: { courses },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getCourses = getCourses;
// 3. Get Course By ID
const getCourseById = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const course = await db_1.prisma.course.findFirst({
            where: {
                id,
                semester: { userId }
            },
            include: {
                semester: true,
                assignments: true,
                exams: true,
                studyTasks: { include: { sessions: { where: { scheduledEnd: { gte: new Date(Date.now() - 7 * 86_400_000) } }, orderBy: { scheduledStart: 'asc' } } } },
            },
        });
        if (!course)
            throw new error_middleware_1.AppError('Course not found', 404);
        res.status(200).json({
            success: true,
            data: { course },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getCourseById = getCourseById;
// 4. Update Course
const updateCourse = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { name, code, creditHours, difficulty, priority, status, instructor, description, colorCode } = req.body;
        if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 120)) {
            throw new error_middleware_1.AppError('Course name must be between 1 and 120 characters.', 400);
        }
        if (status !== undefined && !['ACTIVE', 'ARCHIVED'].includes(status))
            throw new error_middleware_1.AppError('Subject status must be ACTIVE or ARCHIVED.', 400);
        if (code !== undefined && (typeof code !== 'string' || code.length > 40))
            throw new error_middleware_1.AppError('Subject code must be 40 characters or fewer.', 400);
        if (instructor !== undefined && (typeof instructor !== 'string' || instructor.length > 120))
            throw new error_middleware_1.AppError('Instructor name must be 120 characters or fewer.', 400);
        if (description !== undefined && (typeof description !== 'string' || description.length > 5000))
            throw new error_middleware_1.AppError('Subject description must be 5,000 characters or fewer.', 400);
        const course = await db_1.prisma.course.findFirst({
            where: { id, semester: { userId } }
        });
        if (!course)
            throw new error_middleware_1.AppError('Course not found', 404);
        const updated = await db_1.prisma.$transaction(async (tx) => {
            const changedCourse = await tx.course.update({
                where: { id },
                data: {
                    ...(name !== undefined && { name: name.trim() }),
                    ...(code !== undefined && { code }),
                    ...(creditHours !== undefined && { creditHours: parseScaleValue(creditHours, 'Credit hours', 1, 10, 3) }),
                    ...(difficulty !== undefined && { difficulty: parseScaleValue(difficulty, 'Difficulty', 1, 5, 3) }),
                    ...(priority !== undefined && { priority: parseScaleValue(priority, 'Priority', 1, 5, 3) }),
                    ...(status && { status }),
                    ...(instructor !== undefined && { instructor }),
                    ...(description !== undefined && { description }),
                    ...(colorCode && { colorCode }),
                },
            });
            if (status === 'ARCHIVED') {
                await tx.studySession.updateMany({
                    where: { userId, status: 'SCHEDULED', scheduledEnd: { gt: new Date() }, task: { courseId: id } },
                    data: { status: 'CANCELLED' },
                });
            }
            return changedCourse;
        });
        res.status(200).json({
            success: true,
            message: 'Course updated successfully',
            data: { course: updated },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateCourse = updateCourse;
// 5. Delete Course
const deleteCourse = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const course = await db_1.prisma.course.findFirst({
            where: { id, semester: { userId } }
        });
        if (!course)
            throw new error_middleware_1.AppError('Course not found', 404);
        const [materials, assignments, exams, tasks] = await Promise.all([
            db_1.prisma.courseMaterial.count({ where: { courseId: id } }), db_1.prisma.assignment.count({ where: { courseId: id } }),
            db_1.prisma.exam.count({ where: { courseId: id } }), db_1.prisma.studyTask.count({ where: { courseId: id } }),
        ]);
        if (materials + assignments + exams + tasks > 0)
            throw new error_middleware_1.AppError('This subject has academic records. Archive it to preserve its materials, assignments, and study history.', 409);
        await db_1.prisma.course.delete({ where: { id } });
        res.status(200).json({
            success: true,
            message: 'Course deleted successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteCourse = deleteCourse;
