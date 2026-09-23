// backend/src/services/document/chunking.service.ts

export interface DocumentChunkOutput {
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  tokenCount: number;
}

export class DocumentChunkingService {
  /**
   * Splits extracted text into manageable chunks with overlap for RAG retrieval.
   * Ensures chunks respect token limits and preserve context.
   */
  public static chunkText(
    fullText: string,
    maxCharsPerChunk: number = 1000, // Yeh fix hai: int ki jagah number
    overlapChars: number = 200       // Yeh fix hai: int ki jagah number
  ): DocumentChunkOutput[] {
    if (!fullText || fullText.trim().length === 0) {
      return [];
    }

    const chunks: DocumentChunkOutput[] = [];
    let currentIndex = 0;
    let chunkIndex = 0;

    while (currentIndex < fullText.length) {
      let endIndex = Math.min(currentIndex + maxCharsPerChunk, fullText.length);

      // Try to break at a natural boundary (newline or period) if possible
      if (endIndex < fullText.length) {
        const nextPeriod = fullText.indexOf('.', endIndex - 100);
        const nextNewline = fullText.indexOf('\n', endIndex - 100);
        
        if (nextNewline !== -1 && nextNewline < endIndex + 50) {
          endIndex = nextNewline + 1;
        } else if (nextPeriod !== -1 && nextPeriod < endIndex + 50) {
          endIndex = nextPeriod + 1;
        }
      }

      const content = fullText.substring(currentIndex, endIndex).trim();
      
      if (content.length > 0) {
        // Approximate token count (roughly 4 chars per token in English)
        const tokenCount = Math.ceil(content.length / 4);

        chunks.push({
          chunkIndex,
          content,
          tokenCount,
        });

        chunkIndex++;
      }

      // Move pointer forward considering the overlap
      currentIndex = endIndex - overlapChars;
      if (currentIndex >= fullText.length || endIndex === fullText.length) {
        break;
      }
      // Prevent infinite loops if overlap is misconfigured
      if (currentIndex <= 0 && chunkIndex > 1000) {
        break;
      }
    }

    return chunks;
  }
}