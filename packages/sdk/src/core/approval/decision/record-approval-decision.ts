import type { AppendIntent, Result } from '../../run-lifecycle/contracts/index.js';

import type { ApprovalDecisionRecordedPayload } from '../contracts/index.js';

import type {
  ApprovalDecisionRecordCommit,
  ApprovalDecisionRecordFailure,
  RecordApprovalDecisionInput,
} from './types.js';

export const recordApprovalDecision = async (
  input: RecordApprovalDecisionInput,
  writer: {
    append: (
      batch: AppendIntent[],
    ) => Result<ApprovalDecisionRecordCommit['appendReceipt'], ApprovalDecisionRecordFailure['appendFailure']>;
  },
): Promise<Result<ApprovalDecisionRecordCommit, ApprovalDecisionRecordFailure>> => {
  const requiresBinding = input.request.subject === 'protected-policy-change';
  if (requiresBinding && input.protectedPolicyBinding === undefined) {
    return {
      ok: false,
      error: {
        reason: 'protected-policy-binding-required',
      },
    };
  }

  if (!requiresBinding && input.protectedPolicyBinding !== undefined) {
    return {
      ok: false,
      error: {
        reason: 'protected-policy-binding-forbidden',
      },
    };
  }

  const payload: ApprovalDecisionRecordedPayload = {
    schema: 'kit-vnext.approval-decision-recorded.v1',
    decision: input.decision,
    ...(input.operatorDecisionEventId === undefined ? {} : { operatorDecisionEventId: input.operatorDecisionEventId }),
    ...(input.capabilityGateEventId === undefined ? {} : { capabilityGateEventId: input.capabilityGateEventId }),
    sourceEventIds: [...input.sourceEventIds],
    ...(input.protectedPolicyBinding === undefined ? {} : { protectedPolicyBinding: input.protectedPolicyBinding }),
  };

  const appendIntent: AppendIntent<ApprovalDecisionRecordedPayload> = {
    domain: 'core-03',
    type: 'ApprovalDecisionRecorded',
    durability: 'barrier',
    payload,
    occurredAt: input.decision.decidedAt,
  };

  const appendResult = await Promise.resolve(writer.append([appendIntent]));
  if (!appendResult.ok) {
    return {
      ok: false,
      error: {
        reason: 'approval-event-log-unavailable',
        appendFailure: appendResult.error,
      },
    };
  }

  return {
    ok: true,
    value: {
      payload,
      eventId: appendResult.value.eventIds[0] ?? 'ApprovalDecisionRecorded',
      appendReceipt: appendResult.value,
    },
  };
};
