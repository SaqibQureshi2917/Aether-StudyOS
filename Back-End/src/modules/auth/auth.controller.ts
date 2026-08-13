import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/db';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash, fullName: fullName || null },
    });

    const secret = process.env.JWT_SECRET || 'default-secret';
    const token = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: '7d' });

    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, isOnboarded: user.isOnboarded },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error during registration.' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({
        error: 'No account found with this email. Please sign up first.',
        code: 'USER_NOT_FOUND',
      });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Incorrect password. Please try again.',
        code: 'INVALID_PASSWORD',
      });
    }

    const secret = process.env.JWT_SECRET || 'default-secret';
    const token = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: '7d' });

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        major: user.major,
        semester: user.semester,
        isOnboarded: user.isOnboarded,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error during login.' });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized. Invalid session.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        major: true,
        semester: true,
        isOnboarded: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User session not found.' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify authentication session.' });
  }
};