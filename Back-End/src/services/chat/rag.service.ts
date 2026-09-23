// backend/src/services/chat/rag.service.ts

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  fileName: string;
  courseId: string;
  content: string;
  pageNumber: number | null;
  similarity: number;
}

export class RAGService {
  /**
   * Performs vector similarity search over DocumentChunks scoped strictly to the user.
   * Enforces tenant/user isolation at the database layer.
   */
  public static async retrieveRelevantChunks(
    userId: string,
    queryEmbedding: number[],
    courseId?: string,
    topK: number = 5,
    similarityThreshold: number = 0.7
  ): Promise<RetrievedChunk[]> {
    try {
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      // Using Prisma.sql helper or conditional execution to safely handle optional courseId
      let chunks;
      if (courseId) {
        chunks = await prisma.$queryRaw<Array<{
          id: string;
          materialId: string;
          title: string;
          courseId: string;
          content: string;
          pageNumber: number | null;
          similarity: number;
        }>>`
          SELECT 
            dc.id,
            dc."materialId",
            cm.title,
            cm."courseId",
            dc.content,
            dc."pageNumber",
            1 - (dc.embedding <=> ${embeddingString}::vector) AS similarity
          FROM "DocumentChunk" dc
          JOIN "CourseMaterial" cm ON dc."materialId" = cm.id
          JOIN "Course" c ON cm."courseId" = c.id
          JOIN "Semester" s ON c."semesterId" = s.id
          WHERE s."userId" = ${userId}
          AND cm."courseId" = ${courseId}
          AND (1 - (dc.embedding <=> ${embeddingString}::vector)) >= ${similarityThreshold}
          ORDER BY similarity DESC
          LIMIT ${topK};
        `;
      } else {
        chunks = await prisma.$queryRaw<Array<{
          id: string;
          materialId: string;
          title: string;
          courseId: string;
          content: string;
          pageNumber: number | null;
          similarity: number;
        }>>`
          SELECT 
            dc.id,
            dc."materialId",
            cm.title,
            cm."courseId",
            dc.content,
            dc."pageNumber",
            1 - (dc.embedding <=> ${embeddingString}::vector) AS similarity
          FROM "DocumentChunk" dc
          JOIN "CourseMaterial" cm ON dc."materialId" = cm.id
          JOIN "Course" c ON cm."courseId" = c.id
          JOIN "Semester" s ON c."semesterId" = s.id
          WHERE s."userId" = ${userId}
          AND (1 - (dc.embedding <=> ${embeddingString}::vector)) >= ${similarityThreshold}
          ORDER BY similarity DESC
          LIMIT ${topK};
        `;
      }

      return chunks.map(chunk => ({
        chunkId: chunk.id,
        documentId: chunk.materialId,
        fileName: chunk.title,
        courseId: chunk.courseId,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        similarity: chunk.similarity,
      }));
    } catch (error) {
      console.error('[RAGService] Error retrieving chunks:', error);
      throw new Error('Failed to perform source-grounded document retrieval.');
    }
  }
}