"use strict";
// backend/src/services/ai/ai-failover.manager.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIFailoverManager = void 0;
const ai_provider_interface_1 = require("./ai-provider.interface");
class AIFailoverManager {
    name = 'FAILOVER_MANAGER';
    providers;
    constructor(providers) {
        this.providers = providers;
    }
    async generateText(options) {
        return (await this.generateTextWithProvider(options)).text;
    }
    async generateTextWithProvider(options) {
        let lastError = null;
        for (let i = 0; i < this.providers.length; i++) {
            const provider = this.providers[i];
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    return { text: await provider.generateText(options), provider: provider.name };
                }
                catch (error) {
                    lastError = error;
                    const retryable = error instanceof ai_provider_interface_1.AIProviderError ? error.retryable : false;
                    if (!retryable) {
                        throw error instanceof ai_provider_interface_1.AIProviderError ? error : new ai_provider_interface_1.AIProviderError('The configured AI provider rejected the request.', false);
                    }
                    if (attempt === 0)
                        await new Promise((resolve) => setTimeout(resolve, 250));
                }
            }
        }
        if (this.providers.length === 0)
            throw new ai_provider_interface_1.AIProviderError('No AI text provider is configured.', false);
        const retryable = lastError instanceof ai_provider_interface_1.AIProviderError && lastError.retryable;
        throw new ai_provider_interface_1.AIProviderError('All configured AI providers are temporarily unavailable.', retryable);
    }
    async generateEmbedding(text) {
        let lastError = null;
        for (const provider of this.providers) {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    return await provider.generateEmbedding(text);
                }
                catch (error) {
                    lastError = error;
                    if (error instanceof ai_provider_interface_1.AIProviderError && !error.retryable)
                        break;
                    if (attempt === 0)
                        await new Promise((resolve) => setTimeout(resolve, 250));
                }
            }
        }
        if (lastError instanceof ai_provider_interface_1.AIProviderError)
            throw lastError;
        throw new ai_provider_interface_1.AIProviderError('No configured provider can create document embeddings.', false);
    }
}
exports.AIFailoverManager = AIFailoverManager;
