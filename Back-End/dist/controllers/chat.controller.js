"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChatRequest = handleChatRequest;
exports.getConversationThreads = getConversationThreads;
exports.createConversation = createConversation;
exports.getConversation = getConversation;
exports.renameConversation = renameConversation;
exports.deleteConversation = deleteConversation;
exports.regenerateConversationReply = regenerateConversationReply;
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
const ai_provider_interface_1 = require("../services/ai/ai-provider.interface");
const chat_service_1 = require("../services/chat/chat.service");
const chat_attachment_service_1 = require("../services/chat/chat-attachment.service");
const chat_validation_1 = require("../validations/chat.validation");
function requireUserId(req) {
    const userId = req.user?.userId;
    if (!userId)
        throw new error_middleware_1.AppError('Your session has expired. Sign in and try again.', 401);
    return userId;
}
async function handleChatRequest(req, res, next) {
    try {
        const parsed = chat_validation_1.chatSchema.safeParse({
            ...req.body,
            ...(req.body.courseId ? { courseId: req.body.courseId } : {}),
        });
        if (!parsed.success)
            throw new error_middleware_1.AppError(parsed.error.issues[0]?.message || 'Check your message and try again.', 400);
        const attachment = req.file ? await (0, chat_attachment_service_1.parseChatAttachment)(req.file) : undefined;
        const data = await (0, chat_service_1.processChatMessage)(requireUserId(req), { ...parsed.data, attachment });
        return res.status(200).json({ success: true, data });
    }
    catch (error) {
        if (error instanceof ai_provider_interface_1.AIProviderError)
            return next(new error_middleware_1.AppError('The AI tutor is temporarily unavailable. Please try again shortly.', 503));
        return next(error);
    }
}
async function getConversationThreads(req, res, next) {
    try {
        const threads = await db_1.prisma.conversation.findMany({
            where: { userId: requireUserId(req) },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                title: true,
                createdAt: true,
                updatedAt: true,
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { content: true, sender: true, createdAt: true },
                },
            },
        });
        return res.status(200).json({ success: true, data: { threads } });
    }
    catch (error) {
        return next(error);
    }
}
async function createConversation(req, res, next) {
    try {
        const conversation = await db_1.prisma.conversation.create({
            data: { userId: requireUserId(req), title: 'New Chat' },
            select: { id: true, title: true, createdAt: true, updatedAt: true },
        });
        return res.status(201).json({ success: true, data: { conversation } });
    }
    catch (error) {
        return next(error);
    }
}
async function getConversation(req, res, next) {
    try {
        const userId = requireUserId(req);
        const conversation = await db_1.prisma.conversation.findFirst({
            where: { id: req.params.conversationId, userId },
            select: { id: true, title: true, createdAt: true, updatedAt: true },
        });
        if (!conversation)
            throw new error_middleware_1.AppError('This conversation could not be found.', 404);
        const messages = await db_1.prisma.chatMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 100,
            include: { citations: { select: { id: true, documentId: true, fileName: true, pageNumber: true, chunkId: true } } },
        });
        return res.status(200).json({ success: true, data: { conversation: { ...conversation, messages } } });
    }
    catch (error) {
        return next(error);
    }
}
async function renameConversation(req, res, next) {
    try {
        const userId = requireUserId(req);
        const parsed = chat_validation_1.renameConversationSchema.safeParse(req.body);
        if (!parsed.success)
            throw new error_middleware_1.AppError(parsed.error.issues[0]?.message || 'Enter a valid conversation name.', 400);
        const existing = await db_1.prisma.conversation.findFirst({ where: { id: req.params.conversationId, userId }, select: { id: true } });
        if (!existing)
            throw new error_middleware_1.AppError('This conversation could not be found.', 404);
        const conversation = await db_1.prisma.conversation.update({
            where: { id: existing.id },
            data: { title: parsed.data.title, updatedAt: new Date() },
            select: { id: true, title: true, updatedAt: true },
        });
        return res.status(200).json({ success: true, data: { conversation } });
    }
    catch (error) {
        return next(error);
    }
}
async function deleteConversation(req, res, next) {
    try {
        const userId = requireUserId(req);
        const result = await db_1.prisma.conversation.deleteMany({ where: { id: req.params.conversationId, userId } });
        if (result.count === 0)
            throw new error_middleware_1.AppError('This conversation could not be found.', 404);
        return res.status(200).json({ success: true, message: 'Conversation deleted.' });
    }
    catch (error) {
        return next(error);
    }
}
async function regenerateConversationReply(req, res, next) {
    try {
        const parsed = chat_validation_1.chatSchema.safeParse({ ...req.body, conversationId: req.params.conversationId });
        if (!parsed.success)
            throw new error_middleware_1.AppError(parsed.error.issues[0]?.message || 'The reply could not be regenerated.', 400);
        const data = await (0, chat_service_1.processChatMessage)(requireUserId(req), parsed.data, true);
        return res.status(200).json({ success: true, data });
    }
    catch (error) {
        if (error instanceof ai_provider_interface_1.AIProviderError)
            return next(new error_middleware_1.AppError('The AI tutor is temporarily unavailable. Please try again shortly.', 503));
        return next(error);
    }
}
