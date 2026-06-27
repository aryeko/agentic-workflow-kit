import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { analyzeAgentSessionMetrics } from '../src/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, 'fixtures', 'codex');

test('analyzes a nested Codex session tree by default', async () => {
  const report = await analyzeAgentSessionMetrics({
    provider: 'codex',
    target: { kind: 'session-id', sessionId: 'root-tree' },
    providerHome: join(fixtureRoot, 'nested-subagents'),
  });

  assert.equal(report.status, 'ok');
  assert.equal(report.provider, 'codex');
  assert.equal(report.scope, 'tree');
  assert.equal(report.root.agentRole, 'root');
  assert.deepEqual(
    report.sessions.map((session) => session.sessionId),
    ['root-tree', 'child-a', 'grandchild-a1', 'child-b'],
  );
  assert.equal(report.aggregate.tokenUsage.totalTokens, 2190);
});

test('main scope includes only the target session', async () => {
  const report = await analyzeAgentSessionMetrics({
    provider: 'codex',
    target: { kind: 'session-id', sessionId: 'root-tree' },
    providerHome: join(fixtureRoot, 'nested-subagents'),
    scope: 'main',
  });

  assert.deepEqual(
    report.sessions.map((session) => session.sessionId),
    ['root-tree'],
  );
  assert.equal(report.aggregate.tokenUsage.totalTokens, 1300);
});

test('children scope excludes the target and includes recursive descendants', async () => {
  const report = await analyzeAgentSessionMetrics({
    provider: 'codex',
    target: { kind: 'session-id', sessionId: 'root-tree' },
    providerHome: join(fixtureRoot, 'nested-subagents'),
    scope: 'children',
  });

  assert.deepEqual(
    report.sessions.map((session) => session.sessionId),
    ['child-a', 'grandchild-a1', 'child-b'],
  );
  assert.equal(report.root.sessionId, 'root-tree');
  assert.equal(report.aggregate.tokenUsage.totalTokens, 890);
});
