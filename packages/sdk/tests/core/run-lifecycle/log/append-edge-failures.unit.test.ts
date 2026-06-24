import { describe, expect, it } from 'vitest';

import type { LeaseCapability, StorageError } from '../../../../src/index.js';

import { appendIntent, createHarness, expectFailureCode, runId } from './test-support.js';

const storageError = (code: StorageError['code'], health: StorageError['health']): StorageError => ({
  code,
  message: `storage:${code}`,
  health,
});

describe('RunEventLog and RunWriter edge failures', () => {
  it('returns event-log-unavailable when createRun cannot acquire the first lease', () => {
    const harness = createHarness();
    harness.leaseStore.acquire = () => storageError('lease-unavailable', 'network-fs-degraded');

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

    expectFailureCode(result, 'event-log-unavailable');
  });

  it('surfaces createRun append storage failures and partial acknowledgements', () => {
    const failed = createHarness({
      appendOutcomes: [storageError('log-interior-corrupt', 'log-interior-corrupt')],
    });
    const failure = failed.log.createRun({
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
    expectFailureCode(failure, 'interior-corrupt');

    const partial = createHarness({
      appendOutcomes: [{ acknowledged: true, durability: 'buffered', expectedSequence: 1 }],
    });
    const partialResult = partial.log.createRun({
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
    expectFailureCode(partialResult, 'partial-ack-unknown');
  });

  it('rejects empty batches and session ordinal gaps before attempting the requested append', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (writer.ok) {
      expectFailureCode(writer.value.append([]), 'sequence-conflict');
      expectFailureCode(
        writer.value.append([
          appendIntent(
            'SessionLinked',
            {
              linkOrdinal: 2,
              sessionId: 'session-2',
              linkRole: 'primary',
              startedAt: '2026-06-23T12:01:00.000Z',
              sourceEventId: 'source:2',
            },
            { durability: 'barrier' },
          ),
        ]),
        'illegal-lifecycle-transition',
      );
    }
  });

  it('maps append storage errors without returning a receipt', () => {
    const stale = createHarness({
      appendOutcomes: [storageError('stale-writer-fenced', 'ok')],
    });
    stale.seedCreatedRun();
    const staleWriter = stale.log.openWriter(runId, stale.acquireLease());
    expect(staleWriter.ok).toBe(true);
    if (staleWriter.ok) {
      expectFailureCode(staleWriter.value.append([appendIntent('SiblingFact', { ok: true })]), 'stale-writer-fenced');
    }

    const unavailable = createHarness({
      appendOutcomes: [storageError('network-fs-degraded', 'read-only')],
    });
    unavailable.seedCreatedRun();
    const unavailableWriter = unavailable.log.openWriter(runId, unavailable.acquireLease());
    expect(unavailableWriter.ok).toBe(true);
    if (unavailableWriter.ok) {
      expectFailureCode(
        unavailableWriter.value.append([appendIntent('SiblingFact', { ok: true })]),
        'event-log-unavailable',
      );
    }
  });

  it('rejects writers opened with a lease scoped to another run', () => {
    const harness = createHarness();
    const wrongRunLease = harness.leaseStore.acquire(
      `run-writer:${runId}:other`,
      'holder-other',
      60_000,
    ) as LeaseCapability;

    expectFailureCode(harness.log.openWriter(runId, wrongRunLease), 'stale-writer-fenced');
  });

  it('maps openForAppend and malformed replay failures to sequence-conflict', () => {
    const openFailure = createHarness();
    openFailure.seedCreatedRun();
    openFailure.eventLogStore.openForAppend = () => storageError('lease-unavailable', 'ok');
    const openFailureWriter = openFailure.log.openWriter(runId, openFailure.acquireLease());
    expect(openFailureWriter.ok).toBe(true);
    if (openFailureWriter.ok) {
      expectFailureCode(
        openFailureWriter.value.append([appendIntent('SiblingFact', { ok: true })]),
        'sequence-conflict',
      );
    }

    const malformedReplay = createHarness();
    malformedReplay.seedCreatedRun();
    malformedReplay.records.push({
      sequence: 4,
      writerEpoch: 1,
      leaseName: `run-writer:${runId}`,
      payloadLength: 1,
      payloadDigest: 'bad',
      frameDigest: 'bad-frame',
      byteRange: { start: 4, end: 5 },
      payload: new TextEncoder().encode('{'),
    });
    const malformedWriter = malformedReplay.log.openWriter(runId, malformedReplay.acquireLease());
    expect(malformedWriter.ok).toBe(true);
    if (malformedWriter.ok) {
      expectFailureCode(malformedWriter.value.append([appendIntent('SiblingFact', { ok: true })]), 'sequence-conflict');
    }
  });

  it('rejects barrier-owned event types when requested as durable', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);
    if (writer.ok) {
      expectFailureCode(
        writer.value.append([
          appendIntent(
            'RunPolicyBound',
            {
              policyDigest: 'sha256:policy',
              provenanceRef: 'policy/ref',
            },
            { durability: 'durable' },
          ),
        ]),
        'durability-insufficient',
      );
      expect(harness.appendCalls).toHaveLength(1);
      expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
      expect(harness.appendCalls[0].envelopes[0].payload).toMatchObject({
        attemptedType: 'RunPolicyBound',
        failureCode: 'durability-insufficient',
      });
    }
  });

  it('rejects malformed declared payloads before appending the requested event', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (!writer.ok) {
      throw new Error('expected writer');
    }

    const result = writer.value.append([
      appendIntent(
        'RunPolicyBound',
        {
          provenanceRef: 'policy/ref',
        },
        { durability: 'barrier' },
      ),
    ]);

    expectFailureCode(result, 'illegal-lifecycle-transition');
    expect(harness.appendCalls).toHaveLength(1);
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
    expect(harness.appendCalls[0].envelopes[0].payload).toMatchObject({
      attemptedType: 'RunPolicyBound',
      failureCode: 'illegal-lifecycle-transition',
      recordedReason: 'Declared event payload is malformed.',
    });
    expect(harness.records.map((record) => harness.decode(record.payload).type)).not.toContain('RunPolicyBound');
  });

  it('rejects JSON-unreplayable envelopes before appending the requested event', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (!writer.ok) {
      throw new Error('expected writer');
    }

    const result = writer.value.append([
      appendIntent('SiblingFact', undefined, {
        durability: 'barrier',
      }),
    ]);

    expectFailureCode(result, 'illegal-lifecycle-transition');
    expect(harness.appendCalls).toHaveLength(1);
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
    expect(harness.appendCalls[0].envelopes[0].payload).toMatchObject({
      attemptedType: 'SiblingFact',
      failureCode: 'illegal-lifecycle-transition',
      recordedReason: 'Append event envelope is not JSON replayable.',
    });
    expect(harness.records.map((record) => harness.decode(record.payload).type)).not.toContain('SiblingFact');
  });

  it('preserves caller-supplied payload digests when they match the payload', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (writer.ok) {
      const payload = { ok: true };
      const payloadDigest = `digest:${JSON.stringify(payload)}`;
      const result = writer.value.append([
        appendIntent('SiblingFact', payload, {
          payloadDigest,
        }),
      ]);

      expect(result.ok).toBe(true);
      expect(harness.appendCalls[0]?.envelopes[0]?.payloadDigest).toBe(payloadDigest);
    }
  });

  it('rejects caller-supplied payload digests that do not match the payload before appending', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (writer.ok) {
      const result = writer.value.append([
        appendIntent(
          'SiblingFact',
          { ok: true },
          {
            payloadDigest: 'sha256:stale',
          },
        ),
      ]);

      expectFailureCode(result, 'sequence-conflict');
      expect(harness.appendCalls).toHaveLength(0);
    }
  });

  it('accepts recovery retries backed by a committed core-06 recovery event', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    harness.seedLifecycle('runner-verifying', 3);
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (!writer.ok) {
      throw new Error('expected writer');
    }

    const recovery = writer.value.append([
      appendIntent(
        'RecoveryClassified',
        {
          classification: 'evidence-refresh-retryable',
          recommendedAction: 'retry-evidence-refresh',
        },
        { eventId: 'evt-recovery-classified', domain: 'core-06', durability: 'barrier' },
      ),
    ]);
    expect(recovery.ok).toBe(true);

    const transition = writer.value.append([
      appendIntent(
        'RunLifecycleTransitioned',
        {
          from: 'runner-verifying',
          to: 'running',
          reason: 'retry evidence refresh',
          authority: 'recovery',
          sourceEventIds: ['evt-recovery-classified'],
        },
        { durability: 'durable' },
      ),
    ]);

    expect(transition.ok).toBe(true);
  });

  it('renews only with a currently fenced lease', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const lease = harness.acquireLease();
    const writer = harness.log.openWriter(runId, lease);
    expect(writer.ok).toBe(true);

    const renewed = harness.leaseStore.renew(lease.name, lease.epoch, lease.token, 60_000);
    if ('code' in renewed) {
      throw new Error('expected renewed lease');
    }

    if (writer.ok) {
      expect(writer.value.renew(renewed).ok).toBe(true);
      expectFailureCode(writer.value.renew(lease), 'stale-writer-fenced');

      const wrongRunLease = harness.leaseStore.acquire(
        `run-writer:${runId}:other`,
        'holder-other',
        60_000,
      ) as LeaseCapability;
      expectFailureCode(writer.value.renew(wrongRunLease), 'stale-writer-fenced');
    }
  });
});
