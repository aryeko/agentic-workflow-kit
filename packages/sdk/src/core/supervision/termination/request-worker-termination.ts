import type { SupervisorTerminationRequestedPayload } from '../contracts/index.js';

import {
  appendSingleFact,
  appendSupervisionLost,
  ensureCoreFactAppendAllowed,
  isFreshPositiveCanKill,
  uniqueEventIds,
} from './shared.js';
import type {
  RequestWorkerTerminationCommit,
  RequestWorkerTerminationInput,
  RequestWorkerTerminationResult,
  SupervisionFactWriter,
  TerminationHost,
} from './types.js';

const shouldRecordUnavailable = (input: RequestWorkerTerminationInput): boolean =>
  input.workerHandle === undefined ||
  input.workerHandle.ownershipClass === 'observe-only' ||
  !isFreshPositiveCanKill(input.canKill, input.requestedAt);

export const requestWorkerTermination = async (
  input: RequestWorkerTerminationInput,
  deps: {
    readonly writer: SupervisionFactWriter;
    readonly host: TerminationHost;
  },
): Promise<RequestWorkerTerminationResult> => {
  const allowed = ensureCoreFactAppendAllowed(input.guard);
  if (!allowed.ok) {
    return allowed;
  }

  if (shouldRecordUnavailable(input)) {
    const supervisionLost = await appendSupervisionLost(deps.writer, {
      runId: input.runId,
      reason: 'termination-unavailable',
      lostAt: input.requestedAt,
      sourceEventIds: uniqueEventIds([input.timerEventId, ...input.sourceEventIds]),
    });
    if (!supervisionLost.ok) {
      return supervisionLost;
    }

    return {
      ok: true,
      value: {
        supervisionLost: supervisionLost.value,
      } satisfies RequestWorkerTerminationCommit,
    };
  }

  const workerHandle = input.workerHandle as NonNullable<RequestWorkerTerminationInput['workerHandle']>;
  const terminationRequestedPayload: SupervisorTerminationRequestedPayload = {
    schema: 'kit-vnext.supervisor-termination-requested.v1',
    runId: input.runId,
    workerHandleId: workerHandle.handleId,
    reason: input.reason,
    requestedAt: input.requestedAt,
    timerEventId: input.timerEventId,
    sourceEventIds: uniqueEventIds([input.timerEventId, ...input.sourceEventIds]),
  };

  const terminationRequested = await appendSingleFact(
    deps.writer,
    {
      type: 'SupervisorTerminationRequested',
      durability: 'barrier',
      occurredAt: terminationRequestedPayload.requestedAt,
      payload: terminationRequestedPayload,
    },
    'SupervisorTerminationRequested',
  );
  if (!terminationRequested.ok) {
    return terminationRequested;
  }

  const hostResult = deps.host.terminateWorker(workerHandle, input.terminationPolicy);
  if (hostResult.proof.containmentEmpty !== true) {
    const supervisionLost = await appendSupervisionLost(deps.writer, {
      runId: input.runId,
      reason: 'termination-unproven',
      lostAt: hostResult.proof.checkedAt,
      sourceEventIds: uniqueEventIds([terminationRequested.value.eventId, input.timerEventId, ...input.sourceEventIds]),
    });
    if (!supervisionLost.ok) {
      return supervisionLost;
    }

    return {
      ok: true,
      value: {
        terminationRequested: terminationRequested.value,
        supervisionLost: supervisionLost.value,
        hostResult,
      },
    };
  }

  return {
    ok: true,
    value: {
      terminationRequested: terminationRequested.value,
      hostResult,
    },
  };
};
