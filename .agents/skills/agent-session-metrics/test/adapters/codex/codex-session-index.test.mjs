import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { discoverCodexSessionRecords, resolveCodexTarget } from '../../../src/adapters/codex/codex-session-index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, '..', '..', 'fixtures', 'codex');

test('discovers sessions and archived_sessions records', async () => {
  const providerHome = join(fixtureRoot, 'archived');
  const records = await discoverCodexSessionRecords({ providerHome });

  assert.equal(records.length, 1);
  assert.equal(records[0].sessionId, 'archived-001');
  assert.match(records[0].recordPath, /archived_sessions/);
});

test('resolves session id from provider home', async () => {
  const providerHome = join(fixtureRoot, 'root-only');
  const target = await resolveCodexTarget({
    target: { kind: 'session-id', sessionId: 'root-001' },
    providerHome,
  });

  assert.equal(target.sessionId, 'root-001');
  assert.equal(target.resolution, 'session-id');
  assert.equal(target.confidence, 'exact');
});

test('session-file target reads exactly the requested file', async () => {
  const sessionFile = join(fixtureRoot, 'root-only', 'sessions', 'rollout-root-001.jsonl');
  const target = await resolveCodexTarget({
    target: { kind: 'session-file', sessionFile },
    providerHome: join(fixtureRoot, 'ambiguous'),
  });

  assert.equal(target.sessionId, 'root-001');
  assert.equal(target.recordPath, sessionFile);
});

test('reports ambiguous session id resolution when matching files disagree', async () => {
  await assert.rejects(
    resolveCodexTarget({
      target: { kind: 'session-id', sessionId: 'same-id' },
      providerHome: join(fixtureRoot, 'ambiguous'),
    }),
    /Ambiguous session-id resolution for same-id/,
  );
});
