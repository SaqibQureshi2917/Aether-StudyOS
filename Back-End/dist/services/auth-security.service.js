"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLoginEmail = normalizeLoginEmail;
exports.assertLoginAllowed = assertLoginAllowed;
exports.recordFailedLogin = recordFailedLogin;
exports.clearFailedLogins = clearFailedLogins;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const env_1 = require("../config/env");
const WINDOW_MS = 15 * 60_000;
const EMAIL_LIMIT = 10;
const IP_LIMIT = 30;
let cleanupCounter = 0;
function hash(value) {
    return (0, crypto_1.createHmac)('sha256', env_1.ENV.JWT_SECRET).update(value).digest('hex');
}
function normalizeLoginEmail(email) {
    return email.trim().toLowerCase();
}
async function assertLoginAllowed(email, req) {
    const emailHash = hash(normalizeLoginEmail(email));
    const ipHash = hash(req.ip || req.socket.remoteAddress || 'unknown');
    const since = new Date(Date.now() - WINDOW_MS);
    const [emailCount, ipCount] = await Promise.all([
        db_1.prisma.authLoginAttempt.count({ where: { emailHash, createdAt: { gte: since } } }),
        db_1.prisma.authLoginAttempt.count({ where: { ipHash, createdAt: { gte: since } } }),
    ]);
    if (emailCount >= EMAIL_LIMIT || ipCount >= IP_LIMIT)
        return false;
    if (cleanupCounter++ % 100 === 0) {
        void db_1.prisma.authLoginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } } }).catch(() => undefined);
    }
    return true;
}
async function recordFailedLogin(email, req) {
    await db_1.prisma.authLoginAttempt.create({
        data: {
            emailHash: hash(normalizeLoginEmail(email)),
            ipHash: hash(req.ip || req.socket.remoteAddress || 'unknown'),
        },
    });
}
async function clearFailedLogins(email) {
    await db_1.prisma.authLoginAttempt.deleteMany({ where: { emailHash: hash(normalizeLoginEmail(email)) } });
}
