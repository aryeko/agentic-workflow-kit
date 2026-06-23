import { describe, expect, it } from 'vitest';

import type {
  AgentCapability,
  AgentFailureReason,
  AgentTerminalReason,
  ApprovalKind,
  ScopedGrantKind,
} from '../../../src/index.js';

describe('prov-01 agent union members', () => {
  it('defines capability, terminal, approval, grant, and failure members', () => {
    const capabilities = [
      'canRelayApproval',
      'canPersistApprovalAnswerChannel',
      'canResumeOwned',
      'emitsStructuredToolExit',
      'emitsGuardianReview',
      'preservesHostProcessParentage',
    ] satisfies readonly AgentCapability[];
    const terminalReasons = [
      'completed',
      'failed',
      'interrupted',
      'approval-parked',
      'provider-lost',
      'host-lost',
    ] satisfies readonly AgentTerminalReason[];
    const approvalKinds = [
      'command-execution',
      'file-change',
      'permissions',
      'mcp-elicitation',
      'tool-user-input',
      'apply-patch',
      'legacy-exec',
    ] satisfies readonly ApprovalKind[];
    const grantKinds = [
      'command-once',
      'command-session',
      'command-policy-amendment',
      'file-change-once',
      'file-change-session',
      'filesystem-permission',
      'network-permission',
      'mcp-elicitation-content',
      'tool-user-input-content',
      'deny-continue',
      'deny-interrupt',
      'deny-park',
    ] satisfies readonly ScopedGrantKind[];
    const failureReasons = [
      'agent-capability-unattested',
      'agent-linkage-lost',
      'approval-relay-unattested',
      'approval-answer-channel-lost',
      'agent-resume-unattested',
      'structured-tool-exit-missing',
      'tool-output-ref-missing',
      'guardian-review-untrusted',
      'host-parentage-unproven',
      'agent-terminal-ambiguous',
    ] satisfies readonly AgentFailureReason[];

    expect(capabilities).toContain('canPersistApprovalAnswerChannel');
    expect(terminalReasons).toContain('approval-parked');
    expect(approvalKinds).toContain('mcp-elicitation');
    expect(grantKinds).toContain('deny-park');
    expect(failureReasons).toContain('structured-tool-exit-missing');
  });
});
