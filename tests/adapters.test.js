// tests/adapters.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAdapter, SimulatedProviderAdapter, OpenAIProviderAdapter, GeminiProviderAdapter, AnthropicProviderAdapter } from '../src/adapters/index.js';

describe('TokenPulse Provider Adapters', () => {
  it('should resolve SimulatedProviderAdapter when forced or in offline mode', async () => {
    const { adapter, providerName } = resolveAdapter('gpt-4o', { forceSimulated: true });
    assert.equal(providerName, 'simulated');
    assert.ok(adapter instanceof SimulatedProviderAdapter);

    const req = adapter.normalizeRequest({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Test prompt' }]
    });
    const res = await adapter.execute(req, { simulatedDelay: 10 });
    assert.equal(res.isSimulated, true);
    assert.ok(res.usage.prompt_tokens > 0);
    assert.ok(res.usage.completion_tokens > 0);
  });

  it('should fall back gracefully to simulation mode when API keys are absent', () => {
    // With no GEMINI_API_KEY set, should return simulated fallback with informative warning
    const { adapter, isSimulatedFallback } = resolveAdapter('gemini-1.5-flash', {});
    assert.ok(adapter instanceof SimulatedProviderAdapter);
    assert.equal(isSimulatedFallback, true);
  });

  it('should normalize OpenAI requests correctly', () => {
    const adapter = new OpenAIProviderAdapter('dummy-key');
    const norm = adapter.normalizeRequest({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.5
    });
    assert.equal(norm.model, 'gpt-4o');
    assert.equal(norm.messages.length, 1);
  });

  it('should normalize Gemini requests correctly', () => {
    const adapter = new GeminiProviderAdapter('dummy-key');
    const norm = adapter.normalizeRequest({
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content: 'Explain quantum computing' }]
    });
    assert.equal(norm.model, 'gemini-1.5-pro');
    assert.equal(norm.contents[0].role, 'user');
    assert.equal(norm.contents[0].parts[0].text, 'Explain quantum computing');
  });

  it('should normalize Anthropic requests correctly', () => {
    const adapter = new AnthropicProviderAdapter('dummy-key');
    const norm = adapter.normalizeRequest({
      model: 'claude-3-5-sonnet',
      messages: [
        { role: 'system', content: 'You are an assistant' },
        { role: 'user', content: 'Draft an email' }
      ]
    });
    assert.equal(norm.system, 'You are an assistant');
    assert.equal(norm.messages.length, 1);
  });
});
