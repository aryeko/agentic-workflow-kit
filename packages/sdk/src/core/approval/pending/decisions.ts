import type {
  ApprovalFailureState,
  ApprovalOutcomeRecordedPayload,
  ApprovalPendingPersistedPayload,
  Outcome,
  PendingApprovalProjection,
  ResumeDecision,
} from '../contracts/index.js';
import type { AppendIntent } from '../../run-lifecycle/contracts/index.js';

import type { ExpireApprovalInput, ResumePendingApprovalInput } from './types.js';

export const blockedDecision = (
  input: Pick<ResumePendingApprovalInput, 'requestId' | 'runId' | 'sessionId' | 'decisionEventId' | 'evaluatedAt'>,
  failureState: ApprovalFailureState,
  sourceEventIds: readonly string[],
): ResumeDecision => ({
  schema: 'kit-vnext.approval-resume-decision.v1',
  requestId: input.requestId,
  runId: input.runId,
  sessionId: input.sessionId,
  decisionEventId: input.decisionEventId,
  outcome: 'blocked',
  failureState,
  sourceEventIds: [...sourceEventIds],
  evaluatedAt: input.evaluatedAt,
});

export const expiredDecision = (input: ExpireApprovalInput): ResumeDecision => ({
  schema: 'kit-vnext.approval-resume-decision.v1',
  requestId: input.pending.requestId,
  runId: input.pending.runId,
  sessionId: input.pending.sessionId,
  decisionEventId: input.decisionEventId,
  outcome: 'expired',
  failureState: 'approval-expired',
  sourceEventIds: [...input.sourceEventIds],
  evaluatedAt: input.evaluatedAt,
});

export const outcomePayload = (
  pending: ApprovalPendingPersistedPayload | PendingApprovalProjection,
  decisionEventId: string,
  evaluatedAt: string,
  outcomeState: Outcome['outcome'],
  failureState: ApprovalFailureState,
  sourceEventIds: readonly string[],
): ApprovalOutcomeRecordedPayload => ({
  schema: 'kit-vnext.approval-outcome-recorded.v1',
  outcome: {
    schema: 'kit-vnext.approval-outcome.v1',
    outcomeId: `${pending.requestId}:${outcomeState}:${evaluatedAt}`,
    requestId: pending.requestId,
    decisionId: decisionEventId,
    outcome: outcomeState,
    failureState,
    recordedAt: evaluatedAt,
  },
  sourceEventIds: [...sourceEventIds],
});

export const outcomeIntent = (payload: ApprovalOutcomeRecordedPayload, occurredAt: string): AppendIntent => ({
  domain: 'core-03',
  type: 'ApprovalOutcomeRecorded',
  durability: 'barrier',
  payload,
  occurredAt,
});
