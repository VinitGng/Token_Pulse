// tests/timewindow.test.js
// TokenPulse: Deterministic Verification for Time Window Filtering & Analytics
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  db,
  getAnalytics, 
  getRequests, 
  parseTimestamp, 
  resolveTimeBounds, 
  buildTimelineSeries 
} from '../src/db.js';

describe('TokenPulse Time Window Filtering Engine', () => {
  const now = 1750000000000; // Deterministic fixed timestamp

  it('should parse timestamp numbers, numeric strings, and ISO dates consistently', () => {
    assert.equal(parseTimestamp(1750000000000), 1750000000000);
    assert.equal(parseTimestamp('1750000000000'), 1750000000000);
    assert.equal(parseTimestamp(' 1750000000000 '), 1750000000000);
    assert.equal(parseTimestamp('2025-06-15T12:00:00.000Z'), new Date('2025-06-15T12:00:00.000Z').getTime());
    assert.equal(parseTimestamp(''), null);
    assert.equal(parseTimestamp(null), null);
    assert.equal(parseTimestamp(undefined), null);
    assert.equal(parseTimestamp('invalid-date-xyz'), null);
  });

  it('should resolve dynamic time window boundaries for 24h, 7d, 30d, and all', () => {
    const t24h = resolveTimeBounds({ timeWindow: '24h' });
    assert.ok(t24h.startMs !== null);
    assert.ok(Date.now() - t24h.startMs >= 24 * 3600 * 1000 - 1000);

    const t7d = resolveTimeBounds({ timeWindow: '7d' });
    assert.ok(t7d.startMs !== null);
    assert.ok(Date.now() - t7d.startMs >= 7 * 24 * 3600 * 1000 - 1000);

    const t30d = resolveTimeBounds({ timeWindow: '30d' });
    assert.ok(t30d.startMs !== null);
    assert.ok(Date.now() - t30d.startMs >= 30 * 24 * 3600 * 1000 - 1000);

    const tAll = resolveTimeBounds({ timeWindow: 'all' });
    assert.equal(tAll.startMs, null);
    assert.equal(tAll.endMs, null);
  });

  it('should build chronological timeline buckets with zero-filling for 24h', () => {
    const rawRows = [
      { time_label: '2025-06-15 10:00', requests: 5, total_tokens: 1200, prompt_tokens: 800, completion_tokens: 400, cached_tokens: 0, total_cost: 0.05 }
    ];
    const fixedEnd = new Date('2025-06-15T12:00:00.000Z').getTime();
    const series = buildTimelineSeries(rawRows, '24h', fixedEnd - 24 * 3600 * 1000, fixedEnd);

    assert.equal(series.length, 24, '24h window must contain exactly 24 hourly buckets');
    // Ensure chronological ordering
    for (let i = 1; i < series.length; i++) {
      assert.ok(series[i].time_label >= series[i - 1].time_label, 'Buckets must be chronological');
    }
    // Ensure empty buckets have 0 spend and do not invent fake costs
    const emptyBucket = series.find(b => b.time_label !== '2025-06-15 10:00');
    if (emptyBucket) {
      assert.equal(emptyBucket.total_cost, 0);
      assert.equal(emptyBucket.requests, 0);
    }
  });

  it('should build chronological timeline buckets with zero-filling for 7d and 30d', () => {
    const fixedEnd = new Date('2025-06-15T12:00:00.000Z').getTime();
    const series7d = buildTimelineSeries([], '7d', fixedEnd - 7 * 24 * 3600 * 1000, fixedEnd);
    assert.equal(series7d.length, 7, '7d window must contain exactly 7 daily buckets');
    assert.equal(series7d.every(b => b.total_cost === 0), true);

    const series30d = buildTimelineSeries([], '30d', fixedEnd - 30 * 24 * 3600 * 1000, fixedEnd);
    assert.equal(series30d.length, 30, '30d window must contain exactly 30 daily buckets');
  });

  describe('Deterministic Database Filtering Verification', () => {
    const testPrefix = `test_tw_${Date.now()}_`;
    const currentTime = Date.now();
    
    // Seed 4 deterministic test records across time intervals
    const tRecent = currentTime - 2 * 3600 * 1000;       // 2 hours ago (within 24h, 7d, 30d, all)
    const t3DaysAgo = currentTime - 3 * 24 * 3600 * 1000; // 3 days ago (within 7d, 30d, all; outside 24h)
    const t15DaysAgo = currentTime - 15 * 24 * 3600 * 1000; // 15 days ago (within 30d, all; outside 24h, 7d)
    const t45DaysAgo = currentTime - 45 * 24 * 3600 * 1000; // 45 days ago (within all; outside 24h, 7d, 30d)

    const insertStmt = db.prepare(`
      INSERT INTO requests (
        id, timestamp, iso_timestamp, team, feature, user_id, model, provider,
        prompt_tokens, completion_tokens, cached_tokens, total_tokens,
        prompt_cost, completion_cost, cached_cost, total_cost,
        latency_ms, status_code, is_stream, is_simulated, usage_source, pricing_version,
        prompt_preview, response_preview, raw_metadata
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    // Insert 4 test records
    const testRecords = [
      { id: `${testPrefix}1`, ts: tRecent, team: 'Core Engineering', cost: 1.00, tokens: 1000 },
      { id: `${testPrefix}2`, ts: t3DaysAgo, team: 'Core Engineering', cost: 2.00, tokens: 2000 },
      { id: `${testPrefix}3`, ts: t15DaysAgo, team: 'Product Growth', cost: 4.00, tokens: 4000 },
      { id: `${testPrefix}4`, ts: t45DaysAgo, team: 'Product Growth', cost: 8.00, tokens: 8000 }
    ];

    for (const r of testRecords) {
      insertStmt.run(
        r.id, r.ts, new Date(r.ts).toISOString(), r.team, 'Feature-A', 'test.user', 'gpt-4o', 'OpenAI',
        r.tokens / 2, r.tokens / 2, 0, r.tokens,
        r.cost / 2, r.cost / 2, 0, r.cost,
        150, 200, 0, 1, 'simulated', '2026-Q1',
        'Test prompt', 'Test reply', '{}'
      );
    }

    it('1. All Time includes all eligible records', () => {
      const res = getRequests({ search: testPrefix, timeWindow: 'all' });
      assert.equal(res.records.length, 4, 'All Time should include all 4 test records');
      const ids = res.records.map(r => r.id);
      assert.ok(ids.includes(`${testPrefix}1`));
      assert.ok(ids.includes(`${testPrefix}2`));
      assert.ok(ids.includes(`${testPrefix}3`));
      assert.ok(ids.includes(`${testPrefix}4`));
    });

    it('2. Last 24 Hours excludes records older than 24 hours', () => {
      const res = getRequests({ search: testPrefix, timeWindow: '24h' });
      assert.equal(res.records.length, 1, 'Last 24h should only include the 2-hour-old record');
      assert.equal(res.records[0].id, `${testPrefix}1`);
    });

    it('3. Last 7 Days excludes records outside 7-day boundary', () => {
      const res = getRequests({ search: testPrefix, timeWindow: '7d' });
      assert.equal(res.records.length, 2, 'Last 7d should include 2h and 3d records');
      const ids = res.records.map(r => r.id);
      assert.ok(ids.includes(`${testPrefix}1`));
      assert.ok(ids.includes(`${testPrefix}2`));
      assert.ok(!ids.includes(`${testPrefix}3`));
      assert.ok(!ids.includes(`${testPrefix}4`));
    });

    it('4. Last 30 Days excludes records outside 30-day boundary', () => {
      const res = getRequests({ search: testPrefix, timeWindow: '30d' });
      assert.equal(res.records.length, 3, 'Last 30d should include 2h, 3d, and 15d records');
      const ids = res.records.map(r => r.id);
      assert.ok(ids.includes(`${testPrefix}1`));
      assert.ok(ids.includes(`${testPrefix}2`));
      assert.ok(ids.includes(`${testPrefix}3`));
      assert.ok(!ids.includes(`${testPrefix}4`));
    });

    it('5. KPI totals match the filtered records exactly', () => {
      const a24h = getAnalytics({ search: testPrefix, timeWindow: '24h' });
      assert.equal(a24h.summary.total_requests, 1);
      assert.equal(a24h.summary.total_cost, 1.00);
      assert.equal(a24h.summary.total_tokens, 1000);

      const a7d = getAnalytics({ search: testPrefix, timeWindow: '7d' });
      assert.equal(a7d.summary.total_requests, 2);
      assert.equal(a7d.summary.total_cost, 3.00);
      assert.equal(a7d.summary.total_tokens, 3000);

      const a30d = getAnalytics({ search: testPrefix, timeWindow: '30d' });
      assert.equal(a30d.summary.total_requests, 3);
      assert.equal(a30d.summary.total_cost, 7.00);
      assert.equal(a30d.summary.total_tokens, 7000);

      const aAll = getAnalytics({ search: testPrefix, timeWindow: 'all' });
      assert.equal(aAll.summary.total_requests, 4);
      assert.equal(aAll.summary.total_cost, 15.00);
      assert.equal(aAll.summary.total_tokens, 15000);
    });

    it('6. Charts use the same filtered dataset (reconciliation verified)', () => {
      const a7d = getAnalytics({ search: testPrefix, timeWindow: '7d' });
      assert.equal(a7d.reconciliation.isReconciled, true);
      const teamSum = a7d.by_team.reduce((acc, t) => acc + t.total_cost, 0);
      assert.equal(Math.abs(teamSum - a7d.summary.total_cost) < 0.0001, true);
    });

    it('7. Team and feature filters work together with Time Window', () => {
      // 30d window + 'Product Growth' team -> only the 15-day record ($4.00), not the 45-day record ($8.00)
      const res = getAnalytics({ 
        search: testPrefix, 
        timeWindow: '30d', 
        team: 'Product Growth' 
      });
      assert.equal(res.summary.total_requests, 1);
      assert.equal(res.summary.total_cost, 4.00);
      assert.equal(res.summary.total_tokens, 4000);
      assert.equal(res.by_team.length, 1);
      assert.equal(res.by_team[0].team, 'Product Growth');
    });

    it('8. Empty results do not show unfiltered historical data', () => {
      // Search for non-existent prefix in 24h
      const emptyRes = getAnalytics({ 
        search: `${testPrefix}_non_existent`, 
        timeWindow: '24h' 
      });
      assert.equal(emptyRes.summary.total_requests, 0);
      assert.equal(emptyRes.summary.total_cost, 0);
      assert.equal(emptyRes.summary.total_tokens, 0);
      assert.equal(emptyRes.summary.avg_latency_ms, 0);
      assert.equal(emptyRes.summary.failed_requests, 0);
      assert.equal(emptyRes.by_team.length, 0);
      assert.equal(emptyRes.by_feature.length, 0);
      assert.equal(emptyRes.by_model.length, 0);
    });

    // Clean up test records
    it('should clean up test records', () => {
      const delStmt = db.prepare('DELETE FROM requests WHERE id LIKE ?');
      delStmt.run(`${testPrefix}%`);
      const check = db.prepare('SELECT COUNT(*) as c FROM requests WHERE id LIKE ?').get(`${testPrefix}%`);
      assert.equal(check.c, 0);
    });
  });
});
