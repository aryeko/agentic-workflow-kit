import { describe, expect, it } from 'vitest';

import { recordReconciliationBlocked } from '../../../../src/core/recovery/reconciliation/index.js';

import {
  appendFailureFixture,
  blockedAtFixture,
  classifiedPayloadFixture,
  createWriterHarness,
  expectSingleIntent,
} from './shared.js';

describe('core-06-s5 reconciliation blocked recording', () => {
  it('reconciliation-blocked-fields-and-severity', () => {
    const writerHarness = createWriterHarness();
    const classified = classifiedPayloadFixture();

    const result = recordReconciliationBlocked({
      classified,
      parkedReason: 'operator approval is required before recovery can continue',
      severity: 'operator-attention',
      blockedAt: blockedAtFixture,
      writer: writerHarness.writer,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected reconciliation blocked append to succeed');
    }

    expect(result.value.payload).toEqual({
      schema: 'kit-vnext.reconciliation-blocked.v1',
      runId: classified.runId,
      recoveryState: classified.recoveryState,
      parkedReason: 'operator approval is required before recovery can continue',
      severity: 'operator-attention',
      evidenceRefs: classified.evidenceRefs,
      cursor: classified.cursor,
      blockedAt: blockedAtFixture,
    });

    expect(expectSingleIntent<typeof result.value.payload>(writerHarness.appendCalls)).toMatchObject({
      domain: 'core-06',
      type: 'ReconciliationBlocked',
      durability: 'barrier',
      occurredAt: blockedAtFixture,
      payload: result.value.payload,
    });
  });

  it.each([
    {
      name: 'operator-required-parks',
      classified: classifiedPayloadFixture(),
      severity: 'operator-attention' as const,
    },
    {
      name: 'forbidden-blocks',
      classified: classifiedPayloadFixture({
        state: 'terminal-no-recovery',
        actionSafety: 'forbidden',
        recommendedAction: 'block-run',
        reason: 'recovery is forbidden for this terminal state',
      }),
      severity: 'info' as const,
    },
  ])('$name', ({ classified, severity }) => {
    const writerHarness = createWriterHarness();

    const result = recordReconciliationBlocked({
      classified,
      parkedReason: classified.reason,
      severity,
      blockedAt: blockedAtFixture,
      writer: writerHarness.writer,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected reconciliation blocked append to succeed');
    }

    expect(result.value.payload.recoveryState).toBe(classified.recoveryState);
    expect(result.value.payload.evidenceRefs).toEqual(classified.evidenceRefs);
    expect(result.value.payload.cursor).toEqual(classified.cursor);
    expect(result.value.payload.severity).toBe(severity);
  });

  it('reconciliation-blocked-unwritable', () => {
    const writerHarness = createWriterHarness({ ok: false, error: appendFailureFixture });

    const result = recordReconciliationBlocked({
      classified: classifiedPayloadFixture(),
      parkedReason: 'event log is unwritable',
      severity: 'operator-attention',
      blockedAt: blockedAtFixture,
      writer: writerHarness.writer,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected reconciliation blocked append to fail');
    }

    expect(result.error).toEqual({
      reason: 'log-unwritable',
      phase: 'apply',
      appendFailure: appendFailureFixture,
    });
    expect(writerHarness.appendCalls).toHaveLength(1);
  });
});
