import { prisma } from '../config/db';
import { ChatMode, SourceType, CitationDTO } from '../modules/chat/chat.types';

export class ConversationService {
  async getOrCreateConversation(userId: string, conversationId?: string, firstMessage?: string) {
    if (conversationId) {
      const existing = await prisma.conversation.findFirst({
        where: { id: conversationId, userId },
      });
      if (existing) return existing;
    }

    return await prisma.conversation.create({
      data: {
        userId,
        title: firstMessage ? firstMessage.substring(0, 30) + '...' : 'New Chat',
      },
    });
  }

  async saveMessageWithCitations(
    conversationId: string,
    sender: 'USER' | 'ASSISTANT',
    content: string,
    mode: ChatMode,
    sourceType: SourceType,
    citations: CitationDTO[] = []
  ) {
    return await prisma.chatMessage.create({
      data: {
        conversationId,
        sender,
        content,
        mode,
        sourceType,
        citations: {
          create: citations.map((c) => ({
            documentId: c.documentId,
            fileName: c.fileName,
            pageNumber: c.pageNumber,
            chunkId: c.chunkId,
          })),
        },
      },
      include: { citations: true },
    });
  }
}

export const conversationService = new ConversationService();