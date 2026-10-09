// tests/attribution.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAttribution, DEFAULT_TEAMS, DEFAULT_FEATURES } from '../src/attribution.js';

describe('TokenPulse Attribution Service', () => {
  it('should verify and attribute valid configured team and feature', () => {
    const fakeReq = {
      headers: {
        'x-team': 'Core Engineering',
        'x-feature': 'Code Review Assistant',
        'x-user': 'alex.dev'
      }
    };
    const res = resolveAttribution(fakeReq, DEFAULT_TEAMS, DEFAULT_FEATURES);
    assert.equal(res.team, 'Core Engineering');
    assert.equal(res.teamStatus, 'verified');
    assert.equal(res.feature, 'Code Review Assistant');
    assert.equal(res.featureStatus, 'verified');
    assert.equal(res.userId, 'alex.dev');
    assert.equal(res.isFullyAttributed, true);
  });

  it('should enforce Unassigned policy when team is missing or unknown', () => {
    const fakeReq = {
      headers: {
        'x-team': 'Bogus Fake Team 999',
        'x-feature': 'Arbitrary Feature',
        'x-user': 'guest_1'
      }
    };
    const res = resolveAttribution(fakeReq, DEFAULT_TEAMS, DEFAULT_FEATURES);
    assert.equal(res.team, 'Unassigned');
    assert.equal(res.teamStatus, 'unknown_entity');
    assert.equal(res.feature, 'Unassigned');
    assert.equal(res.featureStatus, 'unknown_entity');
    assert.equal(res.isFullyAttributed, false);
  });

  it('should extract attribution from body metadata when headers are absent', () => {
    const fakeReq = {
      headers: {},
      body: {
        metadata: {
          team: 'Customer Support',
          feature: 'Ticket Summarizer',
          user: 'carlos.support'
        }
      }
    };
    const res = resolveAttribution(fakeReq, DEFAULT_TEAMS, DEFAULT_FEATURES);
    assert.equal(res.team, 'Customer Support');
    assert.equal(res.feature, 'Ticket Summarizer');
    assert.equal(res.userId, 'carlos.support');
    assert.equal(res.isFullyAttributed, true);
  });

  it('should sanitize unsafe characters in user identifier', () => {
    const fakeReq = {
      headers: {
        'x-user': 'user<script>alert(1)</script>@corp.com'
      }
    };
    const res = resolveAttribution(fakeReq, DEFAULT_TEAMS, DEFAULT_FEATURES);
    assert.equal(res.userId, 'userscriptalert1script@corp.com');
  });
});
