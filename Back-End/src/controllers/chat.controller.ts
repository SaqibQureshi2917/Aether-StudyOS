import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware'; 
import { aiAdapter } from '../services/ai/ai.service';
import { RAGService } from '../services/chat/rag.service';

export async function handleChatRequest(req: AuthenticatedRequest, res: Response): Promise<Response> {
  try {
    const { message, mode, conversationId, courseId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized user context.' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required.' });
    }

    let sourceType = 'GENERAL_AI';
    let citations: any[] = [];
    let contextData = '';
    let systemPrompt = 'You are an advanced academic AI assistant for Aether StudyOS.';

    // StudyOS Tutor / Source-Grounded Mode
    if (mode === 'STUDY') {
      
      
      const queryEmbedding = await aiAdapter.generateEmbedding(message);
      const validChunks = await RAGService.retrieveRelevantChunks(userId, queryEmbedding, courseId);

      if (validChunks.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            conversationId: conversationId || `conv_${Date.now()}`,
            messageId: Date.now().toString(),
            mode: 'STUDY',
            answer: "I couldn't find enough information about this topic in your uploaded study material.",
            sourceType: 'SOURCE_INSUFFICIENT',
            citations: [],
            usage: { used: 1, limit: 10 },
            providerUsed: 'None',
          }
        });
      }

      contextData = validChunks.map((chunk, idx) => `[SOURCE_00${idx + 1}] (${chunk.fileName}, Page ${chunk.pageNumber}):\n${chunk.content}`).join('\n\n');

      citations = validChunks.map((chunk, idx) => ({
        citationId: `SOURCE_00${idx + 1}`,
        documentId: chunk.documentId,
        fileName: chunk.fileName,
        pageNumber: chunk.pageNumber,
        chunkId: chunk.chunkId,
      }));

      sourceType = 'SOURCE_GROUNDED';
      systemPrompt = 'You are the Source-Grounded Academic Tutor for Aether StudyOS. Answer using the supplied academic sources. Do not invent facts or fabricate citations.';
    }

    let fullPrompt = message;
    if (contextData) {
      fullPrompt = `Here are the relevant academic sources:\n${contextData}\n\nAnswer the user's question clearly and concisely using these sources if in STUDY mode.\n\nUser Question: ${message}`;
    }

    // Execute via Unified Multi-Provider Adapter (Groq + Gemini Failover)
    const answer = await aiAdapter.generateText({
      prompt: fullPrompt,
      systemPrompt: `${systemPrompt}\n\nNote: Keep answers structured, concise, and easy to understand for a university student unless deep detail is explicitly asked.`,
      temperature: 0.7,
      maxTokens: 1024,
    });

    return res.status(200).json({
      success: true,
      data: {
        conversationId: conversationId || `conv_${Date.now()}`,
        messageId: Date.now().toString(),
        mode: mode || 'GENERAL',
        answer: answer,
        sourceType: sourceType,
        citations: citations,
        usage: { used: 1, limit: 10 },
        providerUsed: aiAdapter.name || 'AI Failover Manager',
      }
    });

  } catch (error: any) {
    console.error('Chat Controller Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'AI service temporarily unavailable.' 
    });
  }
}