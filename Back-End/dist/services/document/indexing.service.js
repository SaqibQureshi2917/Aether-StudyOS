"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentIndexingService = void 0;
const crypto_1 = require("crypto");
const db_1 = require("../../config/db");
const ai_service_1 = require("../ai/ai.service");
const chunking_service_1 = require("./chunking.service");
const EMBEDDING_DIMENSIONS = 1536;
const MAX_INDEXED_CHUNKS = 250;
const EMBEDDING_BATCH_SIZE = 4;
class DocumentIndexingService {
    static async indexMaterial(materialId, title, extractedText) {
        const chunks = chunking_service_1.DocumentChunkingService.chunkText(extractedText, 1400, 180);
        if (chunks.length === 0)
            return 0;
        if (chunks.length > MAX_INDEXED_CHUNKS) {
            throw new Error('This document is too large to index in one upload. Split it into smaller files and upload again.');
        }
        await db_1.prisma.$transaction(async (tx) => {
            await tx.courseMaterial.update({ where: { id: materialId }, data: { isIndexed: false, processingStatus: 'PROCESSING' } });
            await tx.documentChunk.deleteMany({ where: { materialId } });
        });
        try {
            const embeddedChunks = [];
            for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
                const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
                const embeddings = await Promise.all(batch.map((chunk) => ai_service_1.aiAdapter.generateEmbedding(`title: ${title} | text: ${chunk.content}`)));
                batch.forEach((chunk, index) => {
                    const embedding = embeddings[index];
                    if (embedding.length !== EMBEDDING_DIMENSIONS)
                        throw new Error('The embedding provider returned a vector with an unsupported dimension.');
                    embeddedChunks.push({ ...chunk, embedding });
                });
            }
            await db_1.prisma.$transaction(async (tx) => {
                for (const chunk of embeddedChunks) {
                    const vector = `[${chunk.embedding.join(',')}]`;
                    await tx.$executeRaw `
            INSERT INTO "DocumentChunk" ("id", "materialId", "chunkIndex", "content", "pageNumber", "tokenCount", "embedding", "createdAt")
            VALUES (${(0, crypto_1.randomUUID)()}, ${materialId}, ${chunk.chunkIndex}, ${chunk.content}, NULL, ${chunk.tokenCount}, ${vector}::vector, NOW())
          `;
                }
                await tx.courseMaterial.update({ where: { id: materialId }, data: { isIndexed: true, processingStatus: 'INDEXED' } });
            });
            return embeddedChunks.length;
        }
        catch (error) {
            await db_1.prisma.courseMaterial.update({ where: { id: materialId }, data: { isIndexed: false, processingStatus: 'FAILED' } }).catch(() => undefined);
            throw error;
        }
    }
}
exports.DocumentIndexingService = DocumentIndexingService;
