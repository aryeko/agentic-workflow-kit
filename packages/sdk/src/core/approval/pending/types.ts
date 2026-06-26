import type {
  ApprovalOutcomeRecordedPayload,
  ApprovalParkedPayload,
  ApprovalPendingPersistedPayload,
  ApprovalProjection,
  ApprovalRequest,
  ApprovalRequestedPayload,
  ApprovalResumedPayload,
  ParkDecision,
  PendingApprovalProjection,
  ResumeDecision,
} from '../contracts/index.js';
import type {
  RunAppendFailure,
  RunAppendReceipt,
  RunProjections,
  RunReplay,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';

export type PendingWriter = Pick<RunWriter, 'append'>;

export interface RecordApprovalPendingInput {
  readonly request: ApprovalRequest;
  readonly recordedAt: string;
  readonly decisionWindowMs?: number;
  readonly liveAnswerDeadline?: string;
  readonly replay?: RunReplay;
  readonly approvalProjection?: ApprovalProjection;
}

export interface ApprovalPendingCommit {
  readonly requestedPayload: ApprovalRequestedPayload;
  readonly pendingPayload: ApprovalPendingPersistedPayload;
  readonly requestEventId: string;
  readonly pendingEventId: string;
  readonly appendReceipt: RunAppendReceipt;
}

export interface ApprovalPendingFailure {
  readonly reason: 'approval-request-unrecordable';
  readonly appendFailure: RunAppendFailure;
}

export interface ApprovalParkCommit {
  readonly decision: ParkDecision;
  readonly payload: ApprovalParkedPayload;
  readonly eventId: string;
  readonly appendReceipt: RunAppendReceipt;
}

export interface ApprovalParkFailure {
  readonly reason: 'approval-event-log-unavailable';
  readonly appendFailure: RunAppendFailure;
}

export interface ResumePendingApprovalInput {
  readonly requestId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly decisionEventId: string;
  readonly evaluatedAt: string;
  readonly replay: RunReplay;
  readonly projections: RunProjections;
  readonly approvalProjection?: ApprovalProjection;
  readonly channelAvailable?: boolean;
}

export interface ResumePendingApprovalCommit {
  readonly decision: ResumeDecision;
  readonly payload?: ApprovalResumedPayload | ApprovalOutcomeRecordedPayload;
  readonly eventId?: string;
  readonly appendReceipt?: RunAppendReceipt;
}

export interface ResumePendingApprovalFailure {
  readonly reason: 'approval-event-log-unavailable';
  readonly appendFailure: RunAppendFailure;
  readonly decision: ResumeDecision;
}

export interface ExpireApprovalInput {
  readonly pending: ApprovalPendingPersistedPayload | PendingApprovalProjection;
  readonly decisionEventId: string;
  readonly evaluatedAt: string;
  readonly sourceEventIds: readonly string[];
}
