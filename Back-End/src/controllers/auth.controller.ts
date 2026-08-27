import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// 1. Register User
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      throw new AppError('Full Name, Email, and Password are required.', 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'This email already exists in our database.',
          code: 'EMAIL_EXISTS',
        },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        fullName: fullName.trim(),
      },
    });

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
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

    if (!email || !password) {
      throw new AppError('Email and password are required.', 400);
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Account not found in our database. Please create an account first.',
          code: 'USER_NOT_FOUND',
        },
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Incorrect password. Please double-check your credentials.',
          code: 'INVALID_PASSWORD',
        },
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        major: user.major,
        currentSemester: user.currentSemester,
        isOnboarded: user.isOnboarded,
      },
    });
  } catch (error) {
    next(error);
  }
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