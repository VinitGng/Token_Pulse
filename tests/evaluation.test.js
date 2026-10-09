// tests/evaluation.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runEvaluationSuite, BENCHMARK_CASES } from '../src/evaluation.js';
import { initDb } from '../src/db.js';

describe('TokenPulse Evaluation & Accuracy Suite', () => {
  it('should run all 16 benchmark cases and achieve 100% pass rate', async () => {
    initDb();
    const report = await runEvaluationSuite();

    assert.equal(report.summary.status, 'PASS');
    assert.equal(report.summary.accuracyPercentage, 100.0);
    assert.equal(report.unitTestMatrix.length, 16);
    assert.equal(report.summary.totalAbsoluteError, 0);

    // Verify all individual benchmark tests passed
    for (const test of report.unitTestMatrix) {
      assert.equal(test.status, 'PASS', `Benchmark ${test.testId} failed`);
      assert.equal(test.absError, 0);
    }

    // Verify batch totals match
    const agg = report.aggregateVerification;
    assert.equal(agg.requests.match, true);
    assert.equal(agg.promptTokens.match, true);
    assert.equal(agg.cachedTokens.match, true);
    assert.equal(agg.completionTokens.match, true);
    assert.equal(agg.totalCost.match, true);

    // Verify team attributions
    for (const tb of report.teamBreakdownVerification) {
      assert.equal(tb.status, 'PASS', `Team attribution for ${tb.team} failed`);
    }
  });
});
