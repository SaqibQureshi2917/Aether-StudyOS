"use strict";
// backend/src/services/ai/ai-provider.interface.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderError = void 0;
class AIProviderError extends Error {
    retryable;
    statusCode;
    constructor(message, retryable, statusCode) {
        super(message);
        this.retryable = retryable;
        this.statusCode = statusCode;
        this.name = 'AIProviderError';
    }
}
exports.AIProviderError = AIProviderError;
