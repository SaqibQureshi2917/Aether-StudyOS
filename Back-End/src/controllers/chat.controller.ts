import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { AIProviderError } from '../services/ai/ai-provider.interface';
import { processChatMessage } from '../services/chat/chat.service';
import { parseChatAttachment } from '../services/chat/chat-attachment.service';
import { chatSchema, renameConversationSchema } from '../validations/chat.validation';

function requireUserId(req: AuthenticatedRequest) {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('Your session has expired. Sign in and try again.', 401);
  return userId;
}

export async function handleChatRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = chatSchema.safeParse({
      ...req.body,
      ...(req.body.courseId ? { courseId: req.body.courseId } : {}),
    });
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Check your message and try again.', 400);
    const attachment = req.file ? await parseChatAttachment(req.file) : undefined;
    const data = await processChatMessage(requireUserId(req), { ...parsed.data, attachment });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof AIProviderError) return next(new AppError('The AI tutor is temporarily unavailable. Please try again shortly.', 503));
    return next(error);
  }
}

export async function getConversationThreads(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const threads = await prisma.conversation.findMany({
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
  } catch (error) {
    return next(error);
  }
}

export async function createConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const conversation = await prisma.conversation.create({
      data: { userId: requireUserId(req), title: 'New Chat' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    return res.status(201).json({ success: true, data: { conversation } });
  } catch (error) {
    return next(error);
  }
}

export async function getConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.conversationId, userId },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    if (!conversation) throw new AppError('This conversation could not be found.', 404);
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
      include: { citations: { select: { id: true, documentId: true, fileName: true, pageNumber: true, chunkId: true } } },
    });
    return res.status(200).json({ success: true, data: { conversation: { ...conversation, messages } } });
  } catch (error) {
    return next(error);
  }
}

export async function renameConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const parsed = renameConversationSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Enter a valid conversation name.', 400);
    const existing = await prisma.conversation.findFirst({ where: { id: req.params.conversationId, userId }, select: { id: true } });
    if (!existing) throw new AppError('This conversation could not be found.', 404);
    const conversation = await prisma.conversation.update({
      where: { id: existing.id },
      data: { title: parsed.data.title, updatedAt: new Date() },
      select: { id: true, title: true, updatedAt: true },
    });
    return res.status(200).json({ success: true, data: { conversation } });
  } catch (error) {
    return next(error);
  }
}

export async function deleteConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const result = await prisma.conversation.deleteMany({ where: { id: req.params.conversationId, userId } });
    if (result.count === 0) throw new AppError('This conversation could not be found.', 404);
    return res.status(200).json({ success: true, message: 'Conversation deleted.' });
  } catch (error) {
    return next(error);
  }
}

export async function regenerateConversationReply(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = chatSchema.safeParse({ ...req.body, conversationId: req.params.conversationId });
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'The reply could not be regenerated.', 400);
    const data = await processChatMessage(requireUserId(req), parsed.data, true);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof AIProviderError) return next(new AppError('The AI tutor is temporarily unavailable. Please try again shortly.', 503));
    return next(error);
  }
}
