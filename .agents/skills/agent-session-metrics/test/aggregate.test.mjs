import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregateSessions } from '../src/aggregate.mjs';

const tokenUsage = (totalTokens) => ({
  status: 'observed',
  source: 'codex_token_count',
  total: {
    inputTokens: totalTokens - 3,
    cachedInputTokens: 1,
    outputTokens: 2,
    reasoningOutputTokens: 1,
    totalTokens,
  },
  last: {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
  },
  modelContextWindow: null,
});

test('aggregates token totals exactly once and ignores unavailable usage', () => {
  const aggregate = aggregateSessions([
    {
      provider: 'codex',
      parentSessionId: null,
      depth: 0,
      durationMs: 10,
      agentRole: 'root',
      model: 'gpt-5',
      effort: 'high',
      tokenUsage: tokenUsage(10),
    },
    {
      provider: 'codex',
      parentSessionId: 'root',
      depth: 1,
      durationMs: 20,
      agentRole: 'reviewer',
      model: 'gpt-5-mini',
      effort: 'medium',
      tokenUsage: tokenUsage(20),
    },
    {
      provider: 'codex',
      parentSessionId: 'root',
      depth: 1,
      durationMs: null,
      agentRole: null,
      model: null,
      effort: null,
      tokenUsage: { status: 'unavailable', source: 'unavailable', total: null, last: null, modelContextWindow: null },
    },
  ]);

  assert.equal(aggregate.sessionCount, 3);
  assert.equal(aggregate.rootCount, 1);
  assert.equal(aggregate.maxDepth, 1);
  assert.equal(aggregate.durationMs, 30);
  assert.equal(aggregate.tokenUsage.totalTokens, 30);
  assert.deepEqual(aggregate.byProvider, { codex: 3 });
  assert.deepEqual(aggregate.byRole, { root: 1, reviewer: 1, unavailable: 1 });
});
