export type ChatMode = 'GENERAL' | 'STUDY';
export type SourceType = 'GENERAL_AI' | 'SOURCE_GROUNDED' | 'SOURCE_INSUFFICIENT';

export interface ChatRequestDTO {
  message: string;
  conversationId?: string;
  mode: ChatMode;
  courseId?: string;
}

export interface CitationDTO {
  citationId: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
  chunkId: string;
}

export interface ChatResponseDTO {
  conversationId: string;
  messageId: string;
  mode: ChatMode;
  answer: string;
  sourceType: SourceType;
  citations: CitationDTO[];
  usage: {
    used: number;
    limit: number;
  };
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
  text: string;
  similarity: number;
}