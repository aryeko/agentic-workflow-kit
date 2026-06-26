import type { ApprovalFailureState } from './failures.js';
import type { ApprovalState } from './unions.js';
import type { Decision, Outcome } from './values.js';

export interface PendingApprovalProjection {
  readonly requestId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly state: ApprovalState;
  readonly requestEventId: string;
  readonly pendingEventId: string;
  readonly latestDecisionEventId?: string;
  readonly latestOutcomeEventId?: string;
  readonly parkedEventId?: string;
  readonly resumedEventId?: string;
  readonly answerChannelRef: string;
  readonly answerChannelPersistable: boolean;
  readonly liveAnswerDeadline?: string;
  readonly decisionDeadline: string;
  readonly policyRef: string;
  readonly failureState?: ApprovalFailureState;
}

export interface ApprovalProjection {
  readonly runId: string;
  readonly pendingByRequestId: Readonly<Record<string, PendingApprovalProjection>>;
  readonly latestDecisionByRequestId: Readonly<Record<string, Decision>>;
  readonly latestOutcomeByRequestId: Readonly<Record<string, Outcome>>;
  readonly operatorAttention?: {
    readonly requestId: string;
    readonly reason: 'human-required' | 'parked';
    readonly sourceEventId: string;
  };
  readonly failureStateByRequestId: Readonly<Record<string, ApprovalFailureState>>;
}
