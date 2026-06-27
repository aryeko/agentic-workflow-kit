import type * as sdk from 'sdk';
import { foldRecoveryProjection } from 'sdk';
import { describe, expect, it } from 'vitest';

import { createEvent, leaseAcquiredPayloadFixture, runIdFixture } from './shared.js';

describe('core-06-s5 public sdk recovery projection imports', () => {
  it('imports the recovery projection fold helper from the sdk entrypoint', () => {
    const projection: sdk.RecoveryProjection = foldRecoveryProjection(runIdFixture, [
      createEvent({
        eventId: 'evt-lease-01',
        sequence: 1,
        type: 'StoryLaunchLeaseAcquired',
        payload: leaseAcquiredPayloadFixture(),
      }),
    ]);

    expect(typeof foldRecoveryProjection).toBe('function');
    expect(projection.activeStoryLaunchLease?.leaseEpoch).toBe(5);
  });
});
