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
  gateRecordFixture,
  planInputFixture,
  recoveryClassifiedPayloadFixture,
} from './shared.js';

describe('core-06-s4 recovery-plan-apply-unwritable', () => {
  it('returns a blocked/unwritable failure when the classification append fails', () => {
    const writerHarness = createWriterHarness({ failAt: 1 });
    const result = recordRecoveryClassified({
      payload: recoveryClassifiedPayloadFixture(),
      writer: writerHarness.writer,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected unwritable failure');
    }
    expect(result.error).toMatchObject({
      reason: 'log-unwritable',
      phase: 'classified',
    });
  });

  it('returns a blocked/unwritable failure when the plan append fails', () => {
    const writerHarness = createWriterHarness({ failAt: 2 });
    const classified = recordRecoveryClassified({
      payload: recoveryClassifiedPayloadFixture(),
      writer: writerHarness.writer,
    });

    if (!classified.ok) {
      throw new Error('expected classified append to succeed');
    }

    const result = recordRecoveryPlan({
      runId: planInputFixture().runId,
      plan: planRecoveryAction(planInputFixture(), classificationFixture()),
      plannedAt: planInputFixture().plannedAt,
      classifiedEventId: classified.value.eventId,
      writer: writerHarness.writer,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected unwritable failure');
    }
    expect(result.error).toMatchObject({
      reason: 'log-unwritable',
      phase: 'plan',
    });
  });

  it('returns a blocked/unwritable failure when the apply append fails', () => {
    const writerHarness = createWriterHarness({ failAt: 3 });
    const classified = recordRecoveryClassified({
      payload: recoveryClassifiedPayloadFixture(),
      writer: writerHarness.writer,
    });

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

    if (!planned.ok) {
      throw new Error('expected plan append to succeed');
    }

    const result = recordRecoveryActionApplied({
      runId: planInputFixture().runId,
      committedPlan: planned.value.committedPlan,
      appliedAt: appliedAtFixture,
      evaluatedThrough: planInputFixture().evaluatedThrough,
      gateRef: gateRecordFixture({
        scope: plan.requiresGate?.scope,
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

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected unwritable failure');
    }
    expect(result.error).toMatchObject({
      reason: 'log-unwritable',
      phase: 'apply',
    });
  });
});
