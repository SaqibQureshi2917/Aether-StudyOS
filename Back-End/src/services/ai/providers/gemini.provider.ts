// backend/src/services/ai/providers/gemini.provider.ts

import { AIProvider, GenerateTextOptions } from '../ai-provider.interface';

export class GeminiProvider implements AIProvider {
  public name = 'GEMINI';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-pro') {
    this.apiKey = apiKey;
    this.model = model;
  }

  public async generateText(options: GenerateTextOptions): Promise<string> {
    try {
      // Using Google Generative AI REST endpoint or official SDK pattern
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      
      const contents = [];
      if (options.systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: `System Instructions: ${options.systemPrompt}\n\nUser Request: ${options.prompt}` }]
        });
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: options.prompt }]
        });
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 1024,
            responseMimeType: options.responseFormat === 'json_object' ? 'application/json' : 'text/plain',
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errorData}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('Gemini returned an empty response candidate.');
      }

      return text;
    } catch (error) {
      console.error('[GeminiProvider] Generation failed:', error);
      throw error;
    }
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text }]
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Gemini Embedding Error (${response.status}): ${errorData}`);
      }

      const data = await response.json();
      const values = data.embedding?.values;

      if (!values || !Array.isArray(values)) {
        throw new Error('Invalid embedding response format from Gemini.');
      }

      return values;
    } catch (error) {
      console.error('[GeminiProvider] Embedding generation failed:', error);
      throw error;
    }
  }
}