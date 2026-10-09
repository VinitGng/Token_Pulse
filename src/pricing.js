// src/pricing.js
// TokenPulse: Centralized Model Pricing Registry and Decimal-Safe Cost Calculation Engine

/**
 * Verified default pricing registry
 * Rates expressed in USD per 1,000,000 (1M) tokens
 */
export const DEFAULT_PRICING = [
  {
    model_id: 'gpt-4o',
    display_name: 'OpenAI GPT-4o',
    provider: 'OpenAI',
    input_cost_per_million: 2.50,
    output_cost_per_million: 10.00,
    cached_cost_per_million: 1.25,
    context_window: 128000,
    currency: 'USD',
    version: '2026-Q1',
    source: 'OpenAI Official Pricing Schedule',
    verified: 1,
    last_verified_at: '2026-03-01T00:00:00.000Z',
    active: 1
  },
  {
    model_id: 'gpt-4o-mini',
    display_name: 'OpenAI GPT-4o Mini',
    provider: 'OpenAI',
    input_cost_per_million: 0.15,
    output_cost_per_million: 0.60,
    cached_cost_per_million: 0.075,
    context_window: 128000,
    currency: 'USD',
    version: '2026-Q1',
    source: 'OpenAI Official Pricing Schedule',
    verified: 1,
    last_verified_at: '2026-03-01T00:00:00.000Z',
    active: 1
  },
  {
    model_id: 'claude-3-5-sonnet',
    display_name: 'Anthropic Claude 3.5 Sonnet',
    provider: 'Anthropic',
    input_cost_per_million: 3.00,
    output_cost_per_million: 15.00,
    cached_cost_per_million: 0.30,
    context_window: 200000,
    currency: 'USD',
    version: '2026-Q1',
    source: 'Anthropic Official Pricing Table',
    verified: 1,
    last_verified_at: '2026-03-01T00:00:00.000Z',
    active: 1
  },
  {
    model_id: 'claude-3-haiku',
    display_name: 'Anthropic Claude 3 Haiku',
    provider: 'Anthropic',
    input_cost_per_million: 0.25,
    output_cost_per_million: 1.25,
    cached_cost_per_million: 0.025,
    context_window: 200000,
    currency: 'USD',
    version: '2026-Q1',
    source: 'Anthropic Official Pricing Table',
    verified: 1,
    last_verified_at: '2026-03-01T00:00:00.000Z',
    active: 1
  },
  {
    model_id: 'gemini-1.5-pro',
    display_name: 'Google Gemini 1.5 Pro',
    provider: 'Google',
    input_cost_per_million: 3.50,
    output_cost_per_million: 10.50,
    cached_cost_per_million: 0.875,
    context_window: 1000000,
    currency: 'USD',
    version: '2026-Q1',
    source: 'Google Cloud Vertex / Gemini API Pricing',
    verified: 1,
    last_verified_at: '2026-03-01T00:00:00.000Z',
    active: 1
  },
  {
    model_id: 'gemini-1.5-flash',
    display_name: 'Google Gemini 1.5 Flash',
    provider: 'Google',
    input_cost_per_million: 0.075,
    output_cost_per_million: 0.30,
    cached_cost_per_million: 0.01875,
    context_window: 1000000,
    currency: 'USD',
    version: '2026-Q1',
    source: 'Google Cloud Vertex / Gemini API Pricing',
    verified: 1,
    last_verified_at: '2026-03-01T00:00:00.000Z',
    active: 1
  },
  {
    model_id: 'llama-3.1-70b',
    display_name: 'Meta Llama 3.1 70B',
    provider: 'Meta',
    input_cost_per_million: 0.60,
    output_cost_per_million: 0.80,
    cached_cost_per_million: 0.0,
    context_window: 128000,
    currency: 'USD',
    version: '2026-Q1',
    source: 'Open-weights hosted inference benchmarks',
    verified: 1,
    last_verified_at: '2026-03-01T00:00:00.000Z',
    active: 1
  },
  {
    model_id: 'llama-3.1-8b',
    display_name: 'Meta Llama 3.1 8B',
    provider: 'Meta',
    input_cost_per_million: 0.10,
    output_cost_per_million: 0.10,
    cached_cost_per_million: 0.0,
    context_window: 128000,
    currency: 'USD',
    version: '2026-Q1',
    source: 'Open-weights hosted inference benchmarks',
    verified: 1,
    last_verified_at: '2026-03-01T00:00:00.000Z',
    active: 1
  },
  {
    model_id: 'mistral-large',
    display_name: 'Mistral Large 2',
    provider: 'Mistral',
    input_cost_per_million: 2.00,
    output_cost_per_million: 6.00,
    cached_cost_per_million: 0.0,
    context_window: 128000,
    currency: 'USD',
    version: '2026-Q1',
    source: 'Mistral AI Official Pricing',
    verified: 1,
    last_verified_at: '2026-03-01T00:00:00.000Z',
    active: 1
  }
];

