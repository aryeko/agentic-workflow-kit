import type {
  ApprovalFailureState,
  ApprovalOutcomeRecordedPayload,
  ApprovalRequest,
  Decision,
  Outcome,
} from '../contracts/index.js';
import type { RunAppendFailure, RunAppendReceipt, RunWriter } from '../../run-lifecycle/contracts/index.js';

export type ApprovalOutcomeIdGenerator = () => string;

export type ApprovalOutcomeKind = Outcome['outcome'];

export type ApprovalOutcomeWriter = Pick<RunWriter, 'append'>;

export interface RecordApprovalOutcomeInput {
  readonly request: ApprovalRequest;
  readonly decision: Decision;
  readonly outcome: ApprovalOutcomeKind;
  readonly agentAnswerEventId?: string;
  readonly lifecycleEventId?: string;
  readonly failureState?: ApprovalFailureState;
  readonly recordedAt: string;
  readonly sourceEventIds: readonly string[];
  readonly ids: ApprovalOutcomeIdGenerator;
}

export interface ApprovalOutcomeRecordCommit {
  readonly outcome: Outcome;
  readonly payload: ApprovalOutcomeRecordedPayload;
  readonly eventId: string;
  readonly appendReceipt: RunAppendReceipt;
}

export interface ApprovalOutcomeRecordFailure {
  readonly reason: 'approval-event-log-unavailable';
  readonly appendFailure: RunAppendFailure;
}
