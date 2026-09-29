// backend/src/services/ai/providers/gemini.provider.ts

import { AIProvider, AIProviderError, GenerateTextOptions } from '../ai-provider.interface';

export class GeminiProvider implements AIProvider {
  public name = 'GEMINI';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-pro') {
    this.apiKey = apiKey;
    this.model = model;
  }

  public async generateText(options: GenerateTextOptions): Promise<string> {
    if (!this.apiKey) throw new AIProviderError('Gemini is not configured.', false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
      
      const contents = [{ role: 'user', parts: [
        { text: options.prompt },
        ...(options.images || []).map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.data } })),
      ] }];

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents,
          ...(options.systemPrompt ? { systemInstruction: { parts: [{ text: options.systemPrompt }] } } : {}),
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 1024,
            responseMimeType: options.responseFormat === 'json_object' ? 'application/json' : 'text/plain',
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AIProviderError(`Gemini request failed with status ${response.status}.`, response.status === 408 || response.status === 429 || response.status >= 500, response.status);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('Gemini returned an empty response candidate.');
      }

      return text;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(controller.signal.aborted ? 'Gemini request timed out.' : 'Gemini could not be reached.', true);
    } finally {
      clearTimeout(timeout);
    }
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) throw new AIProviderError('Gemini embeddings are not configured.', false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text }] },
          taskType: text.startsWith('title:') ? 'RETRIEVAL_DOCUMENT' : 'QUESTION_ANSWERING',
          outputDimensionality: 1536,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AIProviderError(`Gemini embedding request failed with status ${response.status}.`, response.status === 408 || response.status === 429 || response.status >= 500, response.status);
      }

      const data = await response.json();
      const values = data.embedding?.values;

      if (!values || !Array.isArray(values)) {
        throw new AIProviderError('Gemini returned an invalid embedding.', false);
      }
      if (values.length !== 1536 || values.some((value: unknown) => typeof value !== 'number' || !Number.isFinite(value))) {
        throw new AIProviderError('Gemini returned an embedding with an unexpected dimension.', false);
      }

      return values;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(controller.signal.aborted ? 'Gemini embedding request timed out.' : 'Gemini embeddings could not be reached.', true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
