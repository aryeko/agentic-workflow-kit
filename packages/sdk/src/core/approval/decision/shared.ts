import { isIP } from 'node:net';
import path from 'node:path';

import type { CapabilityAttestation } from '../../../providers/attestation/index.js';
import type { AgentApprovalRequest, ApprovalKind, ScopedGrant } from '../../../providers/agent/index.js';
import type { RunEventEnvelope, RunProjections, RunReplay } from '../../run-lifecycle/contracts/index.js';
import type { ResolvedPolicy } from '../../../foundation/configuration-policy/index.js';
import { collectRecordedEvidence, isEvidenceSelfReportOnly } from '../../capability/evaluator/evidence-records.js';

import type {
  ApprovalContext,
  ApprovalRequest,
  ApprovalRisk,
  ApprovalSubject,
  PolicyGrantPlan,
  PolicyGrantScope,
} from '../contracts/index.js';

import type { ApprovalDecisionIdGenerator, ApprovalRiskClassification } from './types.js';

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

export const normalizePathInside = (targetPath: string, worktreePath: string): boolean => {
  const resolvedRoot = path.resolve(worktreePath);
  const resolvedTarget = path.resolve(worktreePath, targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export const containsUnsafeCommandSyntax = (command: string): boolean =>
  /(^|\s)(sudo|env\s+[A-Za-z_][A-Za-z0-9_]*=|rm\s+-rf|python\s+-c|node\s+-e|ruby\s+-e|bash\s+-c|sh\s+-c)\b/.test(
    command,
  ) ||
  /&&|\|\||[;|]|>>?|<|\$\(|`/.test(command) ||
  /\b(token|secret|password|credential)\b/i.test(command);

const isPrivateIpv4 = (value: string): boolean => {
  const parts = value.split('.').map((segment) => Number.parseInt(segment, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127 || (a === 169 && b === 254)
  );
};

export const isWildcardOrPrivateHost = (host: string | undefined): boolean => {
  if (host === undefined || host.length === 0) {
    return true;
  }

  const normalized = host.trim().toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized === 'metadata.google.internal' ||
    normalized === '169.254.169.254' ||
    normalized.includes('*') ||
    normalized.endsWith('.local')
  ) {
    return true;
  }

  if (isIP(normalized) !== 0 || /^[0-9.]+$/.test(normalized)) {
    return isPrivateIpv4(normalized);
  }

  return false;
};

const toEpoch = (timestamp: string): number | undefined => {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isCommittedBy = (event: RunEventEnvelope, evaluatedAt: string): boolean => {
  const occurredAt = toEpoch(event.occurredAt);
  const recordedAt = toEpoch(event.recordedAt);
  const gateTime = toEpoch(evaluatedAt);

  return (
    occurredAt !== undefined &&
    recordedAt !== undefined &&
    gateTime !== undefined &&
    occurredAt <= gateTime &&
    recordedAt <= gateTime
  );
};

const isCapabilityAttestation = (event: RunEventEnvelope): event is RunEventEnvelope<CapabilityAttestation<string>> => {
  const payload = event.payload;
  return (
    event.type === 'CapabilityAttestation' &&
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as CapabilityAttestation<string>).capability === 'string' &&
    typeof (payload as CapabilityAttestation<string>).expiry === 'string' &&
    typeof (payload as CapabilityAttestation<string>).evidenceRef === 'string' &&
    typeof (payload as CapabilityAttestation<string>).at === 'string'
  );
};

const scopeMatchesSession = (scope: string, sessionId: string): boolean =>
  scope === sessionId || scope.endsWith(`:${sessionId}`) || scope.includes(`/session/${sessionId}`);

export interface AttestationEvaluation {
  readonly freshPositive: boolean;
  readonly eventIds: readonly string[];
  readonly evidenceEventIds: readonly string[];
}

export const evaluateAgentCapability = (
  replay: RunReplay,
  capability: 'canRelayApproval' | 'canPersistApprovalAnswerChannel',
  sessionId: string,
  evaluatedAt: string,
): AttestationEvaluation => {
  const recordedEvidence = collectRecordedEvidence(replay.events, evaluatedAt);
  const eventIds: string[] = [];
  const evidenceEventIds: string[] = [];
  const positiveCommittedFresh = replay.events
    .filter(isCapabilityAttestation)
    .filter(
      (event) =>
        event.domain === 'Agent' &&
        event.payload.capability === capability &&
        scopeMatchesSession(event.payload.scope, sessionId) &&
        isCommittedBy(event, evaluatedAt),
    )
    .filter((event) => {
      const attestedAt = toEpoch(event.payload.at);
      const expiresAt = toEpoch(event.payload.expiry);
      const gateTime = toEpoch(evaluatedAt);
      return (
        attestedAt !== undefined &&
        expiresAt !== undefined &&
        gateTime !== undefined &&
        attestedAt <= gateTime &&
        gateTime < expiresAt
      );
    });

  for (const event of positiveCommittedFresh) {
    eventIds.push(event.eventId);
    const evidenceRecords = recordedEvidence.get(event.payload.evidenceRef) ?? [];
    for (const record of evidenceRecords) {
      evidenceEventIds.push(record.eventId);
    }
  }

  return {
    freshPositive: positiveCommittedFresh.some((event) => event.payload.result === 'positive'),
    eventIds,
    evidenceEventIds,
  };
};

export const hasSelfReportOnlyEvidence = (
  replay: RunReplay,
  requestEvidenceRefs: readonly string[] | undefined,
  evaluatedAt: string,
): { readonly highRisk: boolean; readonly evidenceEventIds: readonly string[] } => {
  if (requestEvidenceRefs === undefined || requestEvidenceRefs.length === 0) {
    return { highRisk: false, evidenceEventIds: [] };
  }

  const recordedEvidence = collectRecordedEvidence(replay.events, evaluatedAt);
  const evidenceEventIds: string[] = [];
  let highRisk = false;

  for (const evidenceRef of requestEvidenceRefs) {
    const records = recordedEvidence.get(evidenceRef);
    if (records === undefined || records.length === 0) {
      continue;
    }

    evidenceEventIds.push(...records.map((record) => record.eventId));
    if (isEvidenceSelfReportOnly(records)) {
      highRisk = true;
    }
  }

  return { highRisk, evidenceEventIds };
};

export const requestLinkageState = (
  request: ApprovalRequest,
  projections: RunProjections,
): { readonly current: boolean; readonly evidenceEventIds: readonly string[] } => {
  const currentSession = projections.launch.currentSession;
  if (
    projections.launch.linkage !== 'known' ||
    currentSession === undefined ||
    currentSession.sessionId !== request.sessionId
  ) {
    return {
      current: false,
      evidenceEventIds: currentSession?.sourceEventId === undefined ? [] : [currentSession.sourceEventId],
    };
  }

  return { current: true, evidenceEventIds: [currentSession.sourceEventId] };
};

export const allowRuleForCommand = (
  policy: ResolvedPolicy,
  command: string | undefined,
): ResolvedPolicy['policy']['escalationPolicy']['grantRules'][number] | undefined => {
  if (command === undefined) {
    return undefined;
  }

  for (const rule of policy.policy.escalationPolicy.grantRules) {
    if (rule.scope === 'per-command' && rule.prefixes?.some((prefix) => prefix === command)) {
      return rule;
    }

    if (rule.scope === 'per-command-prefix' && rule.prefixes?.some((prefix) => command.startsWith(prefix))) {
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
