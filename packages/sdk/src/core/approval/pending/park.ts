import type { ApprovalParkInput, ApprovalParkedPayload, ParkDecision } from '../contracts/index.js';
import type { Result } from '../../run-lifecycle/contracts/index.js';

import type { ApprovalParkCommit, ApprovalParkFailure, PendingWriter } from './types.js';

export function parkApproval(input: ApprovalParkInput): ParkDecision;
export function parkApproval(
  input: ApprovalParkInput,
  writer: PendingWriter,
): Promise<Result<ApprovalParkCommit, ApprovalParkFailure>>;
export function parkApproval(
  input: ApprovalParkInput,
  writer?: PendingWriter,
): ParkDecision | Promise<Result<ApprovalParkCommit, ApprovalParkFailure>> {
  const decision: ParkDecision = {
    schema: 'kit-vnext.approval-park-decision.v1',
    requestId: input.request.requestId,
    runId: input.request.runId,
    sessionId: input.request.sessionId,
    reason: input.reason,
    decisionDeadline: input.decisionDeadline,
    parkedAt: input.parkedAt,
    sourceEventIds: [...input.sourceEventIds],
  };

  if (writer === undefined) {
    return decision;
  }

  return recordParked(decision, writer);
}

const recordParked = async (
  decision: ParkDecision,
  writer: PendingWriter,
): Promise<Result<ApprovalParkCommit, ApprovalParkFailure>> => {
  const payload: ApprovalParkedPayload = {
    schema: 'kit-vnext.approval-parked.v1',
    requestId: decision.requestId,
    runId: decision.runId,
    sessionId: decision.sessionId,
    reason: decision.reason,
    decisionDeadline: decision.decisionDeadline,
    parkedAt: decision.parkedAt,
    sourceEventIds: [...decision.sourceEventIds],
  };
  const appendResult = await Promise.resolve(
    writer.append([
      { domain: 'core-03', type: 'ApprovalParked', durability: 'barrier', payload, occurredAt: decision.parkedAt },
    ]),
  );
  if (!appendResult.ok) {
    return { ok: false, error: { reason: 'approval-event-log-unavailable', appendFailure: appendResult.error } };
  }

  return {
    ok: true,
    value: {
      decision,
      payload,
      eventId: appendResult.value.eventIds[0] ?? 'ApprovalParked',
      appendReceipt: appendResult.value,
    },
  };
};
