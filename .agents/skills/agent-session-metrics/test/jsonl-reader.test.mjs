import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { readJsonlFile } from '../src/jsonl-reader.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, 'fixtures', 'codex');

test('reads JSONL records while counting malformed lines without leaking contents', async () => {
  const filePath = join(fixtureRoot, 'malformed-lines', 'sessions', 'rollout-malformed.jsonl');
  const result = await readJsonlFile(filePath);

  assert.equal(result.records.length, 2);
  assert.equal(result.stats.lineCount, 3);
  assert.equal(result.stats.invalidJsonLines, 1);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Invalid JSON at line 2/);
  assert.doesNotMatch(result.warnings[0], /not-json/);
});
