// backend/src/services/ai/ai-provider.interface.ts

export interface GenerateTextOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
}

export interface AIProvider {
  name: string;
  generateText(options: GenerateTextOptions): Promise<string>;
  generateEmbedding(text: string): Promise<number[]>;
}