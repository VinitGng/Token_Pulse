// tests/budgets.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { initDb, db } from '../src/db.js';
import { evaluateEntityBudget, checkPreRequestBudget, getAllBudgetsWithMetrics } from '../src/budgets.js';

describe('TokenPulse Budget Management & Policy Enforcement', () => {
  before(() => {
    initDb();
  });

  it('should retrieve budgets with utilization metrics', () => {
    const budgets = getAllBudgetsWithMetrics(db);
    assert.ok(Array.isArray(budgets));
    assert.ok(budgets.length >= 5);

    const engBudget = budgets.find(b => b.entity_id === 'Core Engineering');
    assert.ok(engBudget);
    assert.equal(engBudget.limit_usd, 50.0);
    assert.ok(typeof engBudget.utilization_pct === 'number');
    assert.ok(['HEALTHY', 'WARNING', 'EXCEEDED'].includes(engBudget.status));
  });

  it('should allow requests when budget is within limits', () => {
    const check = checkPreRequestBudget(db, 'Core Engineering', 'Code Review Assistant');
    assert.equal(check.allowed, true);
  });

  it('should evaluate and flag exceeded status correctly', () => {
    // Insert temporary test budget with $0.001 limit and enforce mode
    db.exec(`
      INSERT OR REPLACE INTO budgets (id, entity_type, entity_id, period, limit_usd, alert_threshold, enforcement_mode, updated_at)
      VALUES ('bgt_test_over', 'team', 'Test Overbudget Team', 'monthly', 0.000001, 0.80, 'enforce', '2026-01-01');

      INSERT INTO requests (
        id, timestamp, iso_timestamp, team, feature, user_id, model, provider,
        prompt_tokens, completion_tokens, cached_tokens, total_tokens,
        prompt_cost, completion_cost, cached_cost, total_cost,
        latency_ms, status_code, is_stream, is_simulated, usage_source, pricing_version
      ) VALUES (
        'req_test_spend', 2000000000000, '2033-01-01T00:00:00Z', 'Test Overbudget Team', 'Test Feat', 'tester', 'gpt-4o', 'simulated',
        100, 100, 0, 200, 0.01, 0.01, 0, 0.02, 100, 200, 0, 1, 'simulated', 'v1'
      );
    `);

    const evalResult = evaluateEntityBudget(db, 'team', 'Test Overbudget Team');
    assert.ok(evalResult);
    assert.equal(evalResult.status, 'EXCEEDED');

    const check = checkPreRequestBudget(db, 'Test Overbudget Team', 'Test Feat');
    assert.equal(check.allowed, false);
    assert.ok(check.reason.includes('budget exceeded'));

    // Clean up test records
    db.exec(`
      DELETE FROM budgets WHERE id = 'bgt_test_over';
      DELETE FROM requests WHERE id = 'req_test_spend';
    `);
  });
});
