import type {
  ApprovalAnswer,
  ApprovalAnswerResult,
  ScopedGrant,
  ScopedGrantKind,
} from '../../../providers/agent/index.js';
import type { Result } from '../../run-lifecycle/contracts/index.js';

import type { ApprovalFailureState, ApprovalRequest, Decision, PolicyGrantPlan } from '../contracts/index.js';

export type DenyDisposition = 'continue' | 'interrupt' | 'park';

export interface ApprovalDenyPlan {
  readonly disposition: DenyDisposition;
  readonly reason: string;
}

export interface MapPolicyGrantInput {
  readonly request: ApprovalRequest;
  readonly decisionEventId: string;
  readonly grantPlan?: PolicyGrantPlan;
  readonly deny?: ApprovalDenyPlan;
  readonly humanApproved?: boolean;
}

export interface ApprovalGrantMappingFailure {
  readonly failureState: 'approval-grant-mapping-invalid';
  readonly reason: string;
}

export type ApprovalGrantMappingResult = Result<ScopedGrant, ApprovalGrantMappingFailure>;

export type ApprovalRelayFailureReason = 'channel-lost';

export interface ApprovalRelay {
  answerApproval(answer: ApprovalAnswer): Result<ApprovalAnswerResult, { readonly reason: ApprovalRelayFailureReason }>;
}

export interface AnswerApprovalDecisionInput {
  readonly request: ApprovalRequest;
  readonly decision: Decision;
  readonly decisionEventId: string;
  readonly relay?: ApprovalRelay;
}

export interface AnswerApprovalDecisionCommit {
  readonly answer: ApprovalAnswer;
  readonly result: ApprovalAnswerResult;
}

export interface AnswerApprovalDecisionFailure {
  readonly failureState:
    | 'approval-grant-mapping-invalid'
    | 'approval-relay-missing'
    | 'approval-answer-channel-lost'
    | 'approval-outcome-ambiguous';
  readonly reason: string;
}

export type AnswerApprovalDecisionResult = Promise<Result<AnswerApprovalDecisionCommit, AnswerApprovalDecisionFailure>>;

export const UNSUPPORTED_AGENT_GRANT_KINDS = [
  'filesystem-permission',
  'file-change-once',
  'mcp-elicitation-content',
  'tool-user-input-content',
] as const satisfies readonly ScopedGrantKind[];

export type UnsupportedAgentGrantKind = (typeof UNSUPPORTED_AGENT_GRANT_KINDS)[number];

export type ApprovalGrantFailureState = Extract<
  ApprovalFailureState,
  | 'approval-grant-mapping-invalid'
  | 'approval-relay-missing'
  | 'approval-answer-channel-lost'
  | 'approval-outcome-ambiguous'
>;
