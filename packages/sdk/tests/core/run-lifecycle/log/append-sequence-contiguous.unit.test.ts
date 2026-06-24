import { describe, expect, it } from 'vitest';

import { appendIntent, createHarness, expectFailureCode, runId } from './test-support.js';

describe('RunWriter sequence validation', () => {
  it('rejects a first sequence that is not lastCommittedSequence + 1 before storage append', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([appendIntent('SiblingFact', { ok: true }, { sequence: 4 })])
      : writer;

    expectFailureCode(result, 'sequence-conflict');
    expect(harness.appendCalls).toHaveLength(0);
  });

  it('rejects a non-contiguous batch before storage append', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([
          appendIntent('SiblingFact', { first: true }, { sequence: 3 }),
          appendIntent('SiblingFact', { second: true }, { sequence: 5 }),
        ])
      : writer;

    expectFailureCode(result, 'sequence-conflict');
    expect(harness.appendCalls).toHaveLength(0);
  });
});
