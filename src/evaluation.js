// src/evaluation.js
// TokenPulse: Deterministic Evaluation & Verification Engine Against Ground Truth

import { calculateCost } from './pricing.js';
import { logRequest, getAnalytics, getPricingTable, db } from './db.js';

/**
 * 16 Deterministic Benchmark Test Cases
 * Ground truth costs calculated INDEPENDENTLY via mathematical formula:
 * Cost = (Prompt / 1M * InputRate) + (Cached / 1M * CachedRate) + (Comp / 1M * OutputRate)
 */
export const BENCHMARK_CASES = [
  {
    id: 'BENCH-01',
    description: 'GPT-4o Standard Architecture Query',
    team: 'Core Engineering',
    feature: 'Architecture Copilot',
    user: 'sarah.lead',
    model: 'gpt-4o',
    provider: 'OpenAI',
    promptTokens: 1000,
    cachedTokens: 0,
    completionTokens: 500,
    statusCode: 200,
    expectedRates: { input: 2.50, output: 10.00, cached: 1.25 },
    expectedCost: 0.007500
  },
  {
    id: 'BENCH-02',
    description: 'GPT-4o-Mini Batch CI Log Triage',
    team: 'Core Engineering',
    feature: 'CI Bug Triager',
    user: 'alex.dev',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    promptTokens: 10000,
    cachedTokens: 0,
    completionTokens: 2500,
    statusCode: 200,
    expectedRates: { input: 0.15, output: 0.60, cached: 0.075 },
    expectedCost: 0.003000
  },
  {
    id: 'BENCH-03',
    description: 'Claude 3.5 Sonnet Deep SQL Generation',
    team: 'Data Science',
    feature: 'SQL Query Generator',
    user: 'dr.chen',
    model: 'claude-3-5-sonnet',
    provider: 'Anthropic',
    promptTokens: 8000,
    cachedTokens: 0,
    completionTokens: 1200,
    statusCode: 200,
    expectedRates: { input: 3.00, output: 15.00, cached: 0.30 },
    expectedCost: 0.042000
  },
  {
    id: 'BENCH-04',
    description: 'Gemini 1.5 Flash High-Volume Support Triage',
    team: 'Customer Support',
    feature: 'Ticket Summarizer',
    user: 'carlos.support',
    model: 'gemini-1.5-flash',
    provider: 'Google',
    promptTokens: 100000,
    cachedTokens: 0,
    completionTokens: 20000,
    statusCode: 200,
    expectedRates: { input: 0.075, output: 0.30, cached: 0.01875 },
    expectedCost: 0.013500
  },
  {
    id: 'BENCH-05',
    description: 'Claude 3 Haiku Tier-1 Auto Responder',
    team: 'Customer Support',
    feature: 'Auto Responder Bot',
    user: 'emma.rep',
    model: 'claude-3-haiku',
    provider: 'Anthropic',
    promptTokens: 4000,
    cachedTokens: 0,
    completionTokens: 800,
    statusCode: 200,
    expectedRates: { input: 0.25, output: 1.25, cached: 0.025 },
    expectedCost: 0.002000
  },
  {
    id: 'BENCH-06',
    description: 'Llama 3.1 70B Data Pipeline Explainer',
    team: 'Data Science',
    feature: 'Data Pipeline Explainer',
    user: 'matthew.data',
    model: 'llama-3.1-70b',
    provider: 'Meta',
    promptTokens: 5000,
    cachedTokens: 0,
    completionTokens: 2000,
    statusCode: 200,
    expectedRates: { input: 0.60, output: 0.80, cached: 0.0 },
    expectedCost: 0.004600
  },
  {
    id: 'BENCH-07',
    description: 'Gemini 1.5 Pro Comprehensive Code Review',
    team: 'Core Engineering',
    feature: 'Code Review Assistant',
    user: 'jordan.eng',
    model: 'gemini-1.5-pro',
    provider: 'Google',
    promptTokens: 20000,
    cachedTokens: 0,
    completionTokens: 4000,
    statusCode: 200,
    expectedRates: { input: 3.50, output: 10.50, cached: 0.875 },
    expectedCost: 0.112000
  },
  {
    id: 'BENCH-08',
    description: 'GPT-4o Live Chat with Cached Prompt Discount',
    team: 'Customer Support',
    feature: 'Live Chat Assistant',
    user: 'liam.agent',
    model: 'gpt-4o',
    provider: 'OpenAI',
    promptTokens: 2000,
    cachedTokens: 4000,
    completionTokens: 500,
    statusCode: 200,
    expectedRates: { input: 2.50, output: 10.00, cached: 1.25 },
    expectedCost: 0.015000
  },
  {
    id: 'BENCH-09',
    description: 'Claude 3.5 Sonnet Marketing with Prompt Cache Read',
    team: 'Marketing & Content',
    feature: 'SEO Blog Drafter',
    user: 'chloe.mkt',
    model: 'claude-3-5-sonnet',
    provider: 'Anthropic',
    promptTokens: 5000,
    cachedTokens: 10000,
    completionTokens: 1000,
    statusCode: 200,
    expectedRates: { input: 3.00, output: 15.00, cached: 0.30 },
    expectedCost: 0.033000
  },
  {
    id: 'BENCH-10',
    description: 'Zero-Token Edge Request Verification',
    team: 'Core Engineering',
    feature: 'Architecture Copilot',
    user: 'priya.sre',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    promptTokens: 0,
    cachedTokens: 0,
    completionTokens: 0,
    statusCode: 200,
    expectedRates: { input: 0.15, output: 0.60, cached: 0.075 },
    expectedCost: 0.000000
  },
  {
    id: 'BENCH-11',
    description: 'Failed Provider Request (HTTP 500 Zero Cost)',
    team: 'Customer Support',
    feature: 'Ticket Summarizer',
    user: 'carlos.support',
    model: 'gpt-4o',
    provider: 'OpenAI',
    promptTokens: 1500,
    cachedTokens: 0,
    completionTokens: 0,
    statusCode: 500,
    expectedRates: { input: 2.50, output: 10.00, cached: 1.25 },
    expectedCost: 0.000000
  },
  {
    id: 'BENCH-12',
    description: 'Unknown Model / Missing Pricing Guard',
    team: 'Core Engineering',
    feature: 'CI Bug Triager',
    user: 'alex.dev',
    model: 'unknown-mystery-model-v9',
    provider: 'Unknown',
    promptTokens: 3000,
    cachedTokens: 0,
    completionTokens: 1000,
    statusCode: 200,
    expectedRates: { input: 0, output: 0, cached: 0 },
    expectedCost: 0.000000
  },
  {
    id: 'BENCH-13',
    description: 'Unassigned Attribution Policy Request',
    team: 'Unassigned',
    feature: 'Unassigned',
    user: 'ext_developer_01',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    promptTokens: 2000,
    cachedTokens: 0,
    completionTokens: 500,
    statusCode: 200,
    expectedRates: { input: 0.15, output: 0.60, cached: 0.075 },
    expectedCost: 0.000600
  },
  {
    id: 'BENCH-14',
    description: 'High Token Volume Ad Batch (1M tokens)',
    team: 'Marketing & Content',
    feature: 'Ad Copy Optimizer',
    user: 'david.copy',
    model: 'gemini-1.5-flash',
    provider: 'Google',
    promptTokens: 800000,
    cachedTokens: 0,
    completionTokens: 200000,
    statusCode: 200,
    expectedRates: { input: 0.075, output: 0.30, cached: 0.01875 },
    expectedCost: 0.120000
  },
  {
    id: 'BENCH-15',
    description: 'Product Growth NPS Sentiment Classifier',
    team: 'Product Growth',
    feature: 'Customer Sentiment Analyzer',
    user: 'claire.growth',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    promptTokens: 6000,
    cachedTokens: 0,
    completionTokens: 1500,
    statusCode: 200,
    expectedRates: { input: 0.15, output: 0.60, cached: 0.075 },
    expectedCost: 0.001800
  },
  {
    id: 'BENCH-16',
    description: 'Mistral Large Complex Enterprise Triage',
    team: 'Core Engineering',
    feature: 'Code Review Assistant',
    user: 'sarah.lead',
    model: 'mistral-large',
    provider: 'Mistral',
    promptTokens: 4000,
    cachedTokens: 0,
    completionTokens: 1000,
    statusCode: 200,
    expectedRates: { input: 2.00, output: 6.00, cached: 0.0 },
    expectedCost: 0.014000
  }
];

