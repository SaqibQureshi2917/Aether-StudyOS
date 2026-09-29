"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserProfile = exports.onboardUser = void 0;
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
const onboardUser = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { major, semester, semesterStartDate, semesterEndDate, studyGoalHours, aiMode } = req.body;
        const rawCourses = req.body.courses ?? [];
        if (!userId) {
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        }
        if (typeof major !== 'string' || typeof semester !== 'string') {
            throw new error_middleware_1.AppError('Major and semester must be text values.', 400);
        }
        const normalizedMajor = major.trim();
        const normalizedSemester = semester.trim();
        if (normalizedMajor.length > 120 || normalizedSemester.length > 100) {
            throw new error_middleware_1.AppError('Major or semester name is too long.', 400);
        }
        if (!Array.isArray(rawCourses) || rawCourses.length > 30 || rawCourses.some((course) => typeof course !== 'string')) {
            throw new error_middleware_1.AppError('Courses must be a list of up to 30 course names.', 400);
        }
        const courseNames = [...new Map(rawCourses.map((name) => [name.trim().toLocaleLowerCase(), name.trim()])).values()];
        if (courseNames.some((name) => name.length < 1 || name.length > 120)) {
            throw new error_middleware_1.AppError('Each course name must be between 1 and 120 characters.', 400);
        }
        let semesterDates;
        if (courseNames.length > 0) {
            if (typeof semesterStartDate !== 'string') {
                throw new error_middleware_1.AppError('Semester start date is required when adding subjects.', 400);
            }
            const startDate = new Date(semesterStartDate);
            const endDate = typeof semesterEndDate === 'string' && semesterEndDate ? new Date(semesterEndDate) : null;
            if (!Number.isFinite(startDate.getTime()) || (endDate && (!Number.isFinite(endDate.getTime()) || endDate <= startDate))) {
                throw new error_middleware_1.AppError('Semester dates are invalid. The end date must follow the start date.', 400);
            }
            semesterDates = { startDate, endDate };
        }
        if (aiMode !== undefined && !['balanced', 'rigorous', 'exam_prep'].includes(aiMode)) {
            throw new error_middleware_1.AppError('AI mode is invalid.', 400);
        }
        const goalHours = studyGoalHours === undefined ? 3 : Number(studyGoalHours);
        if (!Number.isFinite(goalHours) || goalHours < 7 / 60 || goalHours > 24) {
            throw new error_middleware_1.AppError('Study goal must be between 7 minutes and 24 hours per day.', 400);
        }
        const currentUser = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, fullName: true, email: true, major: true, currentSemester: true, dailyGoalHours: true, aiMode: true, isOnboarded: true },
        });
        if (!currentUser)
            throw new error_middleware_1.AppError('User profile not found.', 404);
        if (currentUser.isOnboarded) {
            return res.status(200).json({ success: true, message: 'Onboarding is already complete.', data: { user: currentUser } });
        }
        const { user: updatedUser, courses: savedCourses } = await db_1.prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id: userId },
                data: {
                    major: normalizedMajor || null,
                    currentSemester: normalizedSemester || null,
                    dailyGoalHours: goalHours,
                    aiMode: aiMode?.toUpperCase() || 'BALANCED',
                    isOnboarded: true,
                },
                select: { id: true, fullName: true, email: true, major: true, currentSemester: true, dailyGoalHours: true, aiMode: true, isOnboarded: true },
            });
            const courses = [];
            if (semesterDates && courseNames.length > 0) {
                const existingSemester = await tx.semester.findFirst({
                    where: { userId, name: normalizedSemester, status: 'ACTIVE' },
                    select: { id: true },
                });
                const targetSemester = existingSemester
                    ? await tx.semester.update({ where: { id: existingSemester.id }, data: semesterDates, select: { id: true } })
                    : await tx.semester.create({
                        data: { userId, name: normalizedSemester, ...semesterDates, status: 'ACTIVE' },
                        select: { id: true },
                    });
                const existingCourses = await tx.course.findMany({
                    where: { semesterId: targetSemester.id },
                    select: { id: true, name: true },
                });
                const coursesByName = new Map(existingCourses.map((course) => [course.name.trim().toLocaleLowerCase(), course]));
                for (const name of courseNames) {
                    const normalizedName = name.toLocaleLowerCase();
                    let course = coursesByName.get(normalizedName);
                    if (!course) {
                        course = await tx.course.create({
                            data: { semesterId: targetSemester.id, name },
                            select: { id: true, name: true },
                        });
                        coursesByName.set(normalizedName, course);
                    }
                    courses.push(course);
                }
            }
            return { user, courses };
        });
        res.status(200).json({
            success: true,
            message: 'Onboarding data saved',
            data: { user: updatedUser, courses: savedCourses },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.onboardUser = onboardUser;
const updateUserProfile = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        const { fullName, major, currentSemester, dailyGoalHours, aiMode } = req.body;
        if (typeof fullName !== 'string' || typeof major !== 'string' || typeof currentSemester !== 'string') {
            throw new error_middleware_1.AppError('Name, major, and semester must be text values.', 400);
        }
        const normalizedName = fullName.trim();
        const normalizedMajor = major.trim();
        const normalizedSemester = currentSemester.trim();
        const goalHours = Number(dailyGoalHours);
        if (normalizedName.length < 2 || normalizedName.length > 100) {
            throw new error_middleware_1.AppError('Full name must be between 2 and 100 characters.', 400);
        }
        if (normalizedMajor.length > 120 || normalizedSemester.length > 100) {
            throw new error_middleware_1.AppError('Major or semester name is too long.', 400);
        }
        if (!Number.isFinite(goalHours) || goalHours < 7 / 60 || goalHours > 24) {
            throw new error_middleware_1.AppError('Study goal must be between 7 minutes and 24 hours per day.', 400);
        }
        if (!['balanced', 'rigorous', 'exam_prep'].includes(aiMode)) {
            throw new error_middleware_1.AppError('AI mode is invalid.', 400);
        }
        const updatedUser = await db_1.prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id: userId },
                data: {
                    fullName: normalizedName,
                    major: normalizedMajor || null,
                    currentSemester: normalizedSemester || null,
                    dailyGoalHours: goalHours,
                    aiMode: aiMode.toUpperCase(),
                },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    major: true,
                    currentSemester: true,
                    dailyGoalHours: true,
                    aiMode: true,
                    planType: true,
                    isOnboarded: true,
                },
            });
            const activeSemester = await tx.semester.findFirst({ where: { userId, status: 'ACTIVE' } });
            if (activeSemester && normalizedSemester) {
                await tx.semester.update({ where: { id: activeSemester.id }, data: { name: normalizedSemester } });
            }
            return user;
        });
        res.status(200).json({ success: true, data: { user: updatedUser } });
    }
    catch (error) {
        next(error);
    }
};
exports.updateUserProfile = updateUserProfile;
