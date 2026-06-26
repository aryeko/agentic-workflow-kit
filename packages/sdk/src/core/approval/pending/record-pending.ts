import type { ApprovalPendingPersistedPayload, ApprovalRequestedPayload } from '../contracts/index.js';
import type { AppendIntent, Result } from '../../run-lifecycle/contracts/index.js';

import { deadlineFor } from './time.js';
import type {
  ApprovalPendingCommit,
  ApprovalPendingFailure,
  PendingWriter,
  RecordApprovalPendingInput,
} from './types.js';

export const recordApprovalPending = async (
  input: RecordApprovalPendingInput,
  writer: PendingWriter,
): Promise<Result<ApprovalPendingCommit, ApprovalPendingFailure>> => {
  const requestedPayload: ApprovalRequestedPayload = {
    schema: 'kit-vnext.approval-requested.v1',
    request: input.request,
    sourceAgentEventId: input.request.agentRequestEventId,
    recordedAt: input.recordedAt,
  };
  const pendingPayload: ApprovalPendingPersistedPayload = {
    schema: 'kit-vnext.approval-pending-persisted.v1',
    requestId: input.request.requestId,
    runId: input.request.runId,
    sessionId: input.request.sessionId,
    answerChannelRef: input.request.answerChannelRef,
    answerChannelPersistable: input.request.answerChannelPersistable,
    ...(input.liveAnswerDeadline === undefined ? {} : { liveAnswerDeadline: input.liveAnswerDeadline }),
    decisionDeadline: deadlineFor(input.request, input.decisionWindowMs),
    policyRef: input.request.policyRef,
    sourceRequestEventId: input.request.agentRequestEventId,
    recordedAt: input.recordedAt,
  };
  const batch: AppendIntent[] = [
    {
      domain: 'core-03',
      type: 'ApprovalRequested',
      durability: 'barrier',
      payload: requestedPayload,
      occurredAt: input.recordedAt,
    },
    {
      domain: 'core-03',
      type: 'ApprovalPendingPersisted',
      durability: 'barrier',
      payload: pendingPayload,
      occurredAt: input.recordedAt,
    },
  ];

  const appendResult = await Promise.resolve(writer.append(batch));
  if (!appendResult.ok) {
    return { ok: false, error: { reason: 'approval-request-unrecordable', appendFailure: appendResult.error } };
  }

  return {
    ok: true,
    value: {
      requestedPayload,
      pendingPayload,
      requestEventId: appendResult.value.eventIds[0] ?? 'ApprovalRequested',
      pendingEventId: appendResult.value.eventIds[1] ?? 'ApprovalPendingPersisted',
      appendReceipt: appendResult.value,
    },
  };
};
