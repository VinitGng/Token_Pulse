// src/adapters/gemini.js
// TokenPulse: Google Gemini Provider Adapter

import { BaseProviderAdapter } from './base.js';

export class GeminiProviderAdapter extends BaseProviderAdapter {
  constructor(apiKey = process.env.GEMINI_API_KEY) {
    super('Google');
    this.apiKey = apiKey;
  }

  hasCredentials() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  normalizeRequest(rawBody) {
    let geminiModel = 'gemini-1.5-flash';
    const raw = String(rawBody.model || '').toLowerCase();
    if (raw.includes('pro')) geminiModel = 'gemini-1.5-pro';

    // Map OpenAI messages array to Gemini contents structure
    const contents = [];
    if (Array.isArray(rawBody.messages)) {
      for (const m of rawBody.messages) {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content || '') }]
        });
      }
    } else if (typeof rawBody.prompt === 'string') {
      contents.push({
        role: 'user',
        parts: [{ text: rawBody.prompt }]
      });
    }

    return {
      model: geminiModel,
      contents,
      generationConfig: {
        temperature: rawBody.temperature ?? 0.7,
        maxOutputTokens: rawBody.max_tokens ?? 1024
      }
    };
  }

  async execute(normalizedRequest, options = {}) {
    const key = options.apiKey || this.apiKey;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not configured on this server');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedRequest.model}:generateContent?key=${key}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: normalizedRequest.contents,
          generationConfig: normalizedRequest.generationConfig
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Google Gemini API error (${res.status}): ${errorBody.slice(0, 200)}`);
      }

      const json = await res.json();
      const content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usageMetadata = json.usageMetadata || {};

      const promptTokens = usageMetadata.promptTokenCount || 0;
      const completionTokens = usageMetadata.candidatesTokenCount || 0;
      const cachedTokens = usageMetadata.cachedContentTokenCount || 0;

      return {
        content,
        isSimulated: false,
        usageSource: 'provider_reported',
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          cached_tokens: cachedTokens,
          total_tokens: promptTokens + completionTokens + cachedTokens
        },
        rawResponse: json
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('Google Gemini API request timed out after 15 seconds');
      }
      throw err;
    }
  }

  normalizeResponse(result, model, reqId) {
    return {
      id: reqId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      provider: 'Google',
      is_simulated: false,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.content
          },
          finish_reason: 'stop'
        }
      ],
      usage: result.usage
    };
  }
}
