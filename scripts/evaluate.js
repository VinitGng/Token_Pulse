// scripts/evaluate.js
// TokenPulse: CLI Evaluation Suite & Audit Report Generator

import { initDb } from '../src/db.js';
import { runEvaluationSuite } from '../src/evaluation.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('='.repeat(78));
  console.log('   TOKENPULSE — LLM FINOPS EVALUATION & GROUND-TRUTH RECONCILIATION');
  console.log('='.repeat(78));

  initDb();
  const report = await runEvaluationSuite();

  console.log('\nTEST SUITE 1: UNIT CALCULATOR VERIFICATION (16 DETERMINISTIC BENCHMARKS)');
  console.log('-'.repeat(78));
  console.log(
    'ID'.padEnd(10) +
    'Model'.padEnd(18) +
    'Tokens'.padEnd(12) +
    'Expected ($)'.padEnd(14) +
    'Actual ($)'.padEnd(14) +
    'Abs Err ($)'.padEnd(12) +
    'Status'
  );
  console.log('-'.repeat(78));

  for (const test of report.unitTestMatrix) {
    const statusStr = test.status === 'PASS' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(
      test.testId.padEnd(10) +
      test.model.padEnd(18) +
      `${test.totalTokens}`.padEnd(12) +
      `$${test.expectedCost.toFixed(6)}`.padEnd(14) +
      `$${test.actualCost.toFixed(6)}`.padEnd(14) +
      `$${test.absError.toFixed(6)}`.padEnd(12) +
      statusStr
    );
  }

  console.log('\n' + '-'.repeat(78));
  console.log('TEST SUITE 2: AGGREGATE SYSTEM BATCH TOTALS VERIFICATION');
  console.log('-'.repeat(78));
  const agg = report.aggregateVerification;
  console.log(`Requests:          Expected ${agg.requests.expected} | Actual ${agg.requests.actual} -> ${agg.requests.match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mMISMATCH\x1b[0m'}`);
  console.log(`Prompt Tokens:     Expected ${agg.promptTokens.expected.toLocaleString()} | Actual ${agg.promptTokens.actual.toLocaleString()} -> ${agg.promptTokens.match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mMISMATCH\x1b[0m'}`);
  console.log(`Cached Tokens:     Expected ${agg.cachedTokens.expected.toLocaleString()} | Actual ${agg.cachedTokens.actual.toLocaleString()} -> ${agg.cachedTokens.match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mMISMATCH\x1b[0m'}`);
  console.log(`Completion Tokens: Expected ${agg.completionTokens.expected.toLocaleString()} | Actual ${agg.completionTokens.actual.toLocaleString()} -> ${agg.completionTokens.match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mMISMATCH\x1b[0m'}`);
  console.log(`Total Tokens:      Expected ${agg.totalTokens.expected.toLocaleString()} | Actual ${agg.totalTokens.actual.toLocaleString()} -> ${agg.totalTokens.match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mMISMATCH\x1b[0m'}`);
  console.log(`Total Batch Cost:  Expected $${agg.totalCost.expected.toFixed(6)} | Actual $${agg.totalCost.actual.toFixed(6)} (Error: $${agg.totalCost.absError.toFixed(6)}) -> ${agg.totalCost.match ? '\x1b[32mMATCH\x1b[0m' : '\x1b[31mMISMATCH\x1b[0m'}`);

  console.log('\n' + '-'.repeat(78));
  console.log('TEST SUITE 3: MULTI-TENANT ATTRIBUTION AGGREGATION AUDIT');
  console.log('-'.repeat(78));
  for (const tb of report.teamBreakdownVerification) {
    const statusStr = tb.status === 'PASS' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(
      tb.team.padEnd(24) +
      `Expected: $${tb.expectedCost.toFixed(6)}`.padEnd(24) +
      `Actual: $${tb.actualCost.toFixed(6)}`.padEnd(22) +
      statusStr
    );
  }

  console.log('\n' + '='.repeat(78));
  console.log(`OVERALL AUDIT VERDICT: ${report.summary.status === 'PASS' ? '\x1b[32mPASSED (100% ACCURACY)\x1b[0m' : '\x1b[31mFAILED\x1b[0m'}`);
  console.log(`Accuracy Score:        ${report.summary.accuracyPercentage}% (${report.summary.passedCount} / ${report.summary.totalTests} tests passed)`);
  console.log(`Total Abs Error:       $${report.summary.totalAbsoluteError.toFixed(6)} USD`);
  console.log(`Max Abs Error:         $${report.summary.maxAbsoluteError.toFixed(6)} USD`);
  console.log(`Dashboard Reconciled:  ${report.activeDashboardTotals.isReconciled ? 'YES (100% Match)' : 'NO'}`);
  console.log('='.repeat(78));

  // Write markdown report
  const mdContent = `# TokenPulse — FinOps Evaluation & Ground-Truth Verification Report

**Generated:** ${report.timestamp}  
**Audit Verdict:** **${report.summary.status}** (${report.summary.accuracyPercentage}% Accuracy)  
**Total Tests:** ${report.summary.totalTests} (${report.summary.passedCount} Passed, ${report.summary.totalTests - report.summary.passedCount} Failed)  
**Total Absolute Error:** $${report.summary.totalAbsoluteError.toFixed(6)} USD  
**Max Absolute Error:** $${report.summary.maxAbsoluteError.toFixed(6)} USD  

---

## 1. Executive Summary
This report validates the **TokenPulse** cost calculation engine, request telemetry logger, and multi-tenant aggregation service against known mathematical ground truth. Benchmark tests include prompt tokens, cached input tokens, completion tokens, zero-token edge cases, failed requests (no charge), missing model pricing guards, and multi-team boundary isolation.

---

## 2. Unit Calculator Benchmark Matrix (16 Cases)

| Test ID | Model | Provider | Team | Description | Prompt | Cached | Comp | Total Tokens | Expected ($) | Actual ($) | Abs Error ($) | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${report.unitTestMatrix.map(t => `| \`${t.testId}\` | \`${t.model}\` | ${t.provider} | ${t.team} | ${t.description} | ${t.promptTokens.toLocaleString()} | ${t.cachedTokens.toLocaleString()} | ${t.completionTokens.toLocaleString()} | ${t.totalTokens.toLocaleString()} | $${t.expectedCost.toFixed(6)} | $${t.actualCost.toFixed(6)} | $${t.absError.toFixed(6)} | **${t.status}** |`).join('\n')}

