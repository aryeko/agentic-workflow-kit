import type { AgentFailure } from './capabilities.js';
import type { AgentApprovalRequest } from './approvals.js';
import type { AgentSession } from './session.js';

export type AgentTerminalReason =
  | 'completed'
  | 'failed'
  | 'interrupted'
  | 'approval-parked'
  | 'provider-lost'
  | 'host-lost';

export interface ToolObserved {
  readonly observationId: string;
  readonly itemId?: string;
  readonly command: string;
  readonly cwd?: string;
  readonly exitCode: number;
  readonly outputRef: string;
  readonly outputDigest: string;
  readonly source: 'agent';
}

export interface GuardianReviewObserved {
  readonly reviewId: string;
  readonly targetItemId?: string;
  readonly actionType: string;
  readonly status: 'inProgress' | 'approved' | 'denied' | 'timedOut' | 'aborted';
  readonly riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  readonly rationaleRef?: string;
  readonly stable: boolean;
}

export type AgentEvent =
  | { readonly type: 'linked'; readonly session: AgentSession; readonly at: string }
  | {
      readonly type: 'progress';
      readonly sessionId: string;
      readonly message?: string;
      readonly itemId?: string;
      readonly at: string;
    }
  | {
      readonly type: 'approval-requested';
      readonly sessionId: string;
      readonly request: AgentApprovalRequest;
      readonly at: string;
    }
  | { readonly type: 'tool-observed'; readonly sessionId: string; readonly tool: ToolObserved; readonly at: string }
  | {
      readonly type: 'guardian-review';
      readonly sessionId: string;
      readonly review: GuardianReviewObserved;
      readonly at: string;
    }
  | { readonly type: 'degraded'; readonly sessionId?: string; readonly failure: AgentFailure; readonly at: string }
  | {
      readonly type: 'terminal';
      readonly sessionId: string;
      readonly reason: AgentTerminalReason;
      readonly exitCode?: number;
      readonly at: string;
    };
