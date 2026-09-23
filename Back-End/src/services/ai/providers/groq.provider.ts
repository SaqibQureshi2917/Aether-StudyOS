// backend/src/services/ai/providers/groq.provider.ts

import { AIProvider, GenerateTextOptions } from '../ai-provider.interface';

export class GroqProvider implements AIProvider {
  public name = 'GROQ';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'openai/gpt-oss-20b') {
    this.apiKey = apiKey;
    this.model = model;
  }

  public async generateText(options: GenerateTextOptions): Promise<string> {
    // Production implementation for Groq API call
    // Using fetch or official SDK with proper error handling and rate-limit tracking
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            { role: 'user', content: options.prompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 1024,
          response_format: options.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Groq API Error (${response.status}): ${errorData}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('[GroqProvider] Generation failed:', error);
      throw error;
    }
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    // Groq usually requires an embedding-specific model or external provider like Gemini/OpenAI
    // Here we can throw or delegate to embedding provider
    throw new Error('Groq embedding provider not natively configured; use Gemini or dedicated embedding service.');
  }
}