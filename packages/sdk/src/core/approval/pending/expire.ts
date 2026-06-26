import type { Result } from '../../run-lifecycle/contracts/index.js';

import { expiredDecision, outcomeIntent, outcomePayload } from './decisions.js';
import type {
  ExpireApprovalInput,
  PendingWriter,
  ResumePendingApprovalCommit,
  ResumePendingApprovalFailure,
} from './types.js';

export const expireApproval = async (
  input: ExpireApprovalInput,
  writer: PendingWriter,
): Promise<Result<ResumePendingApprovalCommit, ResumePendingApprovalFailure>> => {
  const decision = expiredDecision(input);
  const payload = outcomePayload(
    input.pending,
    input.decisionEventId,
    input.evaluatedAt,
    'expired',
    'approval-expired',
    [...input.sourceEventIds],
  );
  const appendResult = await Promise.resolve(writer.append([outcomeIntent(payload, input.evaluatedAt)]));
  if (!appendResult.ok) {
    return {
      ok: false,
      error: { reason: 'approval-event-log-unavailable', appendFailure: appendResult.error, decision },
    };
  }

  return {
    ok: true,
    value: {
      decision,
      payload,
      eventId: appendResult.value.eventIds[0] ?? 'ApprovalOutcomeRecorded',
      appendReceipt: appendResult.value,
    },
  };
};
