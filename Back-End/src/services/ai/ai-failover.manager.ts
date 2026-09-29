// backend/src/services/ai/ai-failover.manager.ts

import { AIProvider, AIProviderError, GenerateTextOptions } from './ai-provider.interface';

export class AIFailoverManager implements AIProvider {
  public name = 'FAILOVER_MANAGER';
  private providers: AIProvider[];

  constructor(providers: AIProvider[]) {
    this.providers = providers;
  }

  public async generateText(options: GenerateTextOptions): Promise<string> {
    return (await this.generateTextWithProvider(options)).text;
  }

  public async generateTextWithProvider(options: GenerateTextOptions): Promise<{ text: string; provider: string }> {
    let lastError: unknown = null;

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return { text: await provider.generateText(options), provider: provider.name };
        } catch (error) {
          lastError = error;
          const retryable = error instanceof AIProviderError ? error.retryable : false;
          if (!retryable) {
            throw error instanceof AIProviderError ? error : new AIProviderError('The configured AI provider rejected the request.', false);
          }
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    }

    if (this.providers.length === 0) throw new AIProviderError('No AI text provider is configured.', false);
    const retryable = lastError instanceof AIProviderError && lastError.retryable;
    throw new AIProviderError('All configured AI providers are temporarily unavailable.', retryable);
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    let lastError: unknown = null;

    for (const provider of this.providers) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return await provider.generateEmbedding(text);
        } catch (error) {
          lastError = error;
          if (error instanceof AIProviderError && !error.retryable) break;
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    }

    if (lastError instanceof AIProviderError) throw lastError;
    throw new AIProviderError('No configured provider can create document embeddings.', false);
  }
}
