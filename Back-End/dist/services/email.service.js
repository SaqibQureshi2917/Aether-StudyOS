"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const env_1 = require("../config/env");
async function sendPasswordResetEmail(email, name, resetUrl) {
    if (!env_1.ENV.RESEND_API_KEY || !env_1.ENV.RESET_EMAIL_FROM) {
        throw new Error('Password reset email is not configured. Set RESEND_API_KEY and RESET_EMAIL_FROM.');
    }
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env_1.ENV.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: env_1.ENV.RESET_EMAIL_FROM,
            to: [email],
            subject: 'Reset your Aether StudyOS password',
            text: `Hi ${name},\n\nUse this one-time link to choose a new password. It expires in 30 minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
            html: `<p>Hi ${escapeHtml(name)},</p><p>Use this one-time link to choose a new password. It expires in 30 minutes:</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
        }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
        throw new Error(`Password reset email provider returned ${response.status}.`);
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
