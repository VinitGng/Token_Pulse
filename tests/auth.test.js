// tests/auth.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHeadersForLogging, createRateLimiter } from '../src/auth.js';

describe('TokenPulse Security & Auth Middleware', () => {
  it('should redact sensitive authorization and API key headers from logs', () => {
    const rawHeaders = {
      'authorization': 'Bearer sk-proj-12345secret',
      'x-api-key': 'secret-proxy-token',
      'x-admin-key': 'super-admin-secret',
      'x-team': 'Core Engineering',
      'x-feature': 'Code Review Assistant'
    };

    const sanitized = sanitizeHeadersForLogging(rawHeaders);
    assert.equal(sanitized['authorization'], '[REDACTED]');
    assert.equal(sanitized['x-api-key'], '[REDACTED]');
    assert.equal(sanitized['x-admin-key'], '[REDACTED]');
    assert.equal(sanitized['x-team'], 'Core Engineering');
    assert.equal(sanitized['x-feature'], 'Code Review Assistant');
  });

  it('should allow requests within rate limit threshold and block excess', () => {
    const limiter = createRateLimiter(2, 60000); // 2 requests per minute
    let status = 200;
    let nextCalled = 0;

    const req = { ip: '192.168.1.100' };
    const res = {
      status: (code) => {
        status = code;
        return { json: () => {} };
      }
    };
    const next = () => { nextCalled++; };

    // Request 1
    limiter(req, res, next);
    assert.equal(nextCalled, 1);

    // Request 2
    limiter(req, res, next);
    assert.equal(nextCalled, 2);

    // Request 3 (exceeds limit)
    limiter(req, res, next);
    assert.equal(status, 429);
    assert.equal(nextCalled, 2); // next() should not be called
  });
});