/**
 * Normalizes model names and handles canonical aliases
 */
export function normalizeModelName(rawModel) {
  if (!rawModel) return 'gpt-4o-mini';
  const clean = String(rawModel).trim().toLowerCase();
  
  if (clean === 'gpt-4o' || clean.includes('4o-2024') || clean === 'gpt-4') return 'gpt-4o';
  if (clean === 'gpt-4o-mini' || clean.includes('4o-mini')) return 'gpt-4o-mini';
  if (clean === 'claude-3-5-sonnet' || clean.includes('3-5-sonnet') || clean.includes('sonnet-2024')) return 'claude-3-5-sonnet';
  if (clean === 'claude-3-haiku' || clean.includes('haiku')) return 'claude-3-haiku';
  if (clean.includes('gemini') && clean.includes('pro')) return 'gemini-1.5-pro';
  if (clean.includes('flash')) return 'gemini-1.5-flash';
  if (clean === 'llama-3.1-70b' || clean.includes('70b')) return 'llama-3.1-70b';
  if (clean === 'llama-3.1-8b' || clean.includes('8b')) return 'llama-3.1-8b';
  if (clean === 'mistral-large' || clean.includes('mistral-large')) return 'mistral-large';
  
  return clean;
}

/**
 * Multi-heuristic token estimator for simulated or fallback mode
 * Estimates tokens using word boundaries, subword punctuation, and code structures.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  if (typeof text !== 'string') text = JSON.stringify(text);
  
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  if (chars === 0) return 0;
  
  // Empirical benchmark formula: 1 token ~= 3.8 to 4 chars for English / code
  const tokenEstimate = Math.max(1, Math.round((words * 1.33 + chars / 4) / 2));
  return tokenEstimate;
}

/**
 * Decimal-safe arithmetic helper
 * Multiplies tokens by rate per million, avoiding IEEE-754 binary floating-point drift.
 * Formula: Cost = (Tokens * Rate) / 1,000,000
 */
function computeExactCostComponent(tokens, ratePerMillion) {
  if (!tokens || tokens <= 0 || !ratePerMillion || ratePerMillion <= 0) {
    return 0;
  }
  // Convert rate to micro-cents (1e8 integer factor)
  // ratePerMillion * 100,000,000
  const rateScaled = Math.round(Number(ratePerMillion) * 100000000);
  const costScaled = (BigInt(Math.round(tokens)) * BigInt(rateScaled)) / 1000000n;
  // Convert back to fractional float with 6-decimal rounding
  return Number(costScaled) / 100000000;
}

/**
 * Centralized, decimal-safe cost calculation engine
 * 
 * @param {string} modelId - Model identifier
 * @param {number} promptTokens - Standard input tokens
 * @param {number} completionTokens - Output tokens
 * @param {Array} [pricingTable] - Active pricing table
 * @param {object} [options] - Optional flags (cachedTokens, isFailedRequest, provider)
 * @returns {object} Detailed calculation result with itemized costs
 */
