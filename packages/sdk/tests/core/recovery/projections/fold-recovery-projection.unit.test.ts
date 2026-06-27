import { describe, expect, it } from 'vitest';

import {
  acquireStoryLaunchLease,
  planRecoveryAction,
  recordRecoveryActionApplied,
  recordRecoveryClassified,
  recordRecoveryPlan,
  requestStaleLaunchClearance,
} from '../../../../src/index.js';
import { foldRecoveryProjection } from '../../../../src/core/recovery/projections/index.js';

import {
  blockedPayloadFixture,
  classifiedPayloadFixture,
  clearedPayloadFixture,
  createEvent,
  duplicateLaunchPayloadFixture,
  leaseAcquiredPayloadFixture,
  plannedPayloadFixture,
  runIdFixture,
} from './shared.js';
import {
  clearanceRequestEventIdFixture,
  createWriterHarness as createPlanWriterHarness,
  gateRecordFixture,
  planInputFixture,
  recoveryClassifiedPayloadFixture,
  storyLaunchLeaseFixture,
} from '../plans/shared.js';
import {
  createLeaseStoreHarness,
  createWriterHarness as createLeaseWriterHarness,
  makeLeaseCapability,
  makeRecoverySnapshot,
  requestedAtFixture,
  sourceEventIdsFixture,
  storyLaunchKeyFixture,
  storyLaunchPartsFixture,
} from '../leases/shared.js';

