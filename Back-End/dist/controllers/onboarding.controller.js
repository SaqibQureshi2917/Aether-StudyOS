"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeOnboarding = void 0;
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
const completeOnboarding = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { major, currentSemester, dailyGoalHours, aiMode } = req.body;
        if (!userId) {
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        }
        // Update user profile and set isOnboarded to true
        const updatedUser = await db_1.prisma.user.update({
            where: { id: userId },
            data: {
                major: major || null,
                currentSemester: currentSemester || null,
                dailyGoalHours: dailyGoalHours ? parseFloat(dailyGoalHours) : 3.0,
                aiMode: aiMode || 'BALANCED',
                isOnboarded: true,
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                major: true,
                currentSemester: true,
                dailyGoalHours: true,
                aiMode: true,
                isOnboarded: true,
            },
        });
        res.status(200).json({
            success: true,
            message: 'Onboarding completed successfully!',
            data: { user: updatedUser },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.completeOnboarding = completeOnboarding;
