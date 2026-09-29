import { createHmac } from 'crypto';
import { Request } from 'express';
import { prisma } from '../config/db';
import { ENV } from '../config/env';

const WINDOW_MS = 15 * 60_000;
const EMAIL_LIMIT = 10;
const IP_LIMIT = 30;
let cleanupCounter = 0;

function hash(value: string) {
  return createHmac('sha256', ENV.JWT_SECRET).update(value).digest('hex');
}

export function normalizeLoginEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function assertLoginAllowed(email: string, req: Request) {
  const emailHash = hash(normalizeLoginEmail(email));
  const ipHash = hash(req.ip || req.socket.remoteAddress || 'unknown');
  const since = new Date(Date.now() - WINDOW_MS);
  const [emailCount, ipCount] = await Promise.all([
    prisma.authLoginAttempt.count({ where: { emailHash, createdAt: { gte: since } } }),
    prisma.authLoginAttempt.count({ where: { ipHash, createdAt: { gte: since } } }),
  ]);
  if (emailCount >= EMAIL_LIMIT || ipCount >= IP_LIMIT) return false;
  if (cleanupCounter++ % 100 === 0) {
    void prisma.authLoginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } } }).catch(() => undefined);
  }
  return true;
}

export async function recordFailedLogin(email: string, req: Request) {
  await prisma.authLoginAttempt.create({
    data: {
      emailHash: hash(normalizeLoginEmail(email)),
      ipHash: hash(req.ip || req.socket.remoteAddress || 'unknown'),
    },
  });
}

export async function clearFailedLogins(email: string) {
  await prisma.authLoginAttempt.deleteMany({ where: { emailHash: hash(normalizeLoginEmail(email)) } });
}
