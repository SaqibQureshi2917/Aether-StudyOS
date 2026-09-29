"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.getMe = exports.resetPassword = exports.requestPasswordReset = exports.login = exports.register = void 0;
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
const password_util_1 = require("../utils/password.util");
const jwt_util_1 = require("../utils/jwt.util");
const env_1 = require("../config/env");
const crypto_1 = require("crypto");
const auth_security_service_1 = require("../services/auth-security.service");
const email_service_1 = require("../services/email.service");
const normalizeEmail = auth_security_service_1.normalizeLoginEmail;
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
        if (!(await (0, auth_security_service_1.assertLoginAllowed)(normalizedEmail, req))) {
            res.setHeader('Retry-After', '900');
            throw new error_middleware_1.AppError('Too many sign-in attempts. Please wait 15 minutes and try again.', 429);
        }
        const user = await db_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) {
            await (0, auth_security_service_1.recordFailedLogin)(normalizedEmail, req);
            throw new error_middleware_1.AppError('Invalid email or password.', 401);
        }
        const isPasswordValid = await (0, password_util_1.comparePassword)(password, user.password);
        if (!isPasswordValid) {
            await (0, auth_security_service_1.recordFailedLogin)(normalizedEmail, req);
            throw new error_middleware_1.AppError('Invalid email or password.', 401);
        }
        await (0, auth_security_service_1.clearFailedLogins)(normalizedEmail);
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
const requestPasswordReset = async (req, res, next) => {
    try {
        const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';
        const throttleKey = isValidEmail(email) ? email : 'invalid-reset-address';
        if (!(await (0, auth_security_service_1.assertLoginAllowed)(throttleKey, req))) {
            res.setHeader('Retry-After', '900');
            return res.status(429).json({ success: false, error: { message: 'Too many requests. Please wait 15 minutes and try again.' } });
        }
        await (0, auth_security_service_1.recordFailedLogin)(throttleKey, req);
        if (!isValidEmail(email) || email.length > 254) {
            return res.status(200).json({ success: true, message: 'If an account matches that email, password reset instructions will be sent.' });
        }
        if (!env_1.ENV.RESEND_API_KEY || !env_1.ENV.RESET_EMAIL_FROM) {
            throw new error_middleware_1.AppError('Password reset email is not configured yet.', 503);
        }
        const user = await db_1.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, fullName: true } });
        if (user) {
            const rawToken = (0, crypto_1.randomBytes)(32).toString('base64url');
            const tokenHash = (0, crypto_1.createHash)('sha256').update(rawToken).digest('hex');
            const expiresAt = new Date(Date.now() + 30 * 60_000);
            await db_1.prisma.$transaction(async (tx) => {
                await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
                await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
            });
            const resetUrl = new URL('/forgot-password', env_1.ENV.APP_BASE_URL);
            resetUrl.searchParams.set('token', rawToken);
            try {
                await (0, email_service_1.sendPasswordResetEmail)(user.email, user.fullName, resetUrl.toString());
            }
            catch {
                await db_1.prisma.passwordResetToken.deleteMany({ where: { tokenHash, usedAt: null } });
                return res.status(200).json({ success: true, message: 'If an account matches that email, password reset instructions will be sent.' });
            }
        }
        return res.status(200).json({ success: true, message: 'If an account matches that email, password reset instructions will be sent.' });
    }
    catch (error) {
        return next(error);
    }
};
exports.requestPasswordReset = requestPasswordReset;
const resetPassword = async (req, res, next) => {
    try {
        const token = req.body?.token;
        const password = req.body?.password;
        if (typeof token !== 'string' || token.length < 32 || token.length > 128 || typeof password !== 'string' || password.length < 8 || password.length > 128) {
            throw new error_middleware_1.AppError('Use a valid reset link and a password between 8 and 128 characters.', 400);
        }
        const tokenHash = (0, crypto_1.createHash)('sha256').update(token).digest('hex');
        const resetToken = await db_1.prisma.passwordResetToken.findFirst({
            where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
            select: { id: true, userId: true },
        });
        if (!resetToken)
            throw new error_middleware_1.AppError('This reset link is invalid or expired. Request a new one.', 400);
        const hashedPassword = await (0, password_util_1.hashPassword)(password);
        await db_1.prisma.$transaction(async (tx) => {
            const consumed = await tx.passwordResetToken.updateMany({ where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
            if (consumed.count !== 1)
                throw new error_middleware_1.AppError('This reset link is invalid or expired. Request a new one.', 400);
            await tx.user.update({ where: { id: resetToken.userId }, data: { password: hashedPassword } });
            await tx.authSession.updateMany({ where: { userId: resetToken.userId, revokedAt: null }, data: { revokedAt: new Date() } });
            await tx.passwordResetToken.updateMany({ where: { userId: resetToken.userId, usedAt: null }, data: { usedAt: new Date() } });
        });
        return res.status(200).json({ success: true, message: 'Password updated. Please sign in with your new password.' });
    }
    catch (error) {
        return next(error);
    }
};
exports.resetPassword = resetPassword;
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