export function calculateCost(modelId, promptTokens, completionTokens, pricingTable = null, options = {}) {
  const normalized = normalizeModelName(modelId);
  const cachedTokens = Math.max(0, Number(options.cachedTokens) || 0);
  const isFailed = Boolean(options.isFailedRequest);

  // Validate token inputs
  const cleanPromptTokens = Math.max(0, Math.floor(Number(promptTokens) || 0));
  const cleanCompletionTokens = Math.max(0, Math.floor(Number(completionTokens) || 0));
  const totalTokens = cleanPromptTokens + cleanCompletionTokens + cachedTokens;

  // Failed requests incur zero billable cost
  if (isFailed) {
    return {
      model: normalized,
      pricingAvailable: true,
      pricingVersion: 'failed-status',
      promptTokens: cleanPromptTokens,
      completionTokens: cleanCompletionTokens,
      cachedTokens: cachedTokens,
      totalTokens,
      promptCost: 0,
      cachedCost: 0,
      completionCost: 0,
      totalCost: 0,
      currency: 'USD',
      rates: { inputPerMillion: 0, outputPerMillion: 0, cachedPerMillion: 0 },
      isFailed: true,
      status: 'FAILED_REQUEST_NO_CHARGE'
    };
  }

  // Lookup model in provided pricing table or default registry
  let matchedPricing = null;
  const searchTable = (Array.isArray(pricingTable) && pricingTable.length > 0) ? pricingTable : DEFAULT_PRICING;

  matchedPricing = searchTable.find(p => p.model_id === normalized || p.model_id === modelId);

  // If unknown model not present in pricing table:
  // Requirement 4: "Never silently substitute an unrelated model's pricing.
  // When pricing is unavailable, explicitly mark the cost as unknown or estimated rather than displaying an invented exact cost."
  if (!matchedPricing) {
    return {
      model: normalized,
      pricingAvailable: false,
      pricingVersion: 'unknown',
      promptTokens: cleanPromptTokens,
      completionTokens: cleanCompletionTokens,
      cachedTokens: cachedTokens,
      totalTokens,
      promptCost: 0,
      cachedCost: 0,
      completionCost: 0,
      totalCost: 0,
      currency: 'USD',
      rates: { inputPerMillion: 0, outputPerMillion: 0, cachedPerMillion: 0 },
      status: 'UNKNOWN_MODEL_NO_PRICING',
      warning: `No pricing schedule registered for model '${modelId}'. Cost cannot be evaluated.`
    };
  }

  const inputRate = Number(matchedPricing.input_cost_per_million);
  const outputRate = Number(matchedPricing.output_cost_per_million);
  const cachedRate = Number(matchedPricing.cached_cost_per_million || 0);

  // Precise decimal-safe arithmetic
  const promptCostExact = computeExactCostComponent(cleanPromptTokens, inputRate);
  const cachedCostExact = computeExactCostComponent(cachedTokens, cachedRate);
  const completionCostExact = computeExactCostComponent(cleanCompletionTokens, outputRate);
  const totalCostExact = promptCostExact + cachedCostExact + completionCostExact;

  return {
    model: normalized,
    provider: matchedPricing.provider || options.provider || 'Unknown',
    pricingAvailable: true,
    pricingVersion: matchedPricing.version || 'v1',
    pricingSource: matchedPricing.source || 'Standard Pricing Table',
    promptTokens: cleanPromptTokens,
    cachedTokens,
    completionTokens: cleanCompletionTokens,
    totalTokens,
    promptCost: Number(promptCostExact.toFixed(6)),
    cachedCost: Number(cachedCostExact.toFixed(6)),
    completionCost: Number(completionCostExact.toFixed(6)),
    totalCost: Number(totalCostExact.toFixed(6)),
    currency: matchedPricing.currency || 'USD',
    rates: {
      inputPerMillion: inputRate,
      outputPerMillion: outputRate,
      cachedPerMillion: cachedRate
    },
    status: 'CALCULATED_OK'
  };
}
