import { describe, expect, it } from 'vitest';

import { appendIntent, createHarness, expectFailureCode, runId } from './test-support.js';

describe('RunWriter buffered durability rejection', () => {
  it('rejects buffered canonical run event requests before storage append', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([appendIntent('SiblingFact', { ok: true }, { durability: 'buffered' as never })])
      : writer;

    expectFailureCode(result, 'durability-insufficient');
    expect(harness.appendCalls).toHaveLength(0);
  });

  it('does not map a fnd-02 NonDurableAck into a RunAppendReceipt', () => {
    const harness = createHarness({
      appendOutcomes: [{ acknowledged: true, durability: 'buffered', expectedSequence: 3 }],
    });
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok ? writer.value.append([appendIntent('SiblingFact', { ok: true })]) : writer;

    expectFailureCode(result, 'partial-ack-unknown');
    expect(harness.appendCalls).toHaveLength(1);
  });
});
