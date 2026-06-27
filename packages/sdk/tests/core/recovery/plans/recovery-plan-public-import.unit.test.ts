import type * as sdk from 'sdk';
import {
  buildRecoveryLifecycleEdgeRequest,
  planRecoveryAction,
  recordRecoveryActionApplied,
  recordRecoveryClassified,
  recordRecoveryPlan,
} from 'sdk';
import { describe, expect, it } from 'vitest';

import {
  appliedAtFixture,
  classificationFixture,
  createWriterHarness,
  gateRecordFixture,
  planInputFixture,
  recoveryClassifiedPayloadFixture,
} from './shared.js';

describe('core-06-s4 public sdk recovery plan imports', () => {
  it('imports the recovery planning and apply helpers from the sdk entrypoint', () => {
    const writerHarness = createWriterHarness();
    const planInput: sdk.PlanRecoveryActionInput = planInputFixture();
    const classification: sdk.RecoveryClassification = classificationFixture();
    const classifiedPayload: sdk.RecoveryClassifiedPayload = recoveryClassifiedPayloadFixture();
    const classified = recordRecoveryClassified({
      payload: classifiedPayload,
      writer: writerHarness.writer,
    });

    expect(classified.ok).toBe(true);
    if (!classified.ok) {
      throw new Error('expected classified append to succeed');
    }

    const plan = planRecoveryAction(planInput, classification);
    const planned = recordRecoveryPlan({
      runId: planInput.runId,
      plan,
      plannedAt: planInput.plannedAt,
      classifiedEventId: classified.value.eventId,
      writer: writerHarness.writer,
    });

    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error('expected plan append to succeed');
    }

    const applyInput: sdk.RecordRecoveryActionAppliedInput = {
      runId: planInput.runId,
      committedPlan: planned.value.committedPlan,
      appliedAt: appliedAtFixture,
      evaluatedThrough: planInput.evaluatedThrough,
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
    };
    const applied = recordRecoveryActionApplied(applyInput);
    const lifecycle = buildRecoveryLifecycleEdgeRequest({
      plan,
      from: 'settling',
      recoveryEventIds: ['evt-recovery-classified-01', 'evt-recovery-plan-01'],
    });

    expect(typeof planRecoveryAction).toBe('function');
    expect(typeof recordRecoveryClassified).toBe('function');
    expect(typeof recordRecoveryPlan).toBe('function');
    expect(typeof recordRecoveryActionApplied).toBe('function');
    expect(typeof buildRecoveryLifecycleEdgeRequest).toBe('function');
    expect(applied.ok).toBe(true);
    expect(lifecycle.ok).toBe(true);
  });
});
