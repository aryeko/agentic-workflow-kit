import { describe, expect, it } from 'vitest';

import { appendIntent, createHarness, runId } from './test-support.js';

describe('RunWriter durability normalization', () => {
  it('commits one fnd-02 batch at the strongest requested durability and records it on envelopes and receipt', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([
          appendIntent('SiblingFact', { durable: true }, { durability: 'durable' }),
          appendIntent('SiblingBarrierFact', { barrier: true }, { durability: 'barrier' }),
        ])
      : writer;

    expect(result.ok).toBe(true);
    expect(harness.appendCalls).toHaveLength(1);
    expect(harness.appendCalls[0].batch.durability).toBe('barrier');
    expect(harness.appendCalls[0].envelopes.map((event) => event.durability)).toEqual(['barrier', 'barrier']);
    if (result.ok) {
      expect(result.value.durability).toBe('barrier');
    }
  });
});
