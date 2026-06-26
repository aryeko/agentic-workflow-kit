import type { ApprovalRiskClassificationResult } from './types.js';
import type { ApprovalRiskClassificationInput } from './types.js';

import {
  allowRuleForCommand,
  buildClassification,
  containsUnsafeCommandSyntax,
  defaultRequestedScope,
  evaluateAgentCapability,
  hasPolicyProvenance,
  hasSelfReportOnlyEvidence,
  isScopeBroaderThan,
  isWildcardOrPrivateHost,
  normalizePathInside,
  requestLinkageState,
} from './shared.js';

const HIGH_RULE_SESSION_SCOPE = 'approval-high-session-scope';
const HIGH_RULE_UNSAFE_COMMAND = 'approval-high-command-unsafe-syntax';
const HIGH_RULE_HOST = 'approval-high-host-wildcard-or-private';
const HIGH_RULE_FILE_PATH = 'approval-high-file-outside-workspace';
const HIGH_RULE_LINKAGE = 'approval-high-session-linkage-ambiguous';
const HIGH_RULE_RELAY = 'approval-high-relay-missing';
const HIGH_RULE_SELF_REPORT = 'approval-high-self-report-only-evidence';
const LOW_RULE_ALLOWLIST = 'approval-low-command-allowlist';

export const classifyApprovalRisk = (input: ApprovalRiskClassificationInput): ApprovalRiskClassificationResult => {
  if (!hasPolicyProvenance(input.policy)) {
    return {
      ok: false,
      error: {
        failureState: 'approval-policy-unavailable',
        reason: 'Resolved policy or provenance is unavailable.',
      },
    };
  }

  const evidenceEventIds: string[] = [input.request.agentRequestEventId];
  const requestedScope = defaultRequestedScope(input.request);
  if (
    requestedScope === 'session' ||
    isScopeBroaderThan(requestedScope, input.policy.policy.escalationPolicy.maxGrantScope)
  ) {
    return {
      ok: true,
      value: buildClassification('high', [HIGH_RULE_SESSION_SCOPE], evidenceEventIds, input.classifiedAt),
    };
  }

  if (
    input.request.subject === 'command' &&
    (input.request.command === undefined || containsUnsafeCommandSyntax(input.request.command))
  ) {
    return {
      ok: true,
      value: buildClassification('high', [HIGH_RULE_UNSAFE_COMMAND], evidenceEventIds, input.classifiedAt),
    };
  }

  if (
    (input.request.subject === 'network' || input.request.host !== undefined) &&
    isWildcardOrPrivateHost(input.request.host)
  ) {
    return {
      ok: true,
      value: buildClassification('high', [HIGH_RULE_HOST], evidenceEventIds, input.classifiedAt),
    };
  }

  if (input.request.filePaths !== undefined && input.request.filePaths.length > 0) {
    const worktreePath = input.request.worktreePath;
    if (
      worktreePath === undefined ||
      input.request.filePaths.some((filePath) => !normalizePathInside(filePath, worktreePath))
    ) {
      return {
        ok: true,
        value: buildClassification('high', [HIGH_RULE_FILE_PATH], evidenceEventIds, input.classifiedAt),
      };
    }
  }

  const linkage = requestLinkageState(input.request, input.projections);
  evidenceEventIds.push(...linkage.evidenceEventIds);
  if (!linkage.current) {
    return {
      ok: true,
      value: buildClassification('high', [HIGH_RULE_LINKAGE], evidenceEventIds, input.classifiedAt),
    };
  }

  const relay = evaluateAgentCapability(input.replay, 'canRelayApproval', input.request.sessionId, input.classifiedAt);
  evidenceEventIds.push(...relay.eventIds, ...relay.evidenceEventIds);
  if (!relay.freshPositive) {
    return {
      ok: true,
      value: buildClassification('high', [HIGH_RULE_RELAY], evidenceEventIds, input.classifiedAt),
    };
  }

  const selfReportOnly = hasSelfReportOnlyEvidence(input.replay, input.requestEvidenceRefs, input.classifiedAt);
  evidenceEventIds.push(...selfReportOnly.evidenceEventIds);
  if (selfReportOnly.highRisk) {
    return {
      ok: true,
      value: buildClassification('high', [HIGH_RULE_SELF_REPORT], evidenceEventIds, input.classifiedAt),
    };
  }

  const allowRule = allowRuleForCommand(input.policy, input.request.command);
  const persistCapability = evaluateAgentCapability(
    input.replay,
    'canPersistApprovalAnswerChannel',
    input.request.sessionId,
    input.classifiedAt,
  );
  evidenceEventIds.push(...persistCapability.eventIds, ...persistCapability.evidenceEventIds);

  const lowRiskEligible =
    input.request.subject === 'command' &&
    input.request.command !== undefined &&
    input.request.cwd !== undefined &&
    input.request.worktreePath !== undefined &&
    normalizePathInside(input.request.cwd, input.request.worktreePath) &&
    allowRule !== undefined &&
    !isScopeBroaderThan(requestedScope, allowRule.scope) &&
    input.request.answerChannelPersistable &&
    relay.freshPositive &&
    persistCapability.freshPositive &&
    linkage.current;

  if (lowRiskEligible) {
    return {
      ok: true,
      value: buildClassification('low', [LOW_RULE_ALLOWLIST], evidenceEventIds, input.classifiedAt),
    };
  }

  return {
    ok: true,
    value: buildClassification('medium', [], evidenceEventIds, input.classifiedAt),
  };
};