/**
 * Executes evaluation suite verifying calculator, logging, and aggregation
 */
export async function runEvaluationSuite() {
  const pricingTable = getPricingTable();
  const evaluationTimestamp = new Date().toISOString();
  const testBatchTag = `eval_batch_${Date.now()}`;

  // STEP 1: Unit Calculator Benchmark Verification
  const unitResults = [];
  let unitPassedCount = 0;
  let totalAbsError = 0;
  let maxAbsError = 0;

  for (const test of BENCHMARK_CASES) {
    const calc = calculateCost(test.model, test.promptTokens, test.completionTokens, pricingTable, {
      cachedTokens: test.cachedTokens,
      isFailedRequest: test.statusCode >= 400
    });

    const expectedCost = test.expectedCost;
    const actualCost = calc.totalCost;
    const absError = Math.abs(actualCost - expectedCost);
    totalAbsError += absError;
    if (absError > maxAbsError) maxAbsError = absError;

    // Safe relative error computation
    let relError = 0;
    if (expectedCost > 0) {
      relError = absError / expectedCost;
    } else {
      relError = actualCost === 0 ? 0 : 1.0;
    }

    // Pass tolerance: 0.000002 ($0.000002 / 2 millionths of a dollar)
    const passed = absError < 0.000002;
    if (passed) unitPassedCount++;

    unitResults.push({
      testId: test.id,
      description: test.description,
      model: test.model,
      provider: test.provider,
      team: test.team,
      feature: test.feature,
      promptTokens: test.promptTokens,
      cachedTokens: test.cachedTokens,
      completionTokens: test.completionTokens,
      totalTokens: test.promptTokens + test.cachedTokens + test.completionTokens,
      expectedCost,
      actualCost,
      absError: Number(absError.toFixed(6)),
      relError: Number((relError * 100).toFixed(4)),
      status: passed ? 'PASS' : 'FAIL'
    });
  }

  // STEP 2: Aggregate Batch Insertion
  const now = Date.now();
  for (let i = 0; i < BENCHMARK_CASES.length; i++) {
    const test = BENCHMARK_CASES[i];
    const calc = calculateCost(test.model, test.promptTokens, test.completionTokens, pricingTable, {
      cachedTokens: test.cachedTokens,
      isFailedRequest: test.statusCode >= 400
    });

    logRequest({
      id: `eval_${test.id}_${now}`,
      timestamp: now + i * 50,
      iso_timestamp: new Date(now + i * 50).toISOString(),
      team: test.team,
      feature: test.feature,
      user_id: test.user,
      model: test.model,
      provider: test.provider,
      prompt_tokens: test.promptTokens,
      completion_tokens: test.completionTokens,
      cached_tokens: test.cachedTokens,
      total_tokens: test.promptTokens + test.cachedTokens + test.completionTokens,
      prompt_cost: calc.promptCost,
      completion_cost: calc.completionCost,
      cached_cost: calc.cachedCost,
      total_cost: calc.totalCost,
      latency_ms: 140,
      status_code: test.statusCode,
      is_stream: 0,
      is_simulated: 1,
      usage_source: 'simulated',
      pricing_version: calc.pricingVersion || '2026-Q1',
      prompt_preview: `Evaluation benchmark fixture for ${test.id}: ${test.description}`,
      response_preview: `Deterministic benchmark verification output`,
      raw_metadata: JSON.stringify({ batch: testBatchTag, testId: test.id })
    });
  }

  // Expected Batch Aggregates
  const expectedTotals = {
    requests: BENCHMARK_CASES.length,
    promptTokens: BENCHMARK_CASES.reduce((s, c) => s + c.promptTokens, 0),
    cachedTokens: BENCHMARK_CASES.reduce((s, c) => s + c.cachedTokens, 0),
    completionTokens: BENCHMARK_CASES.reduce((s, c) => s + c.completionTokens, 0),
    totalTokens: BENCHMARK_CASES.reduce((s, c) => s + c.promptTokens + c.cachedTokens + c.completionTokens, 0),
    totalCost: 0.369000,
    byTeam: {
      'Core Engineering': 0.136500,
      'Data Science': 0.046600,
      'Customer Support': 0.030500,
      'Marketing & Content': 0.153000,
      'Product Growth': 0.001800,
      'Unassigned': 0.000600
    }
  };

  // Query Database directly for this batch
  const batchQuery = db.prepare(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
      COALESCE(SUM(cached_tokens), 0) as cached_tokens,
      COALESCE(SUM(completion_tokens), 0) as completion_tokens,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(SUM(total_cost), 0.0) as total_cost
    FROM requests
    WHERE raw_metadata LIKE ?
  `);
  const actualBatchTotals = batchQuery.get(`%"batch":"${testBatchTag}"%`);
  actualBatchTotals.total_cost = Number(Number(actualBatchTotals.total_cost).toFixed(6));

  const costDelta = Math.abs(actualBatchTotals.total_cost - expectedTotals.totalCost);
  const tokenDelta = Math.abs(actualBatchTotals.total_tokens - expectedTotals.totalTokens);
  const aggregatePassed = (costDelta < 0.000005) && (tokenDelta === 0);

  // STEP 3: Multi-Team Attribution Aggregation Verification
  const teamBatchQuery = db.prepare(`
    SELECT team, COALESCE(SUM(total_cost), 0.0) as team_cost
    FROM requests
    WHERE raw_metadata LIKE ?
    GROUP BY team
  `);
  const actualTeamRows = teamBatchQuery.all(`%"batch":"${testBatchTag}"%`);
  const actualTeamCosts = {};
  for (const row of actualTeamRows) {
    actualTeamCosts[row.team] = Number(Number(row.team_cost).toFixed(6));
  }

  const teamBreakdownVerification = [];
  let allTeamsPassed = true;
  for (const [teamName, expCost] of Object.entries(expectedTotals.byTeam)) {
    const actCost = actualTeamCosts[teamName] || 0;
    const diff = Math.abs(actCost - expCost);
    const passed = diff < 0.000002;
    if (!passed) allTeamsPassed = false;
    teamBreakdownVerification.push({
      team: teamName,
      expectedCost: expCost,
      actualCost: actCost,
      absError: Number(diff.toFixed(6)),
      status: passed ? 'PASS' : 'FAIL'
    });
  }

  const fullAnalytics = getAnalytics();
  const allPassed = (unitPassedCount === BENCHMARK_CASES.length) && aggregatePassed && allTeamsPassed;

  return {
    timestamp: evaluationTimestamp,
    summary: {
      status: allPassed ? 'PASS' : 'FAIL',
      totalTests: BENCHMARK_CASES.length + 1 + teamBreakdownVerification.length,
      passedCount: unitPassedCount + (aggregatePassed ? 1 : 0) + teamBreakdownVerification.filter(t => t.status === 'PASS').length,
      accuracyPercentage: allPassed ? 100.0 : Number(((unitPassedCount / BENCHMARK_CASES.length) * 100).toFixed(2)),
      totalExpectedCost: expectedTotals.totalCost,
      totalCalculatedCost: actualBatchTotals.total_cost,
      totalAbsoluteError: Number(totalAbsError.toFixed(6)),
      maxAbsoluteError: Number(maxAbsError.toFixed(6)),
      verdict: allPassed
        ? 'VERIFIED: All calculator estimations and multi-tenant aggregations match known mathematical ground truth with 0.000000% error.'
        : 'DISCREPANCY DETECTED: Deviations found against known benchmark values.'
    },
    unitTestMatrix: unitResults,
    aggregateVerification: {
      requests: { expected: expectedTotals.requests, actual: actualBatchTotals.count, match: actualBatchTotals.count === expectedTotals.requests },
      promptTokens: { expected: expectedTotals.promptTokens, actual: actualBatchTotals.prompt_tokens, match: actualBatchTotals.prompt_tokens === expectedTotals.promptTokens },
      cachedTokens: { expected: expectedTotals.cachedTokens, actual: actualBatchTotals.cached_tokens, match: actualBatchTotals.cached_tokens === expectedTotals.cachedTokens },
      completionTokens: { expected: expectedTotals.completionTokens, actual: actualBatchTotals.completion_tokens, match: actualBatchTotals.completion_tokens === expectedTotals.completionTokens },
      totalTokens: { expected: expectedTotals.totalTokens, actual: actualBatchTotals.total_tokens, match: actualBatchTotals.total_tokens === expectedTotals.totalTokens },
      totalCost: { expected: expectedTotals.totalCost, actual: actualBatchTotals.total_cost, absError: Number(costDelta.toFixed(6)), match: costDelta < 0.000005 },
      status: aggregatePassed ? 'PASS' : 'FAIL'
    },
    teamBreakdownVerification,
    activeDashboardTotals: {
      totalRequestsInSystem: fullAnalytics.summary.total_requests,
      totalSpendInSystem: fullAnalytics.summary.total_cost,
      totalTokensInSystem: fullAnalytics.summary.total_tokens,
      isReconciled: fullAnalytics.reconciliation.isReconciled
    }
  };
}
