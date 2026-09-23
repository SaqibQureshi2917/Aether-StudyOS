// backend/src/services/ai/ai-failover.manager.ts

import { AIProvider, GenerateTextOptions } from './ai-provider.interface';

export class AIFailoverManager implements AIProvider {
  public name = 'FAILOVER_MANAGER';
  private providers: AIProvider[];

  constructor(providers: AIProvider[]) {
    this.providers = providers;
    if (this.providers.length === 0) {
      throw new Error('AIFailoverManager requires at least one AI provider.');
    }
  }

  public async generateText(options: GenerateTextOptions): Promise<string> {
    let lastError: any = null;

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        // Attempt generation with current primary/secondary provider
        const result = await provider.generateText(options);
        return result;
      } catch (error: any) {
        lastError = error;
        console.warn(`[AIFailoverManager] Provider ${provider.name} failed. Error: ${error.message}. Switching to next provider if available...`);
        
        // Check if error is rate-limit (429) or server timeout/error, which triggers failover
        const isRateLimitOrTimeout = error.message.includes('429') || error.message.includes('503') || error.message.includes('timeout');
        
        if (i === this.providers.length - 1) {
          // Last provider also failed
          break;
        }
      }
    }

    throw new Error(`All AI providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    let lastError: any = null;

    for (const provider of this.providers) {
      try {
        return await provider.generateEmbedding(text);
      } catch (error: any) {
        lastError = error;
        continue;
      }
    }

    throw new Error(`All providers failed to generate embedding. Last error: ${lastError?.message}`);
  }
}