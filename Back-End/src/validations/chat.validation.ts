// backend/src/modules/chat/chat.validation.ts
import { z } from 'zod';

export const chatSchema = z.object({
  message: z.string().min(1, 'Message content cannot be empty').max(4000, 'Message is too long'),
  conversationId: z.string().optional(),
  mode: z.enum(['GENERAL', 'STUDY']),
  courseId: z.string().optional(),
});