export type ApprovalKind =
  | 'command-execution'
  | 'file-change'
  | 'permissions'
  | 'mcp-elicitation'
  | 'tool-user-input'
  | 'apply-patch'
  | 'legacy-exec';

export type ScopedGrantKind =
  | 'command-once'
  | 'command-session'
  | 'command-policy-amendment'
  | 'file-change-once'
  | 'file-change-session'
  | 'filesystem-permission'
  | 'network-permission'
  | 'mcp-elicitation-content'
  | 'tool-user-input-content'
  | 'deny-continue'
  | 'deny-interrupt'
  | 'deny-park';

export interface ApprovalAnswerChannel {
  readonly channelRef: string;
  readonly providerRequestId: string;
  readonly providerApprovalId?: string;
  readonly threadId?: string;
  readonly turnId?: string;
  readonly expiresAt?: string;
  readonly persistable: boolean;
  readonly evidenceRef: string;
}

export interface ScopedGrant {
  readonly grantId: string;
  readonly kind: ScopedGrantKind;
  readonly scope: 'request' | 'turn' | 'session';
  readonly command?: string;
  readonly commandPrefix?: readonly string[];
  readonly filePaths?: readonly string[];
  readonly networkHost?: string;
  readonly networkAction?: 'allow' | 'deny';
  readonly filesystemEntries?: readonly unknown[];
  readonly content?: unknown;
  readonly grantEventId: string;
}

export interface ApprovalAnswer {
  readonly requestId: string;
  readonly decisionEventId: string;
  readonly grant: ScopedGrant;
}

export interface AgentApprovalRequest {
  readonly requestId: string;
  readonly kind: ApprovalKind;
  readonly providerMethod: string;
  readonly prompt: string;
  readonly command?: string;
  readonly cwd?: string;
  readonly proposedGrant?: ScopedGrant;
  readonly answerChannel: ApprovalAnswerChannel;
}

export interface ApprovalAnswerResult {
  readonly delivered: boolean;
  readonly persisted: boolean;
  readonly channelRef?: string;
  readonly evidenceRef?: string;
  readonly at: string;
}
