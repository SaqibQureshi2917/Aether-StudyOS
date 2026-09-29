"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiAdapter = void 0;
// backend/src/services/ai/ai.service.ts
const groq_provider_1 = require("./providers/groq.provider");
const gemini_provider_1 = require("./providers/gemini.provider");
const ai_failover_manager_1 = require("./ai-failover.manager");
const env_1 = require("../../config/env");
const providers = [
    ...(env_1.ENV.GROQ_API_KEY ? [new groq_provider_1.GroqProvider(env_1.ENV.GROQ_API_KEY, 'openai/gpt-oss-20b')] : []),
    ...(env_1.ENV.GEMINI_API_KEY ? [new gemini_provider_1.GeminiProvider(env_1.ENV.GEMINI_API_KEY, 'gemini-3.8-flash')] : []),
];
exports.aiAdapter = new ai_failover_manager_1.AIFailoverManager(providers);
