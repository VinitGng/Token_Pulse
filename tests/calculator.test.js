// tests/calculator.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCost, estimateTokens, normalizeModelName } from '../src/pricing.js';

describe('TokenPulse Cost & Usage Calculator', () => {
  it('should calculate standard input and output cost correctly for GPT-4o', () => {
    // 1,000 prompt @ $2.50/1M = $0.0025, 500 comp @ $10.00/1M = $0.0050 -> $0.0075
    const res = calculateCost('gpt-4o', 1000, 500);
    assert.equal(res.promptCost, 0.002500);
    assert.equal(res.completionCost, 0.005000);
    assert.equal(res.totalCost, 0.007500);
    assert.equal(res.totalTokens, 1500);
    assert.equal(res.pricingAvailable, true);
  });

  it('should calculate discounted cached-input tokens when provided', () => {
    // GPT-4o: prompt 2,000 ($0.005), cached 4,000 @ $1.25/1M ($0.005), comp 500 ($0.005) -> $0.0150
    const res = calculateCost('gpt-4o', 2000, 500, null, { cachedTokens: 4000 });
    assert.equal(res.promptCost, 0.005000);
    assert.equal(res.cachedCost, 0.005000);
    assert.equal(res.completionCost, 0.005000);
    assert.equal(res.totalCost, 0.015000);
    assert.equal(res.totalTokens, 6500);
  });

  it('should handle zero-token requests with exact zero cost', () => {
    const res = calculateCost('gpt-4o-mini', 0, 0);
    assert.equal(res.totalCost, 0);
    assert.equal(res.totalTokens, 0);
    assert.equal(res.status, 'CALCULATED_OK');
  });

  it('should not bill for failed provider requests (HTTP 500 error)', () => {
    const res = calculateCost('gpt-4o', 2000, 1000, null, { isFailedRequest: true });
    assert.equal(res.totalCost, 0);
    assert.equal(res.isFailed, true);
    assert.equal(res.status, 'FAILED_REQUEST_NO_CHARGE');
  });

  it('should flag unknown models without silently substituting unrelated pricing', () => {
    const res = calculateCost('nonexistent-llm-99', 1000, 500);
    assert.equal(res.pricingAvailable, false);
    assert.equal(res.totalCost, 0);
    assert.equal(res.status, 'UNKNOWN_MODEL_NO_PRICING');
    assert.ok(res.warning.includes('No pricing schedule registered'));
  });

  it('should normalize canonical model aliases', () => {
    assert.equal(normalizeModelName('GPT-4o-2024-05-13'), 'gpt-4o');
    assert.equal(normalizeModelName('gpt-4'), 'gpt-4o');
    assert.equal(normalizeModelName('gemini-1.5-flash-latest'), 'gemini-1.5-flash');
    assert.equal(normalizeModelName('claude-3-5-sonnet-20241022'), 'claude-3-5-sonnet');
  });

  it('should estimate token counts reasonably', () => {
    const sample = 'Hello world, this is a test prompt for TokenPulse telemetry.';
    const tokens = estimateTokens(sample);
    assert.ok(tokens >= 8 && tokens <= 20);
    assert.equal(estimateTokens(''), 0);
  });
});
