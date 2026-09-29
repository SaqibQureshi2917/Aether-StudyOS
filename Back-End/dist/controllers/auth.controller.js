"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.getMe = exports.login = exports.register = void 0;
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
const password_util_1 = require("../utils/password.util");
const jwt_util_1 = require("../utils/jwt.util");
const env_1 = require("../config/env");
const normalizeEmail = (email) => email.trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isTrustedCrossSiteRequest = (req) => {
    const origin = req.headers.origin;
    if (!origin || !env_1.ENV.CORS_ORIGINS.includes(origin))
        return false;
    try {
        return !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname);
    }
    catch {
        return false;
    }
};
const getSessionCookieOptions = (req) => {
    const origin = req.headers.origin;
    let isCrossSite = false;
    if (origin) {
        try {
            const hostname = new URL(origin).hostname;
            isCrossSite = !['localhost', '127.0.0.1', '::1'].includes(hostname);
        }
        catch {
            isCrossSite = true;
        }
    }
    return {
        httpOnly: true,
        secure: env_1.ENV.NODE_ENV === 'production' || isCrossSite,
        sameSite: isCrossSite ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };
};
// 1. Register User
const register = async (req, res, next) => {
    try {
        const { email, password, fullName } = req.body;
        if (typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string') {
            throw new error_middleware_1.AppError('Full Name, Email, and Password are required.', 400);
        }
        const normalizedEmail = normalizeEmail(email);
        const normalizedName = fullName.trim();
        if (!isValidEmail(normalizedEmail))
            throw new error_middleware_1.AppError('Enter a valid email address.', 400);
        if (normalizedName.length < 2 || normalizedName.length > 100) {
            throw new error_middleware_1.AppError('Full name must be between 2 and 100 characters.', 400);
        }
        if (password.length < 8 || password.length > 128) {
            throw new error_middleware_1.AppError('Password must be between 8 and 128 characters.', 400);
        }
        const existingUser = await db_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: {
                    message: 'This email already exists in our database.',
                    code: 'EMAIL_EXISTS',
                },
            });
        }
        const hashedPassword = await (0, password_util_1.hashPassword)(password);
        const { newUser, authSession } = await db_1.prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    email: normalizedEmail,
                    password: hashedPassword,
                    fullName: normalizedName,
                },
            });
            const session = await tx.authSession.create({
                data: { userId: createdUser.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
            });
            return { newUser: createdUser, authSession: session };
        });
        const token = (0, jwt_util_1.generateToken)({ userId: newUser.id, email: newUser.email, role: 'STUDENT', sessionId: authSession.id });
        res.cookie('studyos_session', token, getSessionCookieOptions(req));
        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            ...(isTrustedCrossSiteRequest(req) ? { token } : {}),
            user: {
                id: newUser.id,
                fullName: newUser.fullName,
                email: newUser.email,
                major: newUser.major,
                currentSemester: newUser.currentSemester,
                dailyGoalHours: newUser.dailyGoalHours,
                aiMode: newUser.aiMode,
                isOnboarded: newUser.isOnboarded,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
// 2. Login User
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
            throw new error_middleware_1.AppError('Email and password are required.', 400);
        }
        const normalizedEmail = normalizeEmail(email);
        if (!isValidEmail(normalizedEmail) || password.length > 128) {
            throw new error_middleware_1.AppError('Invalid email or password.', 401);
        }
        const user = await db_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user)
            throw new error_middleware_1.AppError('Invalid email or password.', 401);
        const isPasswordValid = await (0, password_util_1.comparePassword)(password, user.password);
        if (!isPasswordValid)
            throw new error_middleware_1.AppError('Invalid email or password.', 401);
        const authSession = await db_1.prisma.authSession.create({
            data: { userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        });
        const token = (0, jwt_util_1.generateToken)({ userId: user.id, email: user.email, role: 'STUDENT', sessionId: authSession.id });
        res.cookie('studyos_session', token, getSessionCookieOptions(req));
        res.status(200).json({
            success: true,
            message: 'Login successful!',
            ...(isTrustedCrossSiteRequest(req) ? { token } : {}),
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                major: user.major,
                currentSemester: user.currentSemester,
                dailyGoalHours: user.dailyGoalHours,
                aiMode: user.aiMode,
                isOnboarded: user.isOnboarded,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
// 3. Get Current Authenticated User Profile
const getMe = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
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
        if (!user)
            throw new error_middleware_1.AppError('User profile not found', 404);
        res.status(200).json({
            success: true,
            data: { user },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMe = getMe;
const logout = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const sessionId = req.user?.sessionId;
        if (!userId || !sessionId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        await db_1.prisma.authSession.updateMany({
            where: { id: sessionId, userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        const { maxAge: _maxAge, ...cookieOptions } = getSessionCookieOptions(req);
        res.clearCookie('studyos_session', cookieOptions);
        res.status(200).json({ success: true, message: 'Signed out successfully.' });
    }
    catch (error) {
        next(error);
    }
};
exports.logout = logout;
