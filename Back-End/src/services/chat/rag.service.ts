import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  fileName: string;
  courseId: string;
  content: string;
  pageNumber: number | null;
  similarity: number;
}

const EMBEDDING_DIMENSIONS = 1536;
const MIN_SIMILARITY = 0.68;

export class RAGService {
  static async retrieveRelevantChunks(
    userId: string,
    queryEmbedding: number[],
    courseId?: string,
    topK = 5,
  ): Promise<RetrievedChunk[]> {
    if (queryEmbedding.length !== EMBEDDING_DIMENSIONS || queryEmbedding.some((value) => !Number.isFinite(value))) {
      throw new Error('The question embedding does not match the configured vector dimensions.');
    }

    const embeddingString = `[${queryEmbedding.join(',')}]`;
    const courseFilter = courseId ? Prisma.sql`AND cm."courseId" = ${courseId}` : Prisma.empty;
    const take = Math.min(10, Math.max(1, Math.floor(topK)));

    try {
      const rows = await prisma.$queryRaw<Array<{
        id: string;
        materialId: string;
        title: string;
        courseId: string;
        content: string;
        pageNumber: number | null;
        similarity: number;
      }>>`
        SELECT dc.id,
               dc."materialId",
               cm.title,
               cm."courseId",
               dc.content,
               dc."pageNumber",
               1 - (dc.embedding <=> ${embeddingString}::vector) AS similarity
        FROM "DocumentChunk" dc
        JOIN "CourseMaterial" cm ON cm.id = dc."materialId"
        JOIN "Course" c ON c.id = cm."courseId"
        JOIN "Semester" s ON s.id = c."semesterId"
        WHERE s."userId" = ${userId}
          AND cm."isIndexed" = true
          AND dc.embedding IS NOT NULL
          ${courseFilter}
          AND 1 - (dc.embedding <=> ${embeddingString}::vector) >= ${MIN_SIMILARITY}
        ORDER BY dc.embedding <=> ${embeddingString}::vector ASC
        LIMIT ${take}
      `;

      return rows.map((row) => ({
        chunkId: row.id,
        documentId: row.materialId,
        fileName: row.title,
        courseId: row.courseId,
        content: row.content,
        pageNumber: row.pageNumber,
        similarity: Number(row.similarity),
      }));
    } catch {
      throw new Error('StudyOS Tutor could not search indexed course materials.');
    }
  }
}
