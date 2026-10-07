import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { comparePassword, hashPassword } from '../utils/password.util';
import { generateToken } from '../utils/jwt.util';
import { ENV } from '../config/env';
import { createHash, randomBytes } from 'crypto';
import { assertLoginAllowed, clearFailedLogins, consumeAuthAttempt, normalizeLoginEmail, recordFailedLogin } from '../services/auth-security.service';
import { sendPasswordResetEmail } from '../services/email.service';

const normalizeEmail = normalizeLoginEmail;
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const getSessionCookieOptions = (req: Request) => {
  const origin = req.headers.origin;
  let isCrossSite = false;
  if (origin) {
    try {
      const hostname = new URL(origin).hostname;
      isCrossSite = !['localhost', '127.0.0.1', '::1'].includes(hostname);
    } catch {
      isCrossSite = true;
    }
  }
  return {
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production' || isCrossSite,
    sameSite: isCrossSite ? 'none' as const : 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

// 1. Register User
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, fullName } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string') {
      throw new AppError('Full Name, Email, and Password are required.', 400);
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedName = fullName.trim();
    if (!isValidEmail(normalizedEmail)) throw new AppError('Enter a valid email address.', 400);
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      throw new AppError('Full name must be between 2 and 100 characters.', 400);
    }
    if (password.length < 8 || password.length > 128) {
      throw new AppError('Password must be between 8 and 128 characters.', 400);
    }

    if (!(await consumeAuthAttempt(normalizedEmail, req, 5, 20))) {
      res.setHeader('Retry-After', '900');
      throw new AppError('Too many account creation attempts. Please wait 15 minutes and try again.', 429);
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'This email already exists in our database.',
          code: 'EMAIL_EXISTS',
        },
      });
    }

    const hashedPassword = await hashPassword(password);
    const { newUser, authSession } = await prisma.$transaction(async (tx) => {
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

    const token = generateToken({ userId: newUser.id, email: newUser.email, role: 'STUDENT', sessionId: authSession.id });
    res.cookie('studyos_session', token, getSessionCookieOptions(req));

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        major: newUser.major,
        currentSemester: newUser.currentSemester,
        dailyGoalHours: newUser.dailyGoalHours,
        dailySessionMinutes: newUser.dailySessionMinutes,
        aiMode: newUser.aiMode,
        isOnboarded: newUser.isOnboarded,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Login User
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      throw new AppError('Email and password are required.', 400);
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail) || password.length > 128) {
      throw new AppError('Invalid email or password.', 401);
    }

    if (!(await consumeAuthAttempt(normalizedEmail, req, 10, 30))) {
      res.setHeader('Retry-After', '900');
      throw new AppError('Too many sign-in attempts. Please wait 15 minutes and try again.', 429);
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', 401);
    }
    await clearFailedLogins(normalizedEmail);

    const authSession = await prisma.authSession.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    const token = generateToken({ userId: user.id, email: user.email, role: 'STUDENT', sessionId: authSession.id });
    res.cookie('studyos_session', token, getSessionCookieOptions(req));

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        major: user.major,
        currentSemester: user.currentSemester,
        dailyGoalHours: user.dailyGoalHours,
        dailySessionMinutes: user.dailySessionMinutes,
        aiMode: user.aiMode,
        isOnboarded: user.isOnboarded,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';
    const throttleKey = isValidEmail(email) ? email : 'invalid-reset-address';
    if (!(await assertLoginAllowed(throttleKey, req))) {
      res.setHeader('Retry-After', '900');
      return res.status(429).json({ success: false, error: { message: 'Too many requests. Please wait 15 minutes and try again.' } });
    }
    await recordFailedLogin(throttleKey, req);
    if (!isValidEmail(email) || email.length > 254) {
      return res.status(200).json({ success: true, message: 'If an account matches that email, password reset instructions will be sent.' });
    }

    if (!ENV.RESEND_API_KEY || !ENV.RESET_EMAIL_FROM) {
      throw new AppError('Password reset email is not configured yet.', 503);
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, fullName: true } });
    if (user) {
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60_000);
      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
        await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
      });
      const resetUrl = new URL('/forgot-password', ENV.APP_BASE_URL);
      resetUrl.searchParams.set('token', rawToken);
      try {
        await sendPasswordResetEmail(user.email, user.fullName, resetUrl.toString());
      } catch {
        await prisma.passwordResetToken.deleteMany({ where: { tokenHash, usedAt: null } });
        return res.status(200).json({ success: true, message: 'If an account matches that email, password reset instructions will be sent.' });
      }
    }
    return res.status(200).json({ success: true, message: 'If an account matches that email, password reset instructions will be sent.' });
  } catch (error) { return next(error); }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.body?.token;
    const password = req.body?.password;
    if (typeof token !== 'string' || token.length < 32 || token.length > 128 || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      throw new AppError('Use a valid reset link and a password between 8 and 128 characters.', 400);
    }
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true },
    });
    if (!resetToken) throw new AppError('This reset link is invalid or expired. Request a new one.', 400);
    const hashedPassword = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({ where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (consumed.count !== 1) throw new AppError('This reset link is invalid or expired. Request a new one.', 400);
      await tx.user.update({ where: { id: resetToken.userId }, data: { password: hashedPassword } });
      await tx.authSession.updateMany({ where: { userId: resetToken.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.passwordResetToken.updateMany({ where: { userId: resetToken.userId, usedAt: null }, data: { usedAt: new Date() } });
    });
    return res.status(200).json({ success: true, message: 'Password updated. Please sign in with your new password.' });
  } catch (error) { return next(error); }
};

// 3. Get Current Authenticated User Profile
export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized access', 401);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        major: true,
        currentSemester: true,
        dailyGoalHours: true,
          dailySessionMinutes: true,
        aiMode: true,
        planType: true,
        isOnboarded: true,
      },
    });

    if (!user) throw new AppError('User profile not found', 404);

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.user?.sessionId;
    if (!userId || !sessionId) throw new AppError('Unauthorized access', 401);

    await prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const { maxAge: _maxAge, ...cookieOptions } = getSessionCookieOptions(req);
    res.clearCookie('studyos_session', cookieOptions);
    res.status(200).json({ success: true, message: 'Signed out successfully.' });
  } catch (error) {
    next(error);
  }
};
