import test from 'node:test';
import assert from 'node:assert/strict';

import { getProviderAdapter, listProviderAdapters } from '../src/adapter-registry.mjs';

test('registers only codex provider adapter', () => {
  assert.deepEqual(listProviderAdapters(), ['codex']);
  assert.equal(getProviderAdapter('codex').id, 'codex');
});

test('rejects unsupported providers with a clear implementation error', () => {
  for (const provider of ['claude', 'gemini', 'unknown']) {
    assert.throws(() => getProviderAdapter(provider), /provider adapter not implemented: .+/, provider);
  }
});
