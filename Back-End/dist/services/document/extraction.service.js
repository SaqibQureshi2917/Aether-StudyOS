"use strict";
// backend/src/services/document/extraction.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentExtractionService = void 0;
const ai_service_1 = require("../ai/ai.service");
const extraction_schema_1 = require("../../modules/materials/schemas/extraction.schema");
class DocumentExtractionService {
    /**
     * Extracts structured assignment data from course material text using AI with strict Zod validation.
     */
    static async extractAssignmentFromText(documentId, extractedText) {
        const systemPrompt = `You are an academic document intelligence engine. Analyze the provided academic document and extract an assignment only when the text clearly describes a student deliverable with an assignment title or task. Do not treat quizzes, exams, general lecture notes, or course descriptions as assignments. If no assignment is clearly present, return exactly {"type":"none"}.
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
            const response = await ai_service_1.aiAdapter.generateText({
                prompt: `Extract assignment from this text:\n\n${extractedText.substring(0, 4000)}`,
                systemPrompt,
                temperature: 0.1, // Low temperature for deterministic extraction
                responseFormat: 'json_object',
            });
            const parsedJson = JSON.parse(response);
            if (parsedJson?.type !== 'assignment')
                return null;
            // Validate with Zod schema before trusting
            const validationResult = extraction_schema_1.AssignmentExtractionSchema.safeParse(parsedJson);
            if (!validationResult.success) {
                return null;
            }
            return validationResult.data;
        }
        catch {
            return null;
        }
    }
}
exports.DocumentExtractionService = DocumentExtractionService;
