// backend/src/services/document/extraction.service.ts

import { aiAdapter } from '../ai/ai.service';
import { AssignmentExtractionSchema, QuizExtractionSchema, AssignmentExtractionDTO, QuizExtractionDTO } from '../../modules/materials/schemas/extraction.schema';

export class DocumentExtractionService {
  /**
   * Extracts structured assignment data from course material text using AI with strict Zod validation.
   */
  public static async extractAssignmentFromText(
    documentId: string,
    extractedText: string
  ): Promise<AssignmentExtractionDTO | null> {
    const systemPrompt = `You are an academic document intelligence engine. Analyze the provided syllabus or assignment sheet text and extract assignment details. 
    CRITICAL RULE: AI must NEVER invent a deadline. If no explicit deadline is found in the text, set "deadline" strictly to null. 
    Return a valid JSON object matching this structure:
    {
      "type": "assignment",
      "title": "string",
      "description": "string or null",
      "deadline": "ISO string or null",
      "difficulty": "EASY" | "MEDIUM" | "HARD",
      "estimatedHours": number,
      "source": { "documentId": "${documentId}", "page": number or null },
      "confidence": number between 0 and 1
    }`;

    try {
      const response = await aiAdapter.generateText({
        prompt: `Extract assignment from this text:\n\n${extractedText.substring(0, 4000)}`,
        systemPrompt,
        temperature: 0.1, // Low temperature for deterministic extraction
        responseFormat: 'json_object',
      });

      const parsedJson = JSON.parse(response);
      
      // Validate with Zod schema before trusting
      const validationResult = AssignmentExtractionSchema.safeParse(parsedJson);
      if (!validationResult.success) {
        console.error('[DocumentExtractionService] Assignment validation failed:', validationResult.error);
        return null;
      }

      return validationResult.data;
    } catch (error) {
      console.error('[DocumentExtractionService] Extraction error:', error);
      return null;
    }
  }
}