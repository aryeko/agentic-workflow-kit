import type { DuplicateLaunchBlockedPayload } from '../contracts/index.js';

import { appendRecoveryLeaseEvent } from './append-event.js';
import { assertSourceEventIds } from './shared.js';
import type { RecordDuplicateLaunchBlockedInput, RecordDuplicateLaunchBlockedResult } from './types.js';

export const recordDuplicateLaunchBlocked = (
  input: RecordDuplicateLaunchBlockedInput,
): RecordDuplicateLaunchBlockedResult => {
  if (input.writer === undefined) {
    return {
      ok: false,
      error: {
        reason: 'duplicate-launch-active',
        failureState: 'launch-duplicate-active',
        incumbentLeaseEpoch: input.incumbentLeaseEpoch,
      },
    };
  }

  assertSourceEventIds(input.sourceEventIds, 'DuplicateLaunchBlocked');

  const payload: DuplicateLaunchBlockedPayload = {
    schema: 'kit-vnext.duplicate-launch-blocked.v1',
    runId: input.runId,
    storyLaunchKey: input.storyLaunchKey,
    incumbentLeaseEpoch: input.incumbentLeaseEpoch,
    blockedAt: input.blockedAt,
    sourceEventIds: input.sourceEventIds,
  };

  const appended = appendRecoveryLeaseEvent(input.writer, {
    type: 'DuplicateLaunchBlocked',
    occurredAt: input.blockedAt,
    payload,
    causationId: input.sourceEventIds[input.sourceEventIds.length - 1],
  });

  if (!appended.ok) {
    return {
      ok: false,
      error: {
        reason: 'event-log-unwritable',
        appendFailure: appended.error,
      },
    };
  }

  return {
    ok: true,
    value: {
      payload,
      appendReceipt: appended.value,
    },
  };
};
