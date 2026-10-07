import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt.util';
import { AppError } from './error.middleware';
import { prisma } from '../config/db';
import { ENV } from '../config/env';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const cookieToken = req.headers.cookie
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('studyos_session='))
    ?.slice('studyos_session='.length);
  const token = cookieToken;
  if (!token) return next(new AppError('Unauthorized access', 401));
  const isStateChangingRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (isStateChangingRequest && (!req.headers.origin || !ENV.CORS_ORIGINS.includes(req.headers.origin))) {
    return next(new AppError('Request origin is not allowed.', 403));
  }
  try {
    const payload = verifyToken(token);
    if (!payload.sessionId) throw new AppError('Invalid or expired token', 401);
    const session = await prisma.authSession.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) throw new AppError('Invalid or expired token', 401);
    req.user = payload;
    next();
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError('Invalid or expired token', 401));
  }
};
