import type { ApprovalAnswerResult, ScopedGrant } from '../../../providers/agent/index.js';
import type { Result } from '../../run-lifecycle/contracts/index.js';

import type {
  AnswerApprovalDecisionFailure,
  AnswerApprovalDecisionInput,
  AnswerApprovalDecisionResult,
} from './types.js';
import { UNSUPPORTED_AGENT_GRANT_KINDS } from './types.js';

export const answerApprovalDecision = async (input: AnswerApprovalDecisionInput): AnswerApprovalDecisionResult => {
  const grantValidation = validateAnswerableGrant(input.decision.grant);
  if (!grantValidation.ok) {
    return grantValidation;
  }

  if (input.relay === undefined) {
    return fail('approval-relay-missing', 'approval relay is missing');
  }

  const answer = {
    requestId: input.request.requestId,
    decisionEventId: input.decisionEventId,
    grant: grantValidation.value,
  };

  const relayResult = await Promise.resolve(input.relay.answerApproval(answer));
  if (!relayResult.ok) {
    return fail('approval-answer-channel-lost', 'approval answer channel was lost');
  }

  const answerValidation = validateAnswerResult(relayResult.value, input.request.answerChannelRef);
  if (!answerValidation.ok) {
    return answerValidation;
  }

  return {
    ok: true,
    value: {
      answer,
      result: relayResult.value,
    },
  };
};

const validateAnswerableGrant = (
  grant: ScopedGrant | undefined,
): Result<ScopedGrant, AnswerApprovalDecisionFailure> => {
  if (grant === undefined) {
    return fail('approval-grant-mapping-invalid', 'decision grant is required');
  }

  if (UNSUPPORTED_AGENT_GRANT_KINDS.includes(grant.kind as (typeof UNSUPPORTED_AGENT_GRANT_KINDS)[number])) {
    return fail('approval-grant-mapping-invalid', `unsupported Agent grant kind: ${grant.kind}`);
  }

  return { ok: true, value: grant };
};

const validateAnswerResult = (
  result: ApprovalAnswerResult,
  expectedChannelRef: string,
): Result<undefined, AnswerApprovalDecisionFailure> => {
  if (!result.delivered && !result.persisted) {
    return fail('approval-answer-channel-lost', 'approval answer was neither delivered nor persisted');
  }

  if (result.channelRef !== undefined && result.channelRef !== expectedChannelRef) {
    return fail('approval-outcome-ambiguous', 'approval answer channel did not match request channel');
  }

  if (result.evidenceRef === undefined || result.evidenceRef.trim() === '') {
    return fail('approval-outcome-ambiguous', 'approval answer evidence is missing');
  }

  return { ok: true, value: undefined };
};

const fail = (
  failureState: AnswerApprovalDecisionFailure['failureState'],
  reason: string,
): Result<never, AnswerApprovalDecisionFailure> => ({
  ok: false,
  error: { failureState, reason },
});
