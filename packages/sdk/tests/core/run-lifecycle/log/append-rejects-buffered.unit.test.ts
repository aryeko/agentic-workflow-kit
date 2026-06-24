import { describe, expect, it } from 'vitest';

import { appendIntent, createHarness, expectFailureCode, runId } from './test-support.js';

describe('RunWriter buffered durability rejection', () => {
  it('records buffered canonical run event requests before returning rejection', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([appendIntent('SiblingFact', { ok: true }, { durability: 'buffered' as never })])
      : writer;

    expectFailureCode(result, 'durability-insufficient');
    expect(harness.appendCalls).toHaveLength(1);
    expect(harness.appendCalls[0].batch.durability).toBe('durable');
    expect(harness.appendCalls[0].envelopes).toHaveLength(1);
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
    expect(harness.appendCalls[0].envelopes[0].payload).toMatchObject({
      attemptedType: 'SiblingFact',
      failureCode: 'durability-insufficient',
    });
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
