// backend/src/modules/chat/chat.types.ts
export type ChatMode = 'GENERAL' | 'STUDY';

export type SourceType = 'GENERAL_AI' | 'SOURCE_GROUNDED' | 'SOURCE_INSUFFICIENT';

export interface Citation {
  citationId: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
  chunkId: string;
}

export interface ChatRequestDTO {
  message: string;
  conversationId?: string;
  mode: ChatMode;
  courseId?: string;
}

export interface ChatResponseDTO {
  conversationId: string;
  messageId: string;
  mode: ChatMode;
  answer: string;
  sourceType: SourceType;
  citations: Citation[];
  usage: {
    used: number;
    limit: number;
  };
  providerUsed: string;
}