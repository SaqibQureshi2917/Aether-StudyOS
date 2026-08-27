import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt.util';
import { AppError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized access', 401));
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return next(new AppError('Invalid token', 401));
  }
};