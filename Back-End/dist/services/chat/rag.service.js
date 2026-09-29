"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAGService = void 0;
const client_1 = require("@prisma/client");
const db_1 = require("../../config/db");
const EMBEDDING_DIMENSIONS = 1536;
const MIN_SIMILARITY = 0.68;
class RAGService {
    static async retrieveRelevantChunks(userId, queryEmbedding, courseId, topK = 5) {
        if (queryEmbedding.length !== EMBEDDING_DIMENSIONS || queryEmbedding.some((value) => !Number.isFinite(value))) {
            throw new Error('The question embedding does not match the configured vector dimensions.');
        }
        const embeddingString = `[${queryEmbedding.join(',')}]`;
        const courseFilter = courseId ? client_1.Prisma.sql `AND cm."courseId" = ${courseId}` : client_1.Prisma.empty;
        const take = Math.min(10, Math.max(1, Math.floor(topK)));
        try {
            const rows = await db_1.prisma.$queryRaw `
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
        }
        catch {
            throw new Error('StudyOS Tutor could not search indexed course materials.');
        }
    }
}
exports.RAGService = RAGService;
