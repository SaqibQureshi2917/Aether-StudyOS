// backend/src/services/ai/ai.service.ts
import { GroqProvider } from './providers/groq.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { AIFailoverManager } from './ai-failover.manager';

// Yeh tumhara single unified adapter/manager hai jo dono ko wrap karta hai
const groq = new GroqProvider(process.env.GROQ_API_KEY!, 'openai/gpt-oss-20b');
const gemini = new GeminiProvider(process.env.GEMINI_API_KEY!, 'gemini-1.5-pro');

// Failover Manager: Pehle Groq try karega, agar limit/error aya toh bina user ko bataye Gemini pe shift ho jayega
export const aiAdapter = new AIFailoverManager([groq, gemini]);