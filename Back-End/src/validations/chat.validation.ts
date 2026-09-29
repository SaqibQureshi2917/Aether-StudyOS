// backend/src/modules/chat/chat.validation.ts
import { z } from 'zod';

export const chatSchema = z.object({
  message: z.string().trim().min(1, 'Enter a message.').max(4000, 'Messages must be 4,000 characters or fewer.'),
  conversationId: z.string().uuid().optional(),
  mode: z.enum(['GENERAL', 'STUDY']).default('GENERAL'),
  courseId: z.string().uuid().optional(),
});

export const renameConversationSchema = z.object({
  title: z.string().trim().min(1, 'Enter a conversation name.').max(80, 'Conversation names must be 80 characters or fewer.'),
});
