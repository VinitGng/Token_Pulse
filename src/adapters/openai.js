// src/adapters/openai.js
// TokenPulse: OpenAI Provider Adapter

import { BaseProviderAdapter } from './base.js';
import { normalizeModelName } from '../pricing.js';

export class OpenAIProviderAdapter extends BaseProviderAdapter {
  constructor(apiKey = process.env.OPENAI_API_KEY) {
    super('OpenAI');
    this.apiKey = apiKey;
    this.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  }

  hasCredentials() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  normalizeRequest(rawBody) {
    return {
      model: normalizeModelName(rawBody.model || 'gpt-4o'),
      messages: rawBody.messages || [{ role: 'user', content: rawBody.prompt || '' }],
      temperature: rawBody.temperature ?? 0.7,
      max_tokens: rawBody.max_tokens,
      stream: Boolean(rawBody.stream)
    };
  }

  async execute(normalizedRequest, options = {}) {
    const key = options.apiKey || this.apiKey;
    if (!key) {
      throw new Error('OPENAI_API_KEY is not configured on this server');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(normalizedRequest),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`OpenAI API error (${res.status}): ${errorBody.slice(0, 200)}`);
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content || '';
      const usage = json.usage || {};

      return {
        content,
        isSimulated: false,
        usageSource: 'provider_reported',
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          cached_tokens: usage.prompt_tokens_details?.cached_tokens || 0,
          total_tokens: usage.total_tokens || 0
        },
        rawResponse: json
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('OpenAI API request timed out after 15 seconds');
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
      provider: 'OpenAI',
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
