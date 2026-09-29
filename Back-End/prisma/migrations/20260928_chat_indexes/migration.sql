DROP INDEX IF EXISTS "DocumentChunk_materialId_idx";

CREATE INDEX "DocumentChunk_materialId_chunkIndex_idx"
ON "DocumentChunk"("materialId", "chunkIndex");

CREATE INDEX "Conversation_userId_updatedAt_idx"
ON "Conversation"("userId", "updatedAt");

CREATE INDEX "ChatMessage_conversationId_createdAt_idx"
ON "ChatMessage"("conversationId", "createdAt");
