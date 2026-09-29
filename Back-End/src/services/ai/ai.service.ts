// backend/src/services/ai/ai.service.ts
import { GroqProvider } from './providers/groq.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { AIFailoverManager } from './ai-failover.manager';
import { ENV } from '../../config/env';

const providers = [
  ...(ENV.GROQ_API_KEY ? [new GroqProvider(ENV.GROQ_API_KEY, 'openai/gpt-oss-20b')] : []),
  ...(ENV.GEMINI_API_KEY ? [new GeminiProvider(ENV.GEMINI_API_KEY, 'gemini-3.8-flash')] : []),
];

export const aiAdapter = new AIFailoverManager(providers);
