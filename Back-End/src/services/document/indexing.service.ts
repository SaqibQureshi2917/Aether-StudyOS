import { randomUUID } from 'crypto';
import { prisma } from '../../config/db';
import { aiAdapter } from '../ai/ai.service';
import { DocumentChunkingService } from './chunking.service';

const EMBEDDING_DIMENSIONS = 1536;
const MAX_INDEXED_CHUNKS = 250;
const EMBEDDING_BATCH_SIZE = 4;

export class DocumentIndexingService {
  static async indexMaterial(materialId: string, title: string, extractedText: string) {
    const chunks = DocumentChunkingService.chunkText(extractedText, 1400, 180);
    if (chunks.length === 0) return 0;
    if (chunks.length > MAX_INDEXED_CHUNKS) {
      throw new Error('This document is too large to index in one upload. Split it into smaller files and upload again.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.courseMaterial.update({ where: { id: materialId }, data: { isIndexed: false, processingStatus: 'PROCESSING' } });
      await tx.documentChunk.deleteMany({ where: { materialId } });
    });
    try {
      const embeddedChunks: Array<{ chunkIndex: number; content: string; tokenCount: number; embedding: number[] }> = [];
      for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
        const embeddings = await Promise.all(batch.map((chunk) => aiAdapter.generateEmbedding(
          `title: ${title} | text: ${chunk.content}`,
        )));
        batch.forEach((chunk, index) => {
          const embedding = embeddings[index];
          if (embedding.length !== EMBEDDING_DIMENSIONS) throw new Error('The embedding provider returned a vector with an unsupported dimension.');
          embeddedChunks.push({ ...chunk, embedding });
        });
      }

      await prisma.$transaction(async (tx) => {
        for (const chunk of embeddedChunks) {
          const vector = `[${chunk.embedding.join(',')}]`;
          await tx.$executeRaw`
            INSERT INTO "DocumentChunk" ("id", "materialId", "chunkIndex", "content", "pageNumber", "tokenCount", "embedding", "createdAt")
            VALUES (${randomUUID()}, ${materialId}, ${chunk.chunkIndex}, ${chunk.content}, NULL, ${chunk.tokenCount}, ${vector}::vector, NOW())
          `;
        }
        await tx.courseMaterial.update({ where: { id: materialId }, data: { isIndexed: true, processingStatus: 'INDEXED' } });
      });
      return embeddedChunks.length;
    } catch (error) {
      await prisma.courseMaterial.update({ where: { id: materialId }, data: { isIndexed: false, processingStatus: 'FAILED' } }).catch(() => undefined);
      throw error;
    }
  }
}
