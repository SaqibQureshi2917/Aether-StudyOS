import { prisma } from '../config/db';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
  text: string;
  similarity: number;
}

export class RAGService {
  async retrieveContext(userId: string, query: string, courseId?: string): Promise<RetrievedChunk[]> {
    // User ownership isolation check
    const materials = await prisma.material.findMany({
      where: {
        userId,
        ...(courseId && { courseId }),
      },
      take: 5,
    });

    if (materials.length === 0) return [];

    // Chunks database simulation
    const mockChunks: RetrievedChunk[] = [
      {
        chunkId: 'chk_101',
        documentId: materials[0].id,
        fileName: materials[0].title || 'Lecture_Notes.pdf',
        pageNumber: 4,
        text: 'K-Means clustering partitions n observations into k clusters where each observation belongs to the cluster with the nearest mean.',
        similarity: 0.88,
      },
    ];

    return mockChunks.filter((c) => c.similarity >= 0.70);
  }
}

export const ragService = new RAGService();