"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renameConversationSchema = exports.chatSchema = void 0;
// backend/src/modules/chat/chat.validation.ts
const zod_1 = require("zod");
exports.chatSchema = zod_1.z.object({
    message: zod_1.z.string().trim().min(1, 'Enter a message.').max(4000, 'Messages must be 4,000 characters or fewer.'),
    conversationId: zod_1.z.string().uuid().optional(),
    mode: zod_1.z.enum(['GENERAL', 'STUDY']).default('GENERAL'),
    courseId: zod_1.z.string().uuid().optional(),
});
exports.renameConversationSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1, 'Enter a conversation name.').max(80, 'Conversation names must be 80 characters or fewer.'),
});
