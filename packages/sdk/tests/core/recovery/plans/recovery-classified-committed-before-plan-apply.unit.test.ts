import { describe, expect, it } from 'vitest';

import {
  planRecoveryAction,
  recordRecoveryActionApplied,
  recordRecoveryClassified,
  recordRecoveryPlan,
} from '../../../../src/core/recovery/plans/index.js';

import {
  appliedAtFixture,
  classificationFixture,
  createWriterHarness,
  expectSingleIntent,
  gateRecordFixture,
  planInputFixture,
  recoveryClassifiedPayloadFixture,
} from './shared.js';

describe('core-06-s4 recovery-classified-committed-before-plan-apply', () => {
  it('appends RecoveryClassified before RecoveryActionPlanned and RecoveryActionApplied success', () => {
    const writerHarness = createWriterHarness();
    const classified = recordRecoveryClassified({
      payload: recoveryClassifiedPayloadFixture(),
      writer: writerHarness.writer,
    });

    expect(classified.ok).toBe(true);
    if (!classified.ok) {
      throw new Error('expected classified append to succeed');
    }

    const plan = planRecoveryAction(planInputFixture(), classificationFixture());
    const planned = recordRecoveryPlan({
      runId: planInputFixture().runId,
      plan,
      plannedAt: planInputFixture().plannedAt,
      classifiedEventId: classified.value.eventId,
      writer: writerHarness.writer,
    });

    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error('expected plan append to succeed');
    }

    const applied = recordRecoveryActionApplied({
      runId: planInputFixture().runId,
      committedPlan: planned.value.committedPlan,
      appliedAt: appliedAtFixture,
      evaluatedThrough: planInputFixture().evaluatedThrough,
      gateRef: gateRecordFixture({
        scope: plan.requiresGate?.scope,
        requestedAction: plan.selectedAction,
      }),
      appliedControl: {
        kind: 'work-source-release',
        evidenceRefs: [
          {
            eventId: 'evt-apply-01',
            sequence: 62,
            payloadDigest: 'sha256:apply-01',
            type: 'ClaimReleaseRecorded',
          },
        ],
      },
      writer: writerHarness.writer,
    });

    expect(applied.ok).toBe(true);
    if (!applied.ok) {
      throw new Error('expected apply append to succeed');
    }
    expect(applied.value.status).toBe('applied');

    expect(expectSingleIntent(writerHarness.appendCalls, 0).type).toBe('RecoveryClassified');
    expect(expectSingleIntent(writerHarness.appendCalls, 1).type).toBe('RecoveryActionPlanned');
    expect(expectSingleIntent(writerHarness.appendCalls, 2).type).toBe('RecoveryActionApplied');

    const plannedIntent = expectSingleIntent<{
      readonly sourceEventIds: readonly string[];
    }>(writerHarness.appendCalls, 1);
    expect(plannedIntent.payload.sourceEventIds).toContain(classified.value.eventId);

    if (applied.value.status !== 'applied') {
      throw new Error('expected applied status');
    }
    expect(applied.value.payload.sourceEventIds).toEqual([
      classified.value.eventId,
      planned.value.committedPlan.planEventId,
    ]);
  });
});
