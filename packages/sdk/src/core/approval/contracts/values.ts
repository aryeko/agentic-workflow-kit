import type { ResolvedPolicy } from '../../../foundation/configuration-policy/index.js';
import type { AgentApprovalRequest, ScopedGrant } from '../../../providers/agent/index.js';
import type { RunProjections, RunReplay } from '../../run-lifecycle/contracts/index.js';

import type { ApprovalFailureState } from './failures.js';
import type { ApprovalMode, ApprovalRisk, ApprovalSubject, PolicyGrantScope } from './unions.js';

export interface ApprovalRequest {
  readonly schema: 'kit-vnext.approval-request.v1';
  readonly requestId: string;
  readonly runId: string;
  readonly taskId: string;
  readonly sessionId: string;
  readonly operationId: string;
  readonly subject: ApprovalSubject;
  readonly promptRef: string;
  readonly command?: string;
  readonly cwd?: string;
  readonly host?: string;
  readonly filePaths?: readonly string[];
  readonly worktreePath?: string;
  readonly requestedScope?: PolicyGrantScope;
  readonly answerChannelRef: string;
  readonly answerChannelPersistable: boolean;
  readonly requestedAt: string;
  readonly expiresAt?: string;
  readonly policyRef: string;
  readonly agentRequestEventId: string;
}

export interface ApprovalContext {
  readonly runId: string;
  readonly taskId: string;
  readonly operationId: string;
  readonly sessionId: string;
  readonly policyRef: string;
  readonly agentRequestEventId: string;
  readonly worktreePath?: string;
  readonly requestedAt: string;
  readonly promptRef: string;
  readonly subjectOverride?: ApprovalSubject;
}

export interface PolicyGrantPlan {
  readonly grantId: string;
  readonly scope: PolicyGrantScope;
  readonly command?: string;
  readonly commandPrefix?: readonly string[];
  readonly host?: string;
  readonly sessionId?: string;
  readonly expiresAt?: string;
  readonly reason: string;
}

export interface Decision {
  readonly schema: 'kit-vnext.approval-decision.v1';
  readonly decisionId: string;
  readonly requestId: string;
  readonly risk: ApprovalRisk;
  readonly mode: ApprovalMode;
  readonly decision: 'grant' | 'deny' | 'human-required' | 'expired' | 'blocked';
  readonly policyGrantPlan?: PolicyGrantPlan;
  readonly grant?: ScopedGrant;
  readonly deniedScope?: PolicyGrantScope;
  readonly decidedBy: 'policy' | 'operator' | 'system';
  readonly sourceEventIds: readonly string[];
  readonly capabilityGateEventId?: string;
  readonly policyRef: string;
  readonly reason: string;
  readonly decidedAt: string;
}

export interface Outcome {
  readonly schema: 'kit-vnext.approval-outcome.v1';
  readonly outcomeId: string;
  readonly requestId: string;
  readonly decisionId: string;
  readonly outcome: 'answered' | 'denied' | 'parked' | 'resumed' | 'expired' | 'blocked' | 'failed';
  readonly agentAnswerEventId?: string;
  readonly lifecycleEventId?: string;
  readonly failureState?: ApprovalFailureState;
  readonly recordedAt: string;
}

export interface ProtectedPolicyApprovalBinding {
  readonly runId: string;
  readonly candidateHeadSha: string;
  readonly protectedPolicySnapshotEventId: string;
  readonly newPolicyDigest?: string;
}

export interface ApprovalDecisionInput {
  readonly request: ApprovalRequest;
  readonly risk: ApprovalRisk;
  readonly mode: ApprovalMode;
  readonly policy: ResolvedPolicy;
  readonly replay: RunReplay;
  readonly projections: RunProjections;
  readonly evaluatedAt: string;
  readonly gateRecordEventId?: string;
  readonly operatorDecisionEventId?: string;
}

export interface ApprovalOutcomeInput {
  readonly request: ApprovalRequest;
  readonly decision: Decision;
  readonly agentAnswerEventId?: string;
  readonly failureState?: ApprovalFailureState;
  readonly recordedAt: string;
}

export interface ApprovalResumeInput {
  readonly requestId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly decisionEventId: string;
  readonly evaluatedAt: string;
}

export interface ApprovalParkInput {
  readonly request: ApprovalRequest;
  readonly reason: 'live-window-elapsed' | 'live-only-channel' | 'operator-attention';
  readonly decisionDeadline: string;
  readonly parkedAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface ParkDecision {
  readonly schema: 'kit-vnext.approval-park-decision.v1';
  readonly requestId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly reason: 'live-window-elapsed' | 'live-only-channel' | 'operator-attention';
  readonly decisionDeadline: string;
  readonly parkedAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface ResumeDecision {
  readonly schema: 'kit-vnext.approval-resume-decision.v1';
  readonly requestId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly decisionEventId: string;
  readonly outcome: 'resume' | 'expired' | 'blocked';
  readonly grant?: ScopedGrant;
  readonly failureState?: ApprovalFailureState;
  readonly sourceEventIds: readonly string[];
  readonly evaluatedAt: string;
}

export interface ApprovalEscalation {
  normalize(input: AgentApprovalRequest, context: ApprovalContext): ApprovalRequest;
  classify(
    request: ApprovalRequest,
    policy: ResolvedPolicy,
    replay: RunReplay,
    projections: RunProjections,
    classifiedAt: string,
  ): ApprovalRisk;
  decide(input: ApprovalDecisionInput): Decision;
  park(input: ApprovalParkInput): ParkDecision;
  recordOutcome(input: ApprovalOutcomeInput): Outcome;
  resumePending(input: ApprovalResumeInput): ResumeDecision;
}
