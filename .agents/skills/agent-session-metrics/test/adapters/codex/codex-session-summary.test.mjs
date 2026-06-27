import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { summarizeCodexSession } from '../../../src/adapters/codex/codex-session-summary.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, '..', '..', 'fixtures', 'codex');

test('summarizes one Codex session and chooses the final cumulative token snapshot', async () => {
  const recordPath = join(fixtureRoot, 'duplicate-token-count', 'sessions', 'rollout-dup-token.jsonl');
  const summary = await summarizeCodexSession({ recordPath });

  assert.equal(summary.sessionId, 'dup-token');
  assert.equal(summary.tokenUsage.status, 'observed');
  assert.equal(summary.tokenUsage.total.totalTokens, 41);
  assert.equal(summary.tokenUsage.last.totalTokens, 26);
  assert.equal(summary.counts.tokenCountEvents, 2);
});

test('preserves unavailable fields instead of inventing defaults', async () => {
  const recordPath = join(fixtureRoot, 'unavailable-fields', 'sessions', 'rollout-unavailable.jsonl');
  const summary = await summarizeCodexSession({ recordPath });

  assert.equal(summary.sessionId, 'unavailable');
  assert.equal(summary.cwd, null);
  assert.equal(summary.model, null);
  assert.equal(summary.effort, null);
  assert.deepEqual(summary.tokenUsage, {
    status: 'unavailable',
    source: 'unavailable',
    total: null,
    last: null,
    modelContextWindow: null,
  });
  assert.match(summary.warnings.join('\n'), /Token usage unavailable/);
});

test('extracts parent, role, nickname, model, effort, timestamps, and counts', async () => {
  const recordPath = join(fixtureRoot, 'nested-subagents', 'sessions', 'rollout-child-a.jsonl');
  const summary = await summarizeCodexSession({ recordPath });

  assert.equal(summary.parentSessionId, 'root-tree');
  assert.equal(summary.depth, 1);
  assert.equal(summary.agentRole, 'reviewer');
  assert.equal(summary.agentNickname, 'alpha');
  assert.equal(summary.modelProvider, 'openai');
  assert.equal(summary.model, 'gpt-5-mini');
  assert.equal(summary.effort, 'medium');
  assert.equal(summary.startedAt, '2026-06-27T01:01:00.000Z');
  assert.equal(summary.completedAt, '2026-06-27T01:01:10.000Z');
  assert.equal(summary.durationMs, 10000);
  assert.equal(summary.counts.toolCalls, 2);
});
