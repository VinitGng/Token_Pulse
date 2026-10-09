// src/adapters/anthropic.js
// TokenPulse: Anthropic Claude Provider Adapter

import { BaseProviderAdapter } from './base.js';

export class AnthropicProviderAdapter extends BaseProviderAdapter {
  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    super('Anthropic');
    this.apiKey = apiKey;
  }

  hasCredentials() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  normalizeRequest(rawBody) {
    let anthropicModel = 'claude-3-5-sonnet-20241022';
    const raw = String(rawBody.model || '').toLowerCase();
    if (raw.includes('haiku')) anthropicModel = 'claude-3-haiku-20240307';

    let system = '';
    const messages = [];

    if (Array.isArray(rawBody.messages)) {
      for (const m of rawBody.messages) {
        if (m.role === 'system') {
          system = String(m.content || '');
        } else {
          messages.push({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content || '')
          });
        }
      }
    } else if (typeof rawBody.prompt === 'string') {
      messages.push({ role: 'user', content: rawBody.prompt });
    }

    if (messages.length === 0) {
      messages.push({ role: 'user', content: 'Hello' });
    }

    return {
      model: anthropicModel,
      system,
      messages,
      max_tokens: rawBody.max_tokens ?? 1024,
      temperature: rawBody.temperature ?? 0.7
    };
  }

  async execute(normalizedRequest, options = {}) {
    const key = options.apiKey || this.apiKey;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is not configured on this server');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const payload = {
        model: normalizedRequest.model,
        messages: normalizedRequest.messages,
        max_tokens: normalizedRequest.max_tokens,
        temperature: normalizedRequest.temperature
      };
      if (normalizedRequest.system) {
        payload.system = normalizedRequest.system;
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Anthropic API error (${res.status}): ${errorBody.slice(0, 200)}`);
      }

      const json = await res.json();
      const content = json.content?.[0]?.text || '';
      const usage = json.usage || {};

      const promptTokens = usage.input_tokens || 0;
      const completionTokens = usage.output_tokens || 0;
      const cachedTokens = usage.cache_read_input_tokens || 0;

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
        throw new Error('Anthropic API request timed out after 15 seconds');
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
      provider: 'Anthropic',
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
