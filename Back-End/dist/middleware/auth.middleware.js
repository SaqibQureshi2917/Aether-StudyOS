"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jwt_util_1 = require("../utils/jwt.util");
const error_middleware_1 = require("./error.middleware");
const db_1 = require("../config/db");
const env_1 = require("../config/env");
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const cookieToken = req.headers.cookie
        ?.split(';')
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith('studyos_session='))
        ?.slice('studyos_session='.length);
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
    const token = bearerToken || cookieToken;
    if (!token)
        return next(new error_middleware_1.AppError('Unauthorized access', 401));
    const isStateChangingRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (cookieToken && isStateChangingRequest && !env_1.ENV.CORS_ORIGINS.includes(req.headers.origin || '')) {
        return next(new error_middleware_1.AppError('Request origin is not allowed.', 403));
    }
    try {
        const payload = (0, jwt_util_1.verifyToken)(token);
        if (!payload.sessionId)
            throw new error_middleware_1.AppError('Invalid or expired token', 401);
        const session = await db_1.prisma.authSession.findFirst({
            where: {
                id: payload.sessionId,
                userId: payload.userId,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
            select: { id: true },
        });
        if (!session)
            throw new error_middleware_1.AppError('Invalid or expired token', 401);
        req.user = payload;
        next();
    }
    catch (error) {
        return next(error instanceof error_middleware_1.AppError ? error : new error_middleware_1.AppError('Invalid or expired token', 401));
    }
};
exports.authenticate = authenticate;
