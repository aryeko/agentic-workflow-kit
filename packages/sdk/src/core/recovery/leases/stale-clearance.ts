import type { StaleLaunchClearanceRequestedPayload } from '../contracts/index.js';

import { appendRecoveryLeaseEvent } from './append-event.js';
import { mapLeaseStoreAcquireFailure } from './error-mapping.js';
import { proveStaleLaunchClearance } from './stale-clearance-proof.js';
import type { RequestStaleLaunchClearanceInput, RequestStaleLaunchClearanceResult } from './types.js';

export const requestStaleLaunchClearance = (
  input: RequestStaleLaunchClearanceInput,
): RequestStaleLaunchClearanceResult => {
  const proof = proveStaleLaunchClearance(input.snapshot);

  if (!proof.ok) {
    return proof;
  }

  const acquired = input.leaseStore.acquire(proof.storyLaunch.name, input.holder, input.ttlMs);

  if ('code' in acquired) {
    return {
      ok: false,
      error: mapLeaseStoreAcquireFailure(acquired),
    };
  }

  const payload: StaleLaunchClearanceRequestedPayload = {
    schema: 'kit-vnext.stale-launch-clearance-requested.v1',
    runId: input.snapshot.runId,
    storyLaunchKey: proof.storyLaunch.name,
    expiredLeaseEpoch: proof.storyLaunch.epoch,
    nextLeaseEpoch: acquired.epoch,
    requestedAt: input.requestedAt,
    evidenceRefs: input.snapshot.evidenceRefs,
  };

  const appended = appendRecoveryLeaseEvent(input.writer, {
    type: 'StaleLaunchClearanceRequested',
    occurredAt: input.requestedAt,
    payload,
  });

  if (!appended.ok) {
    input.leaseStore.release(acquired.name, acquired.epoch, acquired.token);
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
