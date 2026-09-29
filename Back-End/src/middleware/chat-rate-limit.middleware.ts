import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { AppError } from './error.middleware';

const WINDOW_MS = 60_000;
const MAX_MESSAGES_PER_WINDOW = 12;
const requestsByUser = new Map<string, number[]>();
let lastCleanupAt = 0;

export function limitChatRequests(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const userId = req.user?.userId;
  if (!userId) return next(new AppError('Your session has expired. Sign in and try again.', 401));

  const now = Date.now();
  const recentRequests = (requestsByUser.get(userId) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recentRequests.length >= MAX_MESSAGES_PER_WINDOW) {
    return next(new AppError('You have sent several messages in a short time. Wait a minute and try again.', 429));
  }
  recentRequests.push(now);
  requestsByUser.set(userId, recentRequests);

  if (now - lastCleanupAt > WINDOW_MS) {
    for (const [key, timestamps] of requestsByUser) {
      const activeTimestamps = timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);
      if (activeTimestamps.length) requestsByUser.set(key, activeTimestamps);
      else requestsByUser.delete(key);
    }
    lastCleanupAt = now;
  }
  return next();
}
