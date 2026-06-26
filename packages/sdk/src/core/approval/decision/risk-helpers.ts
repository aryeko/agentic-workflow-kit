import { isIP } from 'node:net';
import path from 'node:path';

import type { CapabilityAttestation } from '../../../providers/attestation/index.js';
import type { RunEventEnvelope, RunProjections, RunReplay } from '../../run-lifecycle/contracts/index.js';
import { collectRecordedEvidence, isEvidenceSelfReportOnly } from '../../capability/evaluator/evidence-records.js';

import type { ApprovalRequest } from '../contracts/index.js';

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
