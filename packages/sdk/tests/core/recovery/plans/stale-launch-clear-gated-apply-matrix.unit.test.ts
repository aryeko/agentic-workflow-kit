import { describe, expect, it } from 'vitest';

import {
  planRecoveryAction,
  recordRecoveryActionApplied,
  recordRecoveryClassified,
  recordRecoveryPlan,
} from '../../../../src/core/recovery/plans/index.js';

import {
  appliedAtFixture,
  clearanceRequestEventIdFixture,
  createWriterHarness,
  gateRecordFixture,
  planInputFixture,
  recoveryClassifiedPayloadFixture,
  staleLaunchRequestFixture,
  storyLaunchLeaseFixture,
} from './shared.js';

describe('core-06-s4 stale-launch-clear-gated-apply-matrix', () => {
  it('records StoryLaunchLeaseCleared only for matching stale-launch classification, request, lease, and gate', () => {
    const writerHarness = createWriterHarness();
    const classified = recordRecoveryClassified({
      payload: recoveryClassifiedPayloadFixture({
        state: 'stale-launch-clearable',
        recommendedAction: 'clear-stale-launch',
        actionSafety: 'auto-safe',
        requiredGate: 'auto-recover',
        reason: 'stale launch can be cleared safely',
      }),
      writer: writerHarness.writer,
    });

    if (!classified.ok) {
      throw new Error('expected classified append to succeed');
    }

    const plan = planRecoveryAction(
      planInputFixture({
        requestedAction: 'clear-stale-launch',
        scope: {
          runId: planInputFixture().runId,
          operationId: 'recovery-plan-clear-stale-launch',
          providerScopes: [
            {
              provider: 'Execution Host',
              scope: 'lease:clear-stale-launch',
              freshnessKey: 'lease:clear-stale-launch:run-recovery-plan-01',
            },
          ],
        },
      }),
      {
        state: 'stale-launch-clearable',
        recommendedAction: 'clear-stale-launch',
        actionSafety: 'auto-safe',
        requiredGate: 'auto-recover',
        reason: 'stale launch can be cleared safely',
        evidenceRefs: recoveryClassifiedPayloadFixture().evidenceRefs,
      },
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

    const applied = recordRecoveryActionApplied({
      runId: planInputFixture().runId,
      committedPlan: planned.value.committedPlan,
      appliedAt: appliedAtFixture,
      evaluatedThrough: planInputFixture().evaluatedThrough,
      gateRef: gateRecordFixture({
        scope: plan.requiresGate?.scope,
        requestedAction: 'clear-stale-launch',
      }),
      staleLaunchRequest: staleLaunchRequestFixture(),
      staleLaunchRequestEventId: clearanceRequestEventIdFixture,
      activeStoryLaunchLease: storyLaunchLeaseFixture(),
      writer: writerHarness.writer,
    });

    expect(applied.ok).toBe(true);
    if (!applied.ok) {
      throw new Error('expected clear append to succeed');
    }
    expect(applied.value.status).toBe('applied');
    if (applied.value.status !== 'applied') {
      throw new Error('expected applied status');
    }
    expect(applied.value.clearedPayload?.clearedLeaseEpoch).toBe(5);
    expect(applied.value.clearedPayload?.sourceEventIds).toEqual([
      classified.value.eventId,
      planned.value.committedPlan.planEventId,
      clearanceRequestEventIdFixture,
    ]);
  });

  it('blocks ungated or mismatched stale-launch clears', () => {
    const writerHarness = createWriterHarness();
    const classified = recordRecoveryClassified({
      payload: recoveryClassifiedPayloadFixture({
        state: 'stale-launch-clearable',
        recommendedAction: 'clear-stale-launch',
        actionSafety: 'auto-safe',
        requiredGate: 'auto-recover',
        reason: 'stale launch can be cleared safely',
      }),
      writer: writerHarness.writer,
    });

    if (!classified.ok) {
      throw new Error('expected classified append to succeed');
    }

    const plan = planRecoveryAction(
      planInputFixture({
        requestedAction: 'clear-stale-launch',
      }),
      {
        state: 'stale-launch-clearable',
        recommendedAction: 'clear-stale-launch',
        actionSafety: 'auto-safe',
        requiredGate: 'auto-recover',
        reason: 'stale launch can be cleared safely',
        evidenceRefs: recoveryClassifiedPayloadFixture().evidenceRefs,
      },
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

    const blocked = recordRecoveryActionApplied({
      runId: planInputFixture().runId,
      committedPlan: planned.value.committedPlan,
      appliedAt: appliedAtFixture,
      evaluatedThrough: planInputFixture().evaluatedThrough,
      gateRef: gateRecordFixture({
        scope: plan.requiresGate?.scope,
        requestedAction: 'clear-stale-launch',
      }),
      staleLaunchRequest: staleLaunchRequestFixture({
        nextLeaseEpoch: 6,
      }),
      staleLaunchRequestEventId: clearanceRequestEventIdFixture,
      activeStoryLaunchLease: storyLaunchLeaseFixture(5),
      writer: writerHarness.writer,
    });

    expect(blocked.ok).toBe(true);
    if (!blocked.ok) {
      throw new Error('expected blocked result');
    }
    expect(blocked.value).toMatchObject({
      status: 'blocked',
      reason: 'operator-required',
      failureState: 'operator-required',
    });
    expect(writerHarness.appendCalls).toHaveLength(2);
  });
});