describe('core-06-s5 foldRecoveryProjection', () => {
  it('recovery-projection-fields-from-replay', () => {
    const classification = classifiedPayloadFixture('operator-approval-needed', 'park-for-operator');
    const latestPlan = plannedPayloadFixture('plan-02', 'park-for-operator');
    const events = [
      createEvent({
        eventId: 'evt-recovery-plan-02',
        sequence: 5,
        type: 'RecoveryActionPlanned',
        payload: latestPlan,
      }),
      createEvent({
        eventId: 'evt-classified-01',
        sequence: 3,
        type: 'RecoveryClassified',
        payload: classifiedPayloadFixture('provider-evidence-gap', 'retry-evidence-refresh'),
      }),
      createEvent({
        eventId: 'evt-duplicate-01',
        sequence: 2,
        type: 'DuplicateLaunchBlocked',
        payload: duplicateLaunchPayloadFixture(),
      }),
      createEvent({
        eventId: 'evt-classified-02',
        sequence: 4,
        type: 'RecoveryClassified',
        payload: classification,
      }),
      createEvent({
        eventId: 'evt-blocked-01',
        sequence: 6,
        type: 'ReconciliationBlocked',
        payload: blockedPayloadFixture(),
      }),
      createEvent({
        eventId: 'evt-lease-01',
        sequence: 1,
        type: 'StoryLaunchLeaseAcquired',
        payload: leaseAcquiredPayloadFixture(),
      }),
    ];

    const projection = foldRecoveryProjection(runIdFixture, events);

    expect(projection).toEqual({
      runId: runIdFixture,
      latestClassification: classification,
      activeStoryLaunchLease: leaseAcquiredPayloadFixture(),
      duplicateLaunch: duplicateLaunchPayloadFixture(),
      latestPlan,
      parked: true,
    });
  });

  it('lease-clear-matching-epoch', () => {
    const projection = foldRecoveryProjection(runIdFixture, [
      createEvent({
        eventId: 'evt-lease-01',
        sequence: 1,
        type: 'StoryLaunchLeaseAcquired',
        payload: leaseAcquiredPayloadFixture(5),
      }),
      createEvent({
        eventId: 'evt-clear-01',
        sequence: 2,
        type: 'StoryLaunchLeaseCleared',
        payload: clearedPayloadFixture(5),
      }),
    ]);

    expect(projection.activeStoryLaunchLease).toBeUndefined();
  });

  it('lease-clear-mismatched-epoch-ignored', () => {
    const activeLease = leaseAcquiredPayloadFixture(5);
    const projection = foldRecoveryProjection(runIdFixture, [
      createEvent({
        eventId: 'evt-lease-01',
        sequence: 1,
        type: 'StoryLaunchLeaseAcquired',
        payload: activeLease,
      }),
      createEvent({
        eventId: 'evt-clear-01',
        sequence: 2,
        type: 'StoryLaunchLeaseCleared',
        payload: clearedPayloadFixture(4),
      }),
    ]);

    expect(projection.activeStoryLaunchLease).toEqual(activeLease);
  });

  it('recovery-projection-deterministic-replay', () => {
    const events = [
      createEvent({
        eventId: 'evt-blocked-01',
        sequence: 4,
        type: 'ReconciliationBlocked',
        payload: blockedPayloadFixture(),
      }),
      createEvent({
        eventId: 'evt-plan-01',
        sequence: 3,
        type: 'RecoveryActionPlanned',
        payload: plannedPayloadFixture('plan-01', 'park-for-operator'),
      }),
      createEvent({
        eventId: 'evt-classified-01',
        sequence: 2,
        type: 'RecoveryClassified',
        payload: classifiedPayloadFixture('operator-approval-needed', 'park-for-operator'),
      }),
      createEvent({
        eventId: 'evt-lease-01',
        sequence: 1,
        type: 'StoryLaunchLeaseAcquired',
        payload: leaseAcquiredPayloadFixture(),
      }),
    ];

    expect(foldRecoveryProjection(runIdFixture, events)).toEqual(
      foldRecoveryProjection(runIdFixture, [...events].reverse()),
    );
  });

  it('clears the stale acquired lease on replay for the real stale-clearance producer chain', () => {
    const leaseWriterHarness = createLeaseWriterHarness();
    const initialLeaseStore = createLeaseStoreHarness({
      acquireResult: makeLeaseCapability(4, storyLaunchKeyFixture),
    });
    const acquired = acquireStoryLaunchLease({
      runId: 'run-recovery-lease-01',
      ...storyLaunchPartsFixture,
      holder: 'run-recovery-lease-01',
      ttlMs: 30_000,
      acquiredAt: '2026-06-27T12:00:00.000Z',
      sourceEventIds: sourceEventIdsFixture,
      writer: leaseWriterHarness.writer,
      leaseStore: initialLeaseStore.leaseStore,
    });

    if (!acquired.ok) {
      throw new Error('expected initial story launch acquire to succeed');
    }

    const staleClearanceWriterHarness = createLeaseWriterHarness();
    const staleClearanceStore = createLeaseStoreHarness({
      acquireResult: makeLeaseCapability(5, storyLaunchKeyFixture),
    });
    const requested = requestStaleLaunchClearance({
      snapshot: makeRecoverySnapshot({
        leases: {
          ...makeRecoverySnapshot().leases,
          storyLaunch: {
            ...makeRecoverySnapshot().leases.storyLaunch!,
            epoch: acquired.value.payload.leaseEpoch,
          },
        },
      }),
      holder: 'run-recovery-lease-01',
      ttlMs: 30_000,
      requestedAt: requestedAtFixture,
      writer: staleClearanceWriterHarness.writer,
      leaseStore: staleClearanceStore.leaseStore,
    });

    if (!requested.ok) {
      throw new Error('expected stale clearance request to succeed');
    }

    const planWriterHarness = createPlanWriterHarness();
    const classified = recordRecoveryClassified({
      payload: recoveryClassifiedPayloadFixture({
        state: 'stale-launch-clearable',
        recommendedAction: 'clear-stale-launch',
        actionSafety: 'auto-safe',
        requiredGate: 'auto-recover',
        reason: 'stale launch can be cleared safely',
      }),
      writer: planWriterHarness.writer,
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
      writer: planWriterHarness.writer,
    });

    if (!planned.ok) {
      throw new Error('expected plan append to succeed');
    }

    const applied = recordRecoveryActionApplied({
      runId: planInputFixture().runId,
      committedPlan: planned.value.committedPlan,
      appliedAt: '2026-06-27T13:05:00.000Z',
      evaluatedThrough: planInputFixture().evaluatedThrough,
      gateRef: gateRecordFixture({
        scope: plan.requiresGate?.scope,
        requestedAction: 'clear-stale-launch',
      }),
      staleLaunchRequest: requested.value.payload,
      staleLaunchRequestEventId: clearanceRequestEventIdFixture,
      activeStoryLaunchLease: storyLaunchLeaseFixture(acquired.value.payload.leaseEpoch),
      writer: planWriterHarness.writer,
    });

    if (!applied.ok || applied.value.status !== 'applied' || applied.value.clearedPayload === undefined) {
      throw new Error('expected stale launch clear apply to succeed');
    }

    const projection = foldRecoveryProjection(runIdFixture, [
      createEvent({
        eventId: 'evt-lease-01',
        sequence: 1,
        type: 'StoryLaunchLeaseAcquired',
        payload: acquired.value.payload,
      }),
      createEvent({
        eventId: clearanceRequestEventIdFixture,
        sequence: 2,
        type: 'StaleLaunchClearanceRequested',
        payload: requested.value.payload,
      }),
      createEvent({
        eventId: 'evt-clear-01',
        sequence: 3,
        type: 'StoryLaunchLeaseCleared',
        payload: applied.value.clearedPayload,
      }),
    ]);

    expect(requested.value.payload.expiredLeaseEpoch).toBe(acquired.value.payload.leaseEpoch);
    expect(applied.value.clearedPayload.clearedLeaseEpoch).toBe(requested.value.payload.nextLeaseEpoch);
    expect(projection.activeStoryLaunchLease).toBeUndefined();
  });
});
