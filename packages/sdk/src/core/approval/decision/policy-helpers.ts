import type { CapabilityGateRecordPayload } from '../../capability/evaluator/index.js';
import type { ResolvedPolicy } from '../../../foundation/configuration-policy/index.js';
import type { AgentApprovalRequest, ApprovalKind, ScopedGrant } from '../../../providers/agent/index.js';

import type {
  ApprovalContext,
  ApprovalRequest,
  ApprovalRisk,
  ApprovalSubject,
  PolicyGrantPlan,
  PolicyGrantScope,
} from '../contracts/index.js';

import type { ApprovalDecisionIdGenerator, ApprovalRiskClassification } from './types.js';

const AUTO_GRANT_REQUESTED_ACTION = 'approval-auto-grant';

const scopeRank: Record<PolicyGrantScope, number> = {
  'per-command': 0,
  'per-command-prefix': 1,
  'per-host': 2,
  session: 3,
};

const kindToSubject: Record<ApprovalKind, ApprovalSubject> = {
  'command-execution': 'command',
  'legacy-exec': 'command',
  'file-change': 'file-change',
  'apply-patch': 'file-change',
  permissions: 'permission',
  'mcp-elicitation': 'input',
  'tool-user-input': 'input',
};

const proposedGrantToScope = (grant: ScopedGrant | undefined): PolicyGrantScope | undefined => {
  if (grant === undefined) {
    return undefined;
  }

  switch (grant.kind) {
    case 'command-once':
      return 'per-command';
    case 'command-policy-amendment':
      return 'per-command-prefix';
    case 'network-permission':
      return 'per-host';
    case 'command-session':
    case 'file-change-session':
      return 'session';
    default:
      return undefined;
  }
};

export const hasPolicyProvenance = (policy: ResolvedPolicy | undefined): policy is ResolvedPolicy =>
  policy !== undefined && Object.keys(policy.provenance).length > 0;

export const isScopeBroaderThan = (left: PolicyGrantScope, right: PolicyGrantScope): boolean =>
  scopeRank[left] > scopeRank[right];

export const allowRuleForCommand = (
  policy: ResolvedPolicy,
  command: string | undefined,
): ResolvedPolicy['policy']['escalationPolicy']['grantRules'][number] | undefined => {
  if (command === undefined) {
    return undefined;
  }

  const commandMatchesPrefix = (prefix: string): boolean => {
    if (!command.startsWith(prefix)) {
      return false;
    }
    if (command.length === prefix.length || /\s$/.test(prefix)) {
      return true;
    }

    return /\s/.test(command[prefix.length] ?? '');
  };

  for (const rule of policy.policy.escalationPolicy.grantRules) {
    if (rule.scope === 'per-command' && rule.prefixes?.some((prefix) => prefix === command)) {
      return rule;
    }

    if (rule.scope === 'per-command-prefix' && rule.prefixes?.some(commandMatchesPrefix)) {
      return rule;
    }
  }

  return undefined;
};

export const defaultRequestedScope = (request: ApprovalRequest): PolicyGrantScope =>
  request.requestedScope ?? 'per-command';

export const subjectFromRequest = (input: AgentApprovalRequest, context: ApprovalContext): ApprovalSubject =>
  context.subjectOverride ?? kindToSubject[input.kind];

export const requestedScopeFromRequest = (input: AgentApprovalRequest): PolicyGrantScope | undefined =>
  proposedGrantToScope(input.proposedGrant);

export const matchesAutoGrantScope = (request: ApprovalRequest, record: CapabilityGateRecordPayload): boolean =>
  record.capability === 'escalation-auto-grant' &&
  record.mode === 'assisted' &&
  record.scope.runId === request.runId &&
  record.scope.operationId === request.operationId &&
  record.scope.sessionId === request.sessionId &&
  (record.scope.taskId === undefined || record.scope.taskId === request.taskId) &&
  record.policyRef === request.policyRef &&
  record.requestedAction === AUTO_GRANT_REQUESTED_ACTION;

export const buildPolicyGrantPlan = (input: {
  readonly request: ApprovalRequest;
  readonly policy: ResolvedPolicy;
  readonly matchedRule: ResolvedPolicy['policy']['escalationPolicy']['grantRules'][number];
  readonly ids: ApprovalDecisionIdGenerator;
  readonly evaluatedAt: string;
}): PolicyGrantPlan | undefined => {
  const requestedScope = defaultRequestedScope(input.request);
  const candidateScopes: PolicyGrantScope[] = [];

  if (input.request.command !== undefined) {
    candidateScopes.push('per-command');
  }
  if (input.matchedRule.scope === 'per-command-prefix' && input.matchedRule.prefixes?.length) {
    candidateScopes.push('per-command-prefix');
  }
  if (input.request.host !== undefined) {
    candidateScopes.push('per-host');
  }
  candidateScopes.push('session');

  const allowedScopes = new Set(input.policy.policy.escalationPolicy.allowedGrantScopes);

  for (const scope of candidateScopes) {
    if (isScopeBroaderThan(scope, requestedScope)) {
      continue;
    }
    if (isScopeBroaderThan(scope, input.policy.policy.escalationPolicy.maxGrantScope)) {
      continue;
    }
    if (!allowedScopes.has(scope)) {
      continue;
    }

    if (scope === 'per-command' && input.request.command !== undefined) {
      return {
        grantId: input.ids(),
        scope,
        command: input.request.command,
        expiresAt: input.request.expiresAt,
        reason: input.matchedRule.reason,
      };
    }

    if (scope === 'per-command-prefix' && input.matchedRule.prefixes !== undefined) {
      return {
        grantId: input.ids(),
        scope,
        commandPrefix: [...input.matchedRule.prefixes],
        expiresAt: input.request.expiresAt,
        reason: input.matchedRule.reason,
      };
    }

    if (scope === 'per-host' && input.request.host !== undefined) {
      return {
        grantId: input.ids(),
        scope,
        host: input.request.host,
        expiresAt: input.request.expiresAt,
        reason: input.matchedRule.reason,
      };
    }

    if (scope === 'session') {
      return {
        grantId: input.ids(),
        scope,
        sessionId: input.request.sessionId,
        expiresAt: input.request.expiresAt,
        reason: input.matchedRule.reason,
      };
    }
  }

  return undefined;
};

export const buildClassification = (
  risk: ApprovalRisk,
  ruleIds: readonly string[],
  evidenceEventIds: readonly string[],
  classifiedAt: string,
): ApprovalRiskClassification => ({
  risk,
  triggeredRuleIds: [...ruleIds],
  evidenceEventIds: [...new Set(evidenceEventIds)],
  classifiedAt,
});
