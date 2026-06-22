import type {
  AgentCapability,
  AgentFailureReason,
  AgentTerminalReason,
  ApprovalKind,
  ScopedGrantKind,
} from '../../../src/index.js';

const assertNever = (_value: never): never => {
  throw new Error('unreachable');
};

const agentCapabilityExhaustive = (value: AgentCapability): AgentCapability => {
  switch (value) {
    case 'canRelayApproval':
    case 'canPersistApprovalAnswerChannel':
    case 'canResumeOwned':
    case 'emitsStructuredToolExit':
    case 'emitsGuardianReview':
    case 'preservesHostProcessParentage':
      return value;
    default:
      return assertNever(value);
  }
};

const terminalReasonExhaustive = (value: AgentTerminalReason): AgentTerminalReason => {
  switch (value) {
    case 'completed':
    case 'failed':
    case 'interrupted':
    case 'approval-parked':
    case 'provider-lost':
    case 'host-lost':
      return value;
    default:
      return assertNever(value);
  }
};

const approvalKindExhaustive = (value: ApprovalKind): ApprovalKind => {
  switch (value) {
    case 'command-execution':
    case 'file-change':
    case 'permissions':
    case 'mcp-elicitation':
    case 'tool-user-input':
    case 'apply-patch':
    case 'legacy-exec':
      return value;
    default:
      return assertNever(value);
  }
};

const scopedGrantKindExhaustive = (value: ScopedGrantKind): ScopedGrantKind => {
  switch (value) {
    case 'command-once':
    case 'command-session':
    case 'command-policy-amendment':
    case 'file-change-once':
    case 'file-change-session':
    case 'filesystem-permission':
    case 'network-permission':
    case 'mcp-elicitation-content':
    case 'tool-user-input-content':
    case 'deny-continue':
    case 'deny-interrupt':
    case 'deny-park':
      return value;
    default:
      return assertNever(value);
  }
};

const failureReasonExhaustive = (value: AgentFailureReason): AgentFailureReason => {
  switch (value) {
    case 'agent-capability-unattested':
    case 'agent-linkage-lost':
    case 'approval-relay-unattested':
    case 'approval-answer-channel-lost':
    case 'agent-resume-unattested':
    case 'structured-tool-exit-missing':
    case 'tool-output-ref-missing':
    case 'guardian-review-untrusted':
    case 'host-parentage-unproven':
    case 'agent-terminal-ambiguous':
      return value;
    default:
      return assertNever(value);
  }
};

void agentCapabilityExhaustive;
void terminalReasonExhaustive;
void approvalKindExhaustive;
void scopedGrantKindExhaustive;
void failureReasonExhaustive;

// @ts-expect-error AC-prov-01 AgentCapability admits only the design literals.
const invalidAgentCapability: AgentCapability = 'canKill';

// @ts-expect-error AC-prov-01 AgentTerminalReason admits only the design literals.
const invalidTerminalReason: AgentTerminalReason = 'timed-out';

// @ts-expect-error AC-prov-01 ApprovalKind admits only the design literals.
const invalidApprovalKind: ApprovalKind = 'merge-pr';

// @ts-expect-error AC-prov-01 ScopedGrantKind admits only the design literals.
const invalidScopedGrantKind: ScopedGrantKind = 'approve-all';

// @ts-expect-error AC-prov-01 AgentFailureReason admits only the design literals.
const invalidFailureReason: AgentFailureReason = 'agent-misconfigured';

void invalidAgentCapability;
void invalidTerminalReason;
void invalidApprovalKind;
void invalidScopedGrantKind;
void invalidFailureReason;
