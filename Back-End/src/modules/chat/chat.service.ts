import { ChatRequestDTO, ChatResponseDTO } from './chat.types';
import { aiProvider } from '../../services/aiProvider.service';
import { usageService } from '../../services/usage.service';
import { ragService } from '../../services/rag.service';
import { citationService } from '../../services/citation.service';
import { conversationService } from '../../services/conversation.service';

export class ChatService {
  async processChatMessage(userId: string, dto: ChatRequestDTO): Promise<ChatResponseDTO> {
    // 1. Subscription & Usage Check
    const usageInfo = await usageService.checkAndUpdateUsage(userId, dto.mode);

    // 2. Get/Create Conversation
    const conversation = await conversationService.getOrCreateConversation(
      userId,
      dto.conversationId,
      dto.message
    );

    // Save User Query
    await conversationService.saveMessageWithCitations(
      conversation.id,
      'USER',
      dto.message,
      dto.mode,
      dto.mode === 'GENERAL' ? 'GENERAL_AI' : 'SOURCE_GROUNDED'
    );

    // 3. Mode Routing Logic
    if (dto.mode === 'GENERAL') {
      const systemPrompt = `You are General AI Tutor for Aether StudyOS. Provide clear academic explanations based on standard general knowledge.`;
      const answer = await aiProvider.generateText(dto.message, systemPrompt);

      const assistantMsg = await conversationService.saveMessageWithCitations(
        conversation.id,
        'ASSISTANT',
        answer,
        'GENERAL',
        'GENERAL_AI',
        []
      );

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

    // STUDYOS TUTOR MODE (RAG Execution)
    const chunks = await ragService.retrieveContext(userId, dto.message, dto.courseId);

    // Evidence Threshold Check: Insufficient Sources
    if (chunks.length === 0) {
      const insufficientAnswer = "I couldn't find enough information about this topic in your uploaded study material.";

      const assistantMsg = await conversationService.saveMessageWithCitations(
        conversation.id,
        'ASSISTANT',
        insufficientAnswer,
        'STUDY',
        'SOURCE_INSUFFICIENT',
        []
      );

      return {
        conversationId: conversation.id,
        messageId: assistantMsg.id,
        mode: 'STUDY',
        answer: insufficientAnswer,
        sourceType: 'SOURCE_INSUFFICIENT',
        citations: [],
        usage: usageInfo,
      };
    }

    // Source Grounded AI Execution
    const contextText = chunks.map((c, i) => `[SOURCE_${i + 1}] ${c.fileName} (Page ${c.pageNumber}): ${c.text}`).join('\n\n');
    const groundedPrompt = `Academic Evidence:\n${contextText}\n\nStudent Question: ${dto.message}`;
    const systemPrompt = `You are Source-Grounded Academic Tutor for Aether StudyOS. Answer strictly using supplied evidence. Do not hallucinate citations.`;

    const rawAnswer = await aiProvider.generateText(groundedPrompt, systemPrompt);
    const { cleanedAnswer, validCitations } = citationService.verifyAndExtractCitations(rawAnswer, chunks);

    const assistantMsg = await conversationService.saveMessageWithCitations(
      conversation.id,
      'ASSISTANT',
      cleanedAnswer,
      'STUDY',
      'SOURCE_GROUNDED',
      validCitations
    );

    return {
      conversationId: conversation.id,
      messageId: assistantMsg.id,
      mode: 'STUDY',
      answer: cleanedAnswer,
      sourceType: 'SOURCE_GROUNDED',
      citations: validCitations,
      usage: usageInfo,
    };
  }
}

export const chatService = new ChatService();