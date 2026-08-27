import { prisma } from '../config/db';
import { aiProvider } from './aiProvider.service';
import { usageService } from './usage.service';
import { ragService } from './rag.service';

export type ChatMode = 'GENERAL' | 'STUDY';
export type SourceType = 'GENERAL_AI' | 'SOURCE_GROUNDED' | 'SOURCE_INSUFFICIENT';

export interface ChatRequestPayload {
  message: string;
  conversationId?: string;
  mode: ChatMode;
  courseId?: string;
}

export class ChatService {
  async processChatMessage(userId: string, payload: ChatRequestPayload) {
    const usageInfo = await usageService.checkAndUpdateUsage(userId);

    // Get or Create Conversation Thread
    let conversation;
    if (payload.conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: payload.conversationId, userId },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId,
          title: payload.message.substring(0, 30) + '...',
        },
      });
    }

    // Save User Input
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        sender: 'USER',
        content: payload.message,
        mode: payload.mode,
        sourceType: payload.mode === 'GENERAL' ? 'GENERAL_AI' : 'SOURCE_GROUNDED',
      },
    });

    // 1. GENERAL MODE
    if (payload.mode === 'GENERAL') {
      const systemPrompt = `You are General AI Tutor for Aether StudyOS. Provide clear academic explanations based on general knowledge.`;
      const answer = await aiProvider.generateText(payload.message, systemPrompt);

      const assistantMsg = await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          sender: 'ASSISTANT',
          content: answer,
          mode: 'GENERAL',
          sourceType: 'GENERAL_AI',
        },
      });

      return {
        conversationId: conversation.id,
        messageId: assistantMsg.id,
        mode: 'GENERAL',
        answer,
        sourceType: 'GENERAL_AI',
        citations: [],
        usage: usageInfo,
      };
    }

    // 2. STUDYOS TUTOR MODE (RAG)
    const chunks = await ragService.retrieveContext(userId, payload.message, payload.courseId);

    // Insufficient evidence fallback
    if (chunks.length === 0) {
      const fallbackText = "I couldn't find enough information about this topic in your uploaded study material.";
      const assistantMsg = await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          sender: 'ASSISTANT',
          content: fallbackText,
          mode: 'STUDY',
          sourceType: 'SOURCE_INSUFFICIENT',
        },
      });

      return {
        conversationId: conversation.id,
        messageId: assistantMsg.id,
        mode: 'STUDY',
        answer: fallbackText,
        sourceType: 'SOURCE_INSUFFICIENT',
        citations: [],
        usage: usageInfo,
      };
    }

    // Source Grounded Execution
    const contextText = chunks.map((c, i) => `[SOURCE_${i + 1}] ${c.fileName} (Page ${c.pageNumber}): ${c.text}`).join('\n\n');
    const groundedPrompt = `Academic Evidence:\n${contextText}\n\nQuestion: ${payload.message}`;
    const systemPrompt = `You are Source-Grounded Academic Tutor for Aether StudyOS. Answer strictly using supplied evidence.`;

    const answer = await aiProvider.generateText(groundedPrompt, systemPrompt);

    const validCitations = chunks.map((c) => ({
      documentId: c.documentId,
      fileName: c.fileName,
      pageNumber: c.pageNumber,
      chunkId: c.chunkId,
    }));

    const assistantMsg = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        sender: 'ASSISTANT',
        content: answer,
        mode: 'STUDY',
        sourceType: 'SOURCE_GROUNDED',
        citations: { create: validCitations },
      },
      include: { citations: true },
    });

    return {
      conversationId: conversation.id,
      messageId: assistantMsg.id,
      mode: 'STUDY',
      answer,
      sourceType: 'SOURCE_GROUNDED',
      citations: validCitations,
      usage: usageInfo,
    };
  }
}

export const chatService = new ChatService();