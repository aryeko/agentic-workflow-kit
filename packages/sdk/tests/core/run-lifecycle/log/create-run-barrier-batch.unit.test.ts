import { describe, expect, it } from 'vitest';

import { createHarness, runId } from './test-support.js';

describe('RunEventLog.createRun', () => {
  it('acquires the first run writer lease and commits RunCreated plus created lifecycle in one barrier batch', () => {
    const harness = createHarness();

    const result = harness.log.createRun({
      runId,
      holder: 'holder-1',
      leaseTtlMs: 60_000,
      idempotencyKey: 'idempotency-1',
      createdAt: '2026-06-23T12:00:00.000Z',
      payload: {
        idempotencyKey: 'idempotency-1',
        requestedBy: 'operator-1',
      },
    });

    expect(result.ok).toBe(true);
    expect(harness.appendCalls).toHaveLength(1);

    const [call] = harness.appendCalls;
    expect(call.batch.durability).toBe('barrier');
    expect(call.batch.expectedSequence).toBe(1);
    expect(call.envelopes).toHaveLength(2);
    expect(call.envelopes[0].type).toBe('RunCreated');
    expect(call.envelopes[0].sequence).toBe(1);
    expect(call.envelopes[1].type).toBe('RunLifecycleTransitioned');
    expect(call.envelopes[1].sequence).toBe(2);
    expect(call.envelopes[1].payload).toMatchObject({
      from: null,
      to: 'created',
      sourceEventIds: [call.envelopes[0].eventId],
    });
  });

  it('persists RunCreated request metadata from CreateRunInput', () => {
    const harness = createHarness();

    const result = harness.log.createRun({
      runId,
      holder: 'holder-1',
      leaseTtlMs: 60_000,
      idempotencyKey: 'idempotency-input',
      operatorRef: 'operator-ref-input',
      createdAt: '2026-06-23T12:00:00.000Z',
      payload: {
        idempotencyKey: 'idempotency-payload',
        operatorRef: 'operator-ref-payload',
        requestedBy: 'operator-1',
      },
    });

    expect(result.ok).toBe(true);

    const [call] = harness.appendCalls;
    const created = call.envelopes[0];
    expect(created.payload).toEqual({
      idempotencyKey: 'idempotency-input',
      operatorRef: 'operator-ref-input',
      requestedBy: 'operator-1',
    });
    expect(created.payloadDigest).toBe(
      'digest:{"idempotencyKey":"idempotency-input","operatorRef":"operator-ref-input","requestedBy":"operator-1"}',
    );
  });

  it('recovers a created run when the barrier append committed but acknowledgement was lost', () => {
    const harness = createHarness({
      appendOutcomes: [{ code: 'partial-ack-unknown', commit: 'exact' }],
    });

    const result = harness.log.createRun({
      runId,
      holder: 'holder-1',
      leaseTtlMs: 60_000,
      idempotencyKey: 'idempotency-1',
      createdAt: '2026-06-23T12:00:00.000Z',
      payload: {
        idempotencyKey: 'idempotency-1',
        requestedBy: 'operator-1',
      },
    });

    expect(result.ok).toBe(true);
    expect(harness.appendCalls).toHaveLength(1);
    expect(harness.records.map((record) => harness.decode(record.payload).type)).toEqual([
      'RunCreated',
      'RunLifecycleTransitioned',
    ]);
  });

  it('retries run creation when replay shows the lost barrier append is absent', () => {
    const harness = createHarness({
      appendOutcomes: [{ code: 'partial-ack-unknown', commit: 'absent' }],
    });

    const result = harness.log.createRun({
      runId,
      holder: 'holder-1',
      leaseTtlMs: 60_000,
      idempotencyKey: 'idempotency-1',
      createdAt: '2026-06-23T12:00:00.000Z',
      payload: {
        idempotencyKey: 'idempotency-1',
        requestedBy: 'operator-1',
      },
    });

    expect(result.ok).toBe(true);
    expect(harness.appendCalls).toHaveLength(2);
    expect(harness.appendCalls[1].batch.expectedSequence).toBe(1);
    expect(harness.appendCalls[1].envelopes.map((envelope) => envelope.type)).toEqual([
      'RunCreated',
      'RunLifecycleTransitioned',
    ]);
  });

  it('releases the acquired writer lease when the initial append fails definitively', () => {
    const harness = createHarness({
      appendOutcomes: [{ code: 'network-fs-degraded', message: 'append failed', health: 'network-fs-degraded' }],
    });

    const failed = harness.log.createRun({
      runId,
      holder: 'holder-1',
      leaseTtlMs: 60_000,
      idempotencyKey: 'idempotency-1',
      createdAt: '2026-06-23T12:00:00.000Z',
      payload: {
        idempotencyKey: 'idempotency-1',
        requestedBy: 'operator-1',
      },
    });

    expect(failed.ok).toBe(false);
    expect(harness.releaseCalls).toEqual([
      {
        name: `run-writer:${runId}`,
        epoch: 1,
        token: 'token-1',
      },
    ]);

    const retry = harness.log.createRun({
      runId,
      holder: 'holder-1',
      leaseTtlMs: 60_000,
      idempotencyKey: 'idempotency-1',
      createdAt: '2026-06-23T12:00:01.000Z',
      payload: {
        idempotencyKey: 'idempotency-1',
        requestedBy: 'operator-1',
      },
    });

    expect(retry.ok).toBe(true);
  });
});
