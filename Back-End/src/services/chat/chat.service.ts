// backend/src/services/chat/chat.service.ts
import { ChatRequestDTO, ChatResponseDTO, Citation, SourceType } from '../../types/chat.types';
import { aiAdapter } from '../ai/ai.service';
import { RAGService } from './rag.service';

export async function processChatMessage(userId: string, dto: ChatRequestDTO): Promise<ChatResponseDTO> {
  const { message, mode, conversationId, courseId } = dto;

  let sourceType: SourceType = 'GENERAL_AI';
  let citations: Citation[] = [];
  let contextData = '';
  let systemPrompt = 'You are an advanced academic AI assistant for Aether StudyOS.';

  if (mode === 'STUDY') {
    // 1. Generate query embedding using the centralized aiAdapter
    const queryEmbedding = await aiAdapter.generateEmbedding(message);

    // 2. Perform secure vector retrieval using RAGService class
    const retrievedChunks = await RAGService.retrieveRelevantChunks(userId, queryEmbedding, courseId);

    // 3. Evaluate Evidence Threshold (minimum similarity score 0.75)
    const validChunks = retrievedChunks.filter(chunk => chunk.similarity >= 0.75);

    if (validChunks.length === 0) {
      return {
        conversationId: conversationId || `conv_${Date.now()}`,
        messageId: Date.now().toString(),
        mode: 'STUDY',
        answer: "I couldn't find enough information about this topic in your uploaded study material.",
        sourceType: 'SOURCE_INSUFFICIENT',
        citations: [],
        usage: { used: 1, limit: 10 },
        providerUsed: 'None',
      };
    }

    // 4. Assemble context and construct verified citations
    contextData = validChunks.map((chunk, idx) => `[SOURCE_00${idx + 1}] (${chunk.fileName}, Page ${chunk.pageNumber}):\n${chunk.content}`).join('\n\n');

    citations = validChunks.map((chunk, idx) => ({
      citationId: `SOURCE_00${idx + 1}`,
      documentId: chunk.documentId,
      fileName: chunk.fileName,
      pageNumber: chunk.pageNumber ?? 0,
      chunkId: chunk.chunkId,
    }));

    sourceType = 'SOURCE_GROUNDED';
    systemPrompt = `You are the Source-Grounded Academic Tutor for Aether StudyOS. Answer using the supplied academic sources. Do not invent facts or fabricate citations. Use source identifiers like [SOURCE_001] when supporting claims.`;
  }

  let fullPrompt = message;
  if (contextData) {
    fullLink: fullPrompt = `Here are the relevant academic sources:\n${contextData}\n\nAnswer the user's question clearly and concisely using these sources if in STUDY mode.\n\nUser Question: ${message}`;
  }

  // 5. Execute AI call via unified multi-provider Groq + Gemini fallback adapter
  const answer = await aiAdapter.generateText({
    prompt: fullPrompt,
    systemPrompt: `${systemPrompt}\n\nNote: Keep answers structured, concise, and easy to understand for a university student unless deep detail is explicitly asked.`,
    temperature: 0.7,
    maxTokens: 1024,
  });

  return {
    conversationId: conversationId || `conv_${Date.now()}`,
    messageId: Date.now().toString(),
    mode: mode,
    answer: answer,
    sourceType: sourceType,
    citations: citations,
    usage: { used: 1, limit: 10 },
    providerUsed: aiAdapter.name || 'AI Failover Manager',
  };
}