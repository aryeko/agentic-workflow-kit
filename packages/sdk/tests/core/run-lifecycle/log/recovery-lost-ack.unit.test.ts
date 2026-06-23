import { describe, expect, it } from 'vitest';

import { appendIntent, createHarness, expectFailureCode, runId } from './test-support.js';

describe('RunWriter lost acknowledgement recovery', () => {
  it('reports committed without a second append when replay contains the lost batch exactly', () => {
    const harness = createHarness({
      appendOutcomes: [{ code: 'partial-ack-unknown', commit: 'exact' }],
    });
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([appendIntent('SiblingFact', { ok: true }, { eventId: 'lost-1' })])
      : writer;

    expect(result.ok).toBe(true);
    expect(harness.appendCalls).toHaveLength(1);
    if (result.ok) {
      expect(result.value.eventIds).toEqual(['lost-1']);
    }
  });

  it('appends a fresh batch at the next sequence when replay shows the lost batch is absent', () => {
    const harness = createHarness({
      appendOutcomes: [{ code: 'partial-ack-unknown', commit: 'absent' }],
    });
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([appendIntent('SiblingFact', { ok: true }, { eventId: 'lost-absent' })])
      : writer;

    expect(result.ok).toBe(true);
    expect(harness.appendCalls).toHaveLength(2);
    expect(harness.appendCalls[1].batch.expectedSequence).toBe(3);
    expect(harness.appendCalls[1].envelopes[0].eventId).toBe('lost-absent');
  });

  it('returns stale-writer-fenced with no fresh append when the lease is superseded after lost-ack replay', () => {
    const harness = createHarness({
      appendOutcomes: [{ code: 'partial-ack-unknown', commit: 'absent' }],
    });
    harness.seedCreatedRun();
    const originalReplay = harness.eventLogStore.replay.bind(harness.eventLogStore);
    let replayCalls = 0;
    harness.eventLogStore.replay = (requestedRunId) => {
      const result = originalReplay(requestedRunId);
      replayCalls += 1;
      if (replayCalls === 2) {
        harness.supersedeLease();
      }
      return result;
    };
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([appendIntent('SiblingFact', { ok: true }, { eventId: 'lost-stale' })])
      : writer;

    expectFailureCode(result, 'stale-writer-fenced');
    expect(harness.appendCalls).toHaveLength(1);
  });

  it('returns sequence-conflict when replay shows a conflicting id or digest at the lost sequence', () => {
    const harness = createHarness({
      appendOutcomes: [{ code: 'partial-ack-unknown', commit: 'conflict' }],
    });
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([appendIntent('SiblingFact', { ok: true }, { eventId: 'lost-conflict' })])
      : writer;

    expectFailureCode(result, 'sequence-conflict');
    expect(harness.appendCalls).toHaveLength(1);
  });

  it('surfaces partial-ack-unknown when fnd-02 returns a non-durable acknowledgement for a canonical append', () => {
    const harness = createHarness({
      appendOutcomes: [{ acknowledged: true, durability: 'buffered', expectedSequence: 3 }],
    });
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok ? writer.value.append([appendIntent('SiblingFact', { ok: true })]) : writer;

    expectFailureCode(result, 'partial-ack-unknown');
  });
});
