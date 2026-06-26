import type { AppendIntent, Result } from '../../run-lifecycle/contracts/index.js';

import type { ApprovalRiskClassifiedPayload } from '../contracts/index.js';

import type {
  ApprovalRiskRecordCommit,
  ApprovalRiskRecordFailure,
  RecordApprovalRiskClassifiedInput,
} from './types.js';

export const recordApprovalRiskClassified = async (
  input: RecordApprovalRiskClassifiedInput,
  writer: {
    append: (
      batch: AppendIntent[],
    ) => Result<ApprovalRiskRecordCommit['appendReceipt'], ApprovalRiskRecordFailure['appendFailure']>;
  },
): Promise<Result<ApprovalRiskRecordCommit, ApprovalRiskRecordFailure>> => {
  const payload: ApprovalRiskClassifiedPayload = {
    schema: 'kit-vnext.approval-risk-classified.v1',
    requestId: input.requestId,
    risk: input.classification.risk,
    triggeredRuleIds: [...input.classification.triggeredRuleIds],
    evidenceEventIds: [...input.classification.evidenceEventIds],
    classifiedAt: input.classification.classifiedAt,
  };

  const appendIntent: AppendIntent<ApprovalRiskClassifiedPayload> = {
    domain: 'core-03',
    type: 'ApprovalRiskClassified',
    durability: 'durable',
    payload,
    occurredAt: payload.classifiedAt,
  };

  const appendResult = await Promise.resolve(writer.append([appendIntent]));
  if (!appendResult.ok) {
    return {
      ok: false,
      error: {
        failureState: 'approval-event-log-unavailable',
        appendFailure: appendResult.error,
      },
    };
  }

  return {
    ok: true,
    value: {
      payload,
      eventId: appendResult.value.eventIds[0] ?? 'ApprovalRiskClassified',
      appendReceipt: appendResult.value,
    },
  };
};
