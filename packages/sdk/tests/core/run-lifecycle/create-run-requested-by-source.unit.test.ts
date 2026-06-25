import { describe, expect, it } from 'vitest';

import type { RunCreatedPayload } from '../../../../src/index.js';
import { createHarness, runId } from './log/test-support.js';

describe('createRun — requestedBy sourced from input.requestedBy (AC-2)', () => {
  it('emits RunCreated payload with requestedBy taken from top-level input.requestedBy', () => {
    const harness = createHarness();

    const result = harness.log.createRun({
      runId,
      holder: 'holder-1',
      leaseTtlMs: 60_000,
      idempotencyKey: 'idem-sentinel',
      createdAt: '2026-06-25T00:00:00.000Z',
      requestedBy: 'requester-sentinel',
      payload: {
        idempotencyKey: 'idem-sentinel',
        requestedBy: 'requester-sentinel',
      },
    });

    expect(result.ok).toBe(true);

    const [call] = harness.appendCalls;
    const createdEnvelope = call.envelopes[0];
    expect(createdEnvelope.type).toBe('RunCreated');

    const payload = createdEnvelope.payload as RunCreatedPayload;
    expect(payload.requestedBy).toBe('requester-sentinel');
  });

  it('sources requestedBy exclusively from input.requestedBy, not from input.payload.requestedBy', () => {
    const harness = createHarness();

    const result = harness.log.createRun({
      runId,
      holder: 'holder-1',
      leaseTtlMs: 60_000,
      idempotencyKey: 'idem-sentinel',
      createdAt: '2026-06-25T00:00:00.000Z',
      requestedBy: 'top-level-source',
      payload: {
        idempotencyKey: 'idem-sentinel',
        requestedBy: 'payload-field-ignored',
      },
    });

    expect(result.ok).toBe(true);

    const [call] = harness.appendCalls;
    const createdEnvelope = call.envelopes[0];
    const payload = createdEnvelope.payload as RunCreatedPayload;
    expect(payload.requestedBy).toBe('top-level-source');
  });
});