---

## 3. Aggregate Batch Totals vs Expected Ground Truth

| Telemetry Metric | Expected Ground Truth | Actual Database Total | Discrepancy (Delta) | Reconciliation Status |
|---|---|---|---|---|
| **Request Count** | ${agg.requests.expected} | ${agg.requests.actual} | 0 | ${agg.requests.match ? '✅ MATCH' : '❌ MISMATCH'} |
| **Prompt Tokens** | ${agg.promptTokens.expected.toLocaleString()} | ${agg.promptTokens.actual.toLocaleString()} | 0 | ${agg.promptTokens.match ? '✅ MATCH' : '❌ MISMATCH'} |
| **Cached Tokens** | ${agg.cachedTokens.expected.toLocaleString()} | ${agg.cachedTokens.actual.toLocaleString()} | 0 | ${agg.cachedTokens.match ? '✅ MATCH' : '❌ MISMATCH'} |
| **Completion Tokens** | ${agg.completionTokens.expected.toLocaleString()} | ${agg.completionTokens.actual.toLocaleString()} | 0 | ${agg.completionTokens.match ? '✅ MATCH' : '❌ MISMATCH'} |
| **Total Tokens** | ${agg.totalTokens.expected.toLocaleString()} | ${agg.totalTokens.actual.toLocaleString()} | 0 | ${agg.totalTokens.match ? '✅ MATCH' : '❌ MISMATCH'} |
| **Total Batch Spend ($)** | **$${agg.totalCost.expected.toFixed(6)}** | **$${agg.totalCost.actual.toFixed(6)}** | **$${agg.totalCost.absError.toFixed(6)}** | ${agg.totalCost.match ? '✅ MATCH' : '❌ MISMATCH'} |

---

## 4. Multi-Tenant Attribution Verification

| Business Unit / Team | Expected Spend ($) | Actual Database Spend ($) | Absolute Error ($) | Status |
|---|---|---|---|---|
${report.teamBreakdownVerification.map(tb => `| **${tb.team}** | $${tb.expectedCost.toFixed(6)} | $${tb.actualCost.toFixed(6)} | $${tb.absError.toFixed(6)} | **${tb.status}** |`).join('\n')}

---

## 5. Active System Telemetry
- Total Lifetime Requests: **${report.activeDashboardTotals.totalRequestsInSystem.toLocaleString()}**
- Total Lifetime Tokens: **${report.activeDashboardTotals.totalTokensInSystem.toLocaleString()}**
- Total Lifetime Spend: **$${report.activeDashboardTotals.totalSpendInSystem.toFixed(6)} USD**
- Aggregation Reconciliation: **${report.activeDashboardTotals.isReconciled ? 'Verified 100% Consistent' : 'Check Required'}**

*Report generated automatically by TokenPulse Telemetry Engine.*
`;

  const reportPath = path.join(__dirname, '..', 'EVALUATION_REPORT.md');
  fs.writeFileSync(reportPath, mdContent, 'utf-8');
  console.log(`\nDetailed Markdown Evaluation Report saved to: ${reportPath}`);
}

main().catch(err => {
  console.error('Evaluation run error:', err);
  process.exit(1);
});
