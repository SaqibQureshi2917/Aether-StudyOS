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
  attachment?: {
    fileName: string;
    mimeType: string;
    text?: string;
    imageData?: string;
  };
}

export interface ChatResponseDTO {
  conversationId: string;
  userMessageId: string;
  messageId: string;
  mode: ChatMode;
  answer: string;
  sourceType: SourceType;
  citations: Citation[];
  usage: {
    used: number;
    limit: number | null;
  };
  providerUsed: string;
  createdAt: Date;
}
