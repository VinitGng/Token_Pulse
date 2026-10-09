// src/adapters/index.js
// TokenPulse: Central Provider Adapter Registry and Dispatcher

import { SimulatedProviderAdapter } from './simulated.js';
import { OpenAIProviderAdapter } from './openai.js';
import { GeminiProviderAdapter } from './gemini.js';
import { AnthropicProviderAdapter } from './anthropic.js';

export { BaseProviderAdapter } from './base.js';
export { SimulatedProviderAdapter } from './simulated.js';
export { OpenAIProviderAdapter } from './openai.js';
export { GeminiProviderAdapter } from './gemini.js';
export { AnthropicProviderAdapter } from './anthropic.js';

/**
 * Resolves the appropriate provider adapter based on model name, provider hint, and configured keys
 * 
 * @param {string} modelName - Requested model ID
 * @param {object} options - Request options (headers, forceSimulation, upstreamKey)
 * @returns {{ adapter: BaseProviderAdapter, providerName: string, isSimulatedFallback: boolean }}
 */
export function resolveAdapter(modelName = '', options = {}) {
  const cleanModel = String(modelName).toLowerCase();
  const forceSimulated = Boolean(options.forceSimulated);

  // If client explicitly requests simulation mode
  if (forceSimulated || options.provider === 'simulated') {
    return {
      adapter: new SimulatedProviderAdapter(),
      providerName: 'simulated',
      isSimulatedFallback: false
    };
  }

  // 1. Google Gemini
  if (cleanModel.includes('gemini') || options.provider === 'google') {
    const gemini = new GeminiProviderAdapter(options.upstreamKey || process.env.GEMINI_API_KEY);
    if (gemini.hasCredentials()) {
      return { adapter: gemini, providerName: 'Google', isSimulatedFallback: false };
    }
    // Fallback to simulated provider when no API key configured
    return {
      adapter: new SimulatedProviderAdapter(),
      providerName: 'simulated',
      isSimulatedFallback: true,
      reason: 'No GEMINI_API_KEY configured. Running in offline simulation mode.'
    };
  }

  // 2. Anthropic Claude
  if (cleanModel.includes('claude') || options.provider === 'anthropic') {
    const anthropic = new AnthropicProviderAdapter(options.upstreamKey || process.env.ANTHROPIC_API_KEY);
    if (anthropic.hasCredentials()) {
      return { adapter: anthropic, providerName: 'Anthropic', isSimulatedFallback: false };
    }
    return {
      adapter: new SimulatedProviderAdapter(),
      providerName: 'simulated',
      isSimulatedFallback: true,
      reason: 'No ANTHROPIC_API_KEY configured. Running in offline simulation mode.'
    };
  }

  // 3. OpenAI
  if (cleanModel.includes('gpt') || cleanModel.includes('o1') || cleanModel.includes('o3') || options.provider === 'openai') {
    const openai = new OpenAIProviderAdapter(options.upstreamKey || process.env.OPENAI_API_KEY);
    if (openai.hasCredentials()) {
      return { adapter: openai, providerName: 'OpenAI', isSimulatedFallback: false };
    }
    return {
      adapter: new SimulatedProviderAdapter(),
      providerName: 'simulated',
      isSimulatedFallback: true,
      reason: 'No OPENAI_API_KEY configured. Running in offline simulation mode.'
    };
  }

  // Default to simulation adapter for all open weights or generic requests
  return {
    adapter: new SimulatedProviderAdapter(),
    providerName: 'simulated',
    isSimulatedFallback: false
  };
}
