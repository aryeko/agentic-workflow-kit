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

const commitPlan = () => {
  const writerHarness = createWriterHarness();
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

  return { writerHarness, committedPlan: planned.value.committedPlan };
};

describe('core-06-s4 auto-recover-gate-required', () => {
  it('blocks autonomous apply when the committed auto-recover gate is missing', () => {
    const { writerHarness, committedPlan } = commitPlan();

    const result = recordRecoveryActionApplied({
      runId: planInputFixture().runId,
      committedPlan,
      appliedAt: appliedAtFixture,
      evaluatedThrough: planInputFixture().evaluatedThrough,
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

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected blocked result');
    }
    expect(result.value).toMatchObject({
      status: 'blocked',
      reason: 'operator-required',
      failureState: 'operator-required',
    });
    expect(writerHarness.appendCalls).toHaveLength(2);
  });

  it('blocks autonomous apply when the committed gate scope or action does not match the plan', () => {
    const { writerHarness, committedPlan } = commitPlan();

    const result = recordRecoveryActionApplied({
      runId: planInputFixture().runId,
      committedPlan,
      appliedAt: appliedAtFixture,
      evaluatedThrough: planInputFixture().evaluatedThrough,
      gateRef: gateRecordFixture({
        requestedAction: 'request-termination',
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

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected blocked result');
    }
    expect(result.value).toMatchObject({
      status: 'blocked',
      reason: 'operator-required',
      failureState: 'operator-required',
    });
    expect(writerHarness.appendCalls).toHaveLength(2);
  });

  it('does not grant autonomy in manual mode even when a matching gate record is supplied', () => {
    const writerHarness = createWriterHarness();
    const classified = recordRecoveryClassified({
      payload: recoveryClassifiedPayloadFixture(),
      writer: writerHarness.writer,
    });

    if (!classified.ok) {
      throw new Error('expected classified append to succeed');
    }

    const plan = planRecoveryAction(
      planInputFixture({
        mode: 'manual',
      }),
      classificationFixture(),
    );
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
        requestedAction: 'restart-from-cleared-state',
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

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected blocked result');
    }
    expect(result.value).toMatchObject({
      status: 'blocked',
      reason: 'operator-required',
      failureState: 'operator-required',
    });
    expect(writerHarness.appendCalls).toHaveLength(2);
  });
});
