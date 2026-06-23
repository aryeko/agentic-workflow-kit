import { describe, expect, it } from 'vitest';

import { appendIntent, createHarness, runId } from './test-support.js';

describe('RunWriter monotonic sequence property', () => {
  it('assigns contiguous monotonic sequences across generated valid batch sizes', () => {
    for (const batchSize of [1, 2, 3, 5]) {
      const harness = createHarness();
      harness.seedCreatedRun();
      const writer = harness.log.openWriter(runId, harness.acquireLease());
      expect(writer.ok).toBe(true);

      const result = writer.ok
        ? writer.value.append(
            Array.from({ length: batchSize }, (_, index) =>
              appendIntent('SiblingFact', { index }, { durability: 'durable' }),
            ),
          )
        : writer;

      expect(result.ok).toBe(true);
      expect(harness.appendCalls[0].envelopes.map((event) => event.sequence)).toEqual(
        Array.from({ length: batchSize }, (_, index) => index + 3),
      );
    }
  });
});
