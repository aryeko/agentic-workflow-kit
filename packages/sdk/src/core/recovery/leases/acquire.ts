import type { StoryLaunchLeaseAcquiredPayload } from '../contracts/index.js';

import { appendRecoveryLeaseEvent } from './append-event.js';
import { mapLeaseStoreAcquireFailure } from './error-mapping.js';
import { buildStoryLaunchKey } from './key.js';
import { assertSourceEventIds } from './shared.js';
import type { AcquireStoryLaunchLeaseInput, AcquireStoryLaunchLeaseResult } from './types.js';

const releaseIfHeld = (input: AcquireStoryLaunchLeaseInput, epoch: number, token: string): void => {
  input.leaseStore.release(buildStoryLaunchKey(input), epoch, token);
};

export const acquireStoryLaunchLease = (input: AcquireStoryLaunchLeaseInput): AcquireStoryLaunchLeaseResult => {
  assertSourceEventIds(input.sourceEventIds, 'StoryLaunchLeaseAcquired');

  const storyLaunchKey = buildStoryLaunchKey(input);
  const acquired = input.leaseStore.acquire(storyLaunchKey, input.holder, input.ttlMs);

  if ('code' in acquired) {
    return {
      ok: false,
      error: mapLeaseStoreAcquireFailure(acquired),
    };
  }

  const payload: StoryLaunchLeaseAcquiredPayload = {
    schema: 'kit-vnext.story-launch-lease-acquired.v1',
    runId: input.runId,
    storyLaunchKey,
    leaseEpoch: acquired.epoch,
    acquiredAt: input.acquiredAt,
    sourceEventIds: input.sourceEventIds,
  };

  const appended = appendRecoveryLeaseEvent(input.writer, {
    type: 'StoryLaunchLeaseAcquired',
    occurredAt: input.acquiredAt,
    payload,
    causationId: input.sourceEventIds[input.sourceEventIds.length - 1],
  });

  if (!appended.ok) {
    releaseIfHeld(input, acquired.epoch, acquired.token);
    return {
      ok: false,
      error: {
        reason: 'event-log-unwritable',
        appendFailure: appended.error,
        leaseCapability: acquired,
      },
    };
  }

  return {
    ok: true,
    value: {
      leaseCapability: acquired,
      payload,
      appendReceipt: appended.value,
    },
  };
};
