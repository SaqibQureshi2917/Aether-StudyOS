"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dismissRecommendation = exports.acceptRecommendation = void 0;
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
async function setRecommendationStatus(req, res, next, status) {
    try {
        const userId = req.user?.userId;
        if (!userId)
            throw new error_middleware_1.AppError('Your session has expired. Sign in and try again.', 401);
        const result = await db_1.prisma.plannerRecommendation.updateMany({
            where: { id: req.params.recommendationId, userId, status: 'PENDING' },
            data: { status },
        });
        if (result.count !== 1)
            throw new error_middleware_1.AppError('This recommendation is no longer available.', 404);
        return res.status(200).json({
            success: true,
            data: {
                status,
                message: status === 'ACCEPTED'
                    ? 'Recommendation accepted. Review a fresh schedule proposal to decide whether to change your sessions.'
                    : 'Recommendation dismissed.',
            },
        });
    }
    catch (error) {
        return next(error);
    }
}
const acceptRecommendation = (req, res, next) => setRecommendationStatus(req, res, next, 'ACCEPTED');
exports.acceptRecommendation = acceptRecommendation;
const dismissRecommendation = (req, res, next) => setRecommendationStatus(req, res, next, 'DISMISSED');
exports.dismissRecommendation = dismissRecommendation;
