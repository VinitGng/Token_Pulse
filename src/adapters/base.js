// src/adapters/base.js
// TokenPulse: Base Provider Adapter Interface

export class BaseProviderAdapter {
  constructor(providerName) {
    this.providerName = providerName;
  }

  /**
   * Checks whether this adapter has real provider credentials configured
   * @returns {boolean}
   */
  hasCredentials() {
    return false;
  }

  /**
   * Normalizes inbound request payload
   */
  normalizeRequest(rawBody) {
    throw new Error('normalizeRequest must be implemented by adapter subclass');
  }

  /**
   * Executes the chat completion call against the provider
   * @param {object} normalizedRequest
   * @param {object} options
   * @returns {Promise<object>} Standardized provider result
   */
  async execute(normalizedRequest, options = {}) {
    throw new Error('execute must be implemented by adapter subclass');
  }

  /**
   * Normalizes the provider response to OpenAI-compatible schema
   */
  normalizeResponse(rawResponse, usage, model, reqId) {
    throw new Error('normalizeResponse must be implemented by adapter subclass');
  }
}
