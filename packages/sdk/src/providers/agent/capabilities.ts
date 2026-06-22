export type AgentCapability =
  | 'canRelayApproval'
  | 'canPersistApprovalAnswerChannel'
  | 'canResumeOwned'
  | 'emitsStructuredToolExit'
  | 'emitsGuardianReview'
  | 'preservesHostProcessParentage';

export type AgentProtocolSurface = 'codex-mcp-server' | 'codex-app-server' | 'mock';

export type AgentEvidenceRequirement = 'schema' | 'live-smoke' | 'incident-replay' | 'adversarial';

export type AgentFailureReason =
  | 'agent-capability-unattested'
  | 'agent-linkage-lost'
  | 'approval-relay-unattested'
  | 'approval-answer-channel-lost'
  | 'agent-resume-unattested'
  | 'structured-tool-exit-missing'
  | 'tool-output-ref-missing'
  | 'guardian-review-untrusted'
  | 'host-parentage-unproven'
  | 'agent-terminal-ambiguous';

export interface AgentProbeScope {
  readonly driverId: string;
  readonly driverVersion: string;
  readonly platform: string;
  readonly protocolSurface: AgentProtocolSurface;
  readonly freshnessKey: string;
  readonly capabilities: readonly AgentCapability[];
  readonly hostAttestationIds: readonly string[];
  readonly evidenceRequired: AgentEvidenceRequirement;
  readonly at: string;
}

export interface AgentFailure {
  readonly reason: AgentFailureReason;
  readonly message: string;
  readonly retryable: boolean;
  readonly evidenceRef?: string;
}
