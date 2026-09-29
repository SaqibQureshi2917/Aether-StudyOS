"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSemester = exports.updateSemester = exports.createSemester = exports.getSemesters = void 0;
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
const parseSemesterDates = (start, end) => {
    if (typeof start !== 'string') {
        throw new error_middleware_1.AppError('Semester start date is required.', 400);
    }
    const startDate = new Date(start);
    const endDate = typeof end === 'string' && end ? new Date(end) : null;
    if (!Number.isFinite(startDate.getTime()) || (endDate && (!Number.isFinite(endDate.getTime()) || endDate <= startDate))) {
        throw new error_middleware_1.AppError('Semester dates are invalid. The end date must follow the start date.', 400);
    }
    return { startDate, endDate };
};
const validStatuses = ['ACTIVE', 'COMPLETED', 'PLANNED'];
const getSemesters = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        const semesters = await db_1.prisma.semester.findMany({
            where: { userId },
            include: { _count: { select: { courses: true } } },
            orderBy: { startDate: 'desc' },
        });
        res.status(200).json({ success: true, data: { semesters } });
    }
    catch (error) {
        next(error);
    }
};
exports.getSemesters = getSemesters;
const createSemester = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { name, status = 'PLANNED' } = req.body;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
            throw new error_middleware_1.AppError('Semester name must be between 1 and 100 characters.', 400);
        }
        if (!validStatuses.includes(status))
            throw new error_middleware_1.AppError('Semester status is invalid.', 400);
        const { startDate, endDate } = parseSemesterDates(req.body.startDate, req.body.endDate);
        const semester = await db_1.prisma.$transaction(async (tx) => {
            if (status === 'ACTIVE') {
                const activeSemester = await tx.semester.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } });
                if (activeSemester)
                    throw new error_middleware_1.AppError('Complete the active semester before activating another.', 409);
            }
            return tx.semester.create({ data: { userId, name: name.trim(), startDate, endDate, status } });
        }, { isolationLevel: 'Serializable' });
        res.status(201).json({ success: true, data: { semester } });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
            return next(new error_middleware_1.AppError('Semester state changed at the same time. Refresh and try again.', 409));
        }
        next(error);
    }
};
exports.createSemester = createSemester;
const updateSemester = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { name, status } = req.body;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        const existing = await db_1.prisma.semester.findFirst({ where: { id, userId } });
        if (!existing)
            throw new error_middleware_1.AppError('Semester not found.', 404);
        if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 100)) {
            throw new error_middleware_1.AppError('Semester name must be between 1 and 100 characters.', 400);
        }
        if (status !== undefined && !validStatuses.includes(status))
            throw new error_middleware_1.AppError('Semester status is invalid.', 400);
        const dates = req.body.startDate !== undefined || req.body.endDate !== undefined
            ? parseSemesterDates(req.body.startDate ?? existing.startDate.toISOString(), req.body.endDate === undefined ? (existing.endDate?.toISOString() ?? '') : req.body.endDate)
            : undefined;
        const updated = await db_1.prisma.$transaction(async (tx) => {
            if (status === 'ACTIVE' && existing.status !== 'ACTIVE') {
                const activeSemester = await tx.semester.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } });
                if (activeSemester && activeSemester.id !== id) {
                    throw new error_middleware_1.AppError('Complete the active semester before activating another.', 409);
                }
            }
            return tx.semester.update({
                where: { id },
                data: {
                    ...(name !== undefined && { name: name.trim() }),
                    ...(status !== undefined && { status }),
                    ...(dates || {}),
                },
            });
        }, { isolationLevel: 'Serializable' });
        res.status(200).json({ success: true, data: { semester: updated } });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
            return next(new error_middleware_1.AppError('Semester state changed at the same time. Refresh and try again.', 409));
        }
        next(error);
    }
};
exports.updateSemester = updateSemester;
const deleteSemester = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        const semester = await db_1.prisma.semester.findFirst({ where: { id, userId }, select: { id: true } });
        if (!semester)
            throw new error_middleware_1.AppError('Semester not found.', 404);
        const courseCount = await db_1.prisma.course.count({ where: { semesterId: id } });
        if (courseCount > 0)
            throw new error_middleware_1.AppError('This semester still has subjects. Archive or delete empty subjects first; academic records are never cascaded by semester deletion.', 409);
        await db_1.prisma.semester.delete({ where: { id } });
        res.status(200).json({ success: true, message: 'Semester deleted.' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteSemester = deleteSemester;
