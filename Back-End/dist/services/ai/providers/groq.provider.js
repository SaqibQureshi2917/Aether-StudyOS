"use strict";
// backend/src/services/ai/providers/groq.provider.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroqProvider = void 0;
const ai_provider_interface_1 = require("../ai-provider.interface");
class GroqProvider {
    name = 'GROQ';
    apiKey;
    model;
    constructor(apiKey, model = 'openai/gpt-oss-20b') {
        this.apiKey = apiKey;
        this.model = model;
    }
    async generateText(options) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: options.images?.length ? 'qwen/qwen3.8-27b' : this.model,
                    messages: [
                        ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
                        { role: 'user', content: options.images?.length ? [
                                { type: 'text', text: options.prompt },
                                ...options.images.map((image) => ({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } })),
                            ] : options.prompt },
                    ],
                    temperature: options.temperature ?? 0.7,
                    max_completion_tokens: options.maxTokens ?? 1024,
                    response_format: options.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
                }),
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new ai_provider_interface_1.AIProviderError(`Groq request failed with status ${response.status}.`, response.status === 408 || response.status === 429 || response.status >= 500, response.status);
            }
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (typeof content !== 'string' || !content.trim())
                throw new ai_provider_interface_1.AIProviderError('Groq returned an empty response.', true);
            return content;
        }
        catch (error) {
            if (error instanceof ai_provider_interface_1.AIProviderError)
                throw error;
            throw new ai_provider_interface_1.AIProviderError(controller.signal.aborted ? 'Groq request timed out.' : 'Groq could not be reached.', true);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async generateEmbedding(text) {
        void text;
        throw new ai_provider_interface_1.AIProviderError('Groq embeddings are not configured.', false);
    }
}
exports.GroqProvider = GroqProvider;
