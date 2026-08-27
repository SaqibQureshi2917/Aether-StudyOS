import GoogleGenAI from '@google/genai';

export interface IAIProvider {
  generateText(prompt: string, systemPrompt?: string): Promise<string>;
}

export class GeminiAIProvider implements IAIProvider {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
      });

      return response.text || 'No response generated.';
    } catch (error) {
      console.error('AI Provider Error:', error);
      throw new Error('AI service is temporarily unavailable. Please try again.');
    }
  }
}

export const aiProvider = new GeminiAIProvider();