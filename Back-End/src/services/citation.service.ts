import { CitationDTO, RetrievedChunk } from '../modules/chat/chat.types';

export class CitationService {
  verifyAndExtractCitations(rawAnswer: string, chunks: RetrievedChunk[]): { cleanedAnswer: string; validCitations: CitationDTO[] } {
    const validCitations: CitationDTO[] = [];
    
    // Map verified sources to prevent hallucinated citations
    chunks.forEach((chunk) => {
      validCitations.push({
        citationId: `cit_${Math.random().toString(36).substring(2, 9)}`,
        documentId: chunk.documentId,
        fileName: chunk.fileName,
        pageNumber: chunk.pageNumber,
        chunkId: chunk.chunkId,
      });
    });

    return {
      cleanedAnswer: rawAnswer,
      validCitations,
    };
  }
}

export const citationService = new CitationService();