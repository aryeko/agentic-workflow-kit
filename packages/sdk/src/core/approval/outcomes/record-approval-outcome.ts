import type { AppendIntent, Result } from '../../run-lifecycle/contracts/index.js';
import type { ApprovalOutcomeRecordedPayload, Outcome } from '../contracts/index.js';

import type {
  ApprovalOutcomeRecordCommit,
  ApprovalOutcomeRecordFailure,
  ApprovalOutcomeWriter,
  RecordApprovalOutcomeInput,
} from './types.js';

export const recordApprovalOutcome = async (
  input: RecordApprovalOutcomeInput,
  writer: ApprovalOutcomeWriter,
): Promise<Result<ApprovalOutcomeRecordCommit, ApprovalOutcomeRecordFailure>> => {
  const outcome: Outcome = {
    schema: 'kit-vnext.approval-outcome.v1',
    outcomeId: input.ids(),
    requestId: input.request.requestId,
    decisionId: input.decision.decisionId,
    outcome: input.outcome,
    ...(input.agentAnswerEventId === undefined ? {} : { agentAnswerEventId: input.agentAnswerEventId }),
    ...(input.lifecycleEventId === undefined ? {} : { lifecycleEventId: input.lifecycleEventId }),
    ...(input.failureState === undefined ? {} : { failureState: input.failureState }),
    recordedAt: input.recordedAt,
  };

  const payload: ApprovalOutcomeRecordedPayload = {
    schema: 'kit-vnext.approval-outcome-recorded.v1',
    outcome,
    sourceEventIds: [...input.sourceEventIds],
  };

  const appendIntent: AppendIntent<ApprovalOutcomeRecordedPayload> = {
    domain: 'core-03',
    type: 'ApprovalOutcomeRecorded',
    durability: 'barrier',
    payload,
    occurredAt: input.recordedAt,
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
      outcome,
      payload,
      eventId: appendResult.value.eventIds[0] ?? 'ApprovalOutcomeRecorded',
      appendReceipt: appendResult.value,
    },
  };
};
