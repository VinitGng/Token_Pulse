// src/adapters/simulated.js
// TokenPulse: Deterministic and Realistic Simulated AI Provider Adapter

import { BaseProviderAdapter } from './base.js';
import { estimateTokens, normalizeModelName } from '../pricing.js';

export class SimulatedProviderAdapter extends BaseProviderAdapter {
  constructor() {
    super('simulated');
  }

  hasCredentials() {
    return true; // Always operational offline
  }

  normalizeRequest(rawBody) {
    const model = normalizeModelName(rawBody.model || 'gpt-4o');
    let promptText = '';

    if (Array.isArray(rawBody.messages)) {
      promptText = rawBody.messages.map(m => `${m.role}: ${m.content}`).join('\n');
    } else if (typeof rawBody.prompt === 'string') {
      promptText = rawBody.prompt;
    }

    return {
      model,
      promptText,
      stream: Boolean(rawBody.stream),
      temperature: rawBody.temperature ?? 0.7,
      max_tokens: rawBody.max_tokens ?? 1024,
      usage: rawBody.usage || null
    };
  }

  /**
   * Generates realistic, contextual response text based on prompt themes
   */
  generateText(promptText, model) {
    const lower = (promptText || '').toLowerCase();

    if (lower.includes('code') || lower.includes('function') || lower.includes('bug') || lower.includes('refactor') || lower.includes('sql')) {
      return `### Solution Architecture & Code Optimization\n\nHere is the verified implementation with O(N) complexity:\n\n\`\`\`javascript\nexport function processDataPipeline(items, options = {}) {\n  const results = [];\n  for (const item of items) {\n    if (item && item.id) {\n      results.push({ id: item.id, status: 'processed', timestamp: Date.now() });\n    }\n  }\n  return { success: true, count: results.length, data: results };\n}\n\`\`\`\n\n**Key Optimizations:**\n1. Deterministic linear execution with early return guards.\n2. Zero memory leak allocation.\n3. Resilient edge case error handling.`;
    }

    if (lower.includes('summar') || lower.includes('ticket') || lower.includes('issue')) {
      return `### Executive Incident Summary\n\n**Root Cause:** Temporary connection pool exhaustion caused elevated gateway latency.\n**Impact:** Authentication endpoints experienced degraded throughput for 8 minutes.\n**Resolution:** Connection pool maximum size adjusted and exponential retry backoff deployed.\n**Status:** All operational health checks normal.`;
    }

    if (lower.includes('marketing') || lower.includes('email') || lower.includes('blog') || lower.includes('copy')) {
      return `### Enterprise AI FinOps Copywriting Proposal\n\n**Headline:** Full Visibility Into LLM Token Consumption\n\n**Value Proposition:**\nStop shadow AI spending before it impacts your bottom line. TokenPulse provides real-time multi-tenant cost attribution and policy enforcement across every engineering squad.\n\n**Call to Action:** Explore the TokenPulse live observability dashboard today.`;
    }

    if (lower.includes('sentiment') || lower.includes('feedback') || lower.includes('review')) {
      return `### Sentiment Classification Report\n\n- **Overall Sentiment:** Highly Positive (Score: 0.92 / 1.0)\n- **Primary Drivers:** Real-time token visibility, transparent pricing formulas, seamless gateway drop-in.\n- **Action Item:** Share findings with Product Growth team for quarterly review.`;
    }

    return `[SIMULATED PROVIDER RESPONSE]\nProcessed request for model '${model}'. Input evaluation complete. Token counts and financial costs have been computed using standard rates and recorded to telemetry.`;
  }

  async execute(normalizedRequest, options = {}) {
    const delay = Number(options.simulatedDelay) || Math.floor(100 + Math.random() * 120);
    await new Promise(resolve => setTimeout(resolve, delay));

    const content = this.generateText(normalizedRequest.promptText, normalizedRequest.model);

    // Compute token counts
    let promptTokens = normalizedRequest.usage?.prompt_tokens;
    let completionTokens = normalizedRequest.usage?.completion_tokens;
    let cachedTokens = normalizedRequest.usage?.cached_tokens || 0;

    if (!promptTokens) {
      promptTokens = Math.max(12, estimateTokens(normalizedRequest.promptText || 'Hello AI'));
    }
    if (!completionTokens) {
      completionTokens = Math.max(20, estimateTokens(content));
    }

    return {
      content,
      isSimulated: true,
      usageSource: 'simulated',
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cached_tokens: cachedTokens,
        total_tokens: promptTokens + completionTokens + cachedTokens
      }
    };
  }

  normalizeResponse(result, model, reqId) {
    return {
      id: reqId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      provider: 'simulated',
      is_simulated: true,
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
