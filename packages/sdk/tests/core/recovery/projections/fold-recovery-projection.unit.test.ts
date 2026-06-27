import { describe, expect, it } from 'vitest';

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
});
