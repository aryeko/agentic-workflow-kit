import { isIP } from 'node:net';
import path from 'node:path';

import type { CapabilityAttestation } from '../../../providers/attestation/index.js';
import type { RunEventEnvelope, RunProjections, RunReplay } from '../../run-lifecycle/contracts/index.js';
import { collectRecordedEvidence, isEvidenceSelfReportOnly } from '../../capability/evaluator/evidence-records.js';
import { toEpochMs } from '../../capability/evaluator/timestamps.js';

import type { ApprovalRequest } from '../contracts/index.js';

type RecordedEvidenceByRef = ReturnType<typeof collectRecordedEvidence>;

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
  /&&|\|\||[;|&]|>>?|<|\$\(|`|\r|\n/.test(command) ||
  /\b(token|secret|password|credential)\b/i.test(command);

const parseIpv4Parts = (value: string): readonly number[] | undefined => {
  if (/^\d+$/.test(value)) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0xff_ff_ff_ff) {
      return undefined;
    }

    return [(numeric >>> 24) & 0xff, (numeric >>> 16) & 0xff, (numeric >>> 8) & 0xff, numeric & 0xff];
  }

  const parts = value.split('.').map((segment) => {
    if (/^0x[0-9a-f]+$/i.test(segment)) {
      return Number.parseInt(segment, 16);
    }

    return /^\d+$/.test(segment) ? Number.parseInt(segment, 10) : Number.NaN;
  });
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return undefined;
  }

  return parts;
};

const isPrivateIpv4 = (value: string): boolean => {
  const parts = parseIpv4Parts(value);
  if (parts === undefined) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127 || (a === 169 && b === 254)
  );
};

const isPrivateIpv6 = (value: string): boolean => {
  if (value.startsWith('::ffff:')) {
    return isPrivateIpv4(value.slice('::ffff:'.length));
  }

  if (value === '::1') {
    return true;
  }

  const firstGroup = value.split(':')[0] ?? '';
  if (firstGroup.length === 0) {
    return false;
  }

  const first = Number.parseInt(firstGroup, 16);
  return Number.isInteger(first) && ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80);
};

export const isWildcardOrPrivateHost = (host: string | undefined): boolean => {
  if (host === undefined || host.length === 0) {
    return true;
  }

  const normalized = host
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1');
  if (
    normalized === 'localhost' ||
    normalized === 'metadata.google.internal' ||
    normalized === '169.254.169.254' ||
    normalized.includes('*') ||
    normalized.endsWith('.local')
  ) {
    return true;
  }

  if (isIP(normalized) === 6) {
    return isPrivateIpv6(normalized);
  }

  if (isIP(normalized) === 4 || /^[0-9.]+$/.test(normalized)) {
    return isPrivateIpv4(normalized);
  }

  if (/^0x[0-9a-f]+(?:\.[0-9a-fx]+){3}$/i.test(normalized) || /^\d+$/.test(normalized)) {
    return isPrivateIpv4(normalized);
  }

  return false;
};

const isCommittedBy = (event: RunEventEnvelope, evaluatedAt: string): boolean => {
  const occurredAt = toEpochMs(event.occurredAt);
  const recordedAt = toEpochMs(event.recordedAt);
  const gateTime = toEpochMs(evaluatedAt);

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

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const scopeMatchesSession = (scope: string, sessionId: string): boolean => {
  if (scope === sessionId || scope.endsWith(`:${sessionId}`)) {
    return true;
  }

  if (scope.includes('/session/')) {
    return new RegExp(`(?:^|/)session/${escapeRegExp(sessionId)}(?:/|$)`).test(scope);
  }

  return scope.startsWith('agent:');
};

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
  recordedEvidence: RecordedEvidenceByRef = collectRecordedEvidence(replay.events, evaluatedAt),
): AttestationEvaluation => {
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
      const attestedAt = toEpochMs(event.payload.at);
      const expiresAt = toEpochMs(event.payload.expiry);
      const gateTime = toEpochMs(evaluatedAt);
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

  const hasFreshNegative = positiveCommittedFresh.some((event) => event.payload.result === 'negative');
  const hasFreshPositive = positiveCommittedFresh.some((event) => event.payload.result === 'positive');

  return {
    freshPositive: hasFreshPositive && !hasFreshNegative,
    eventIds,
    evidenceEventIds,
  };
};

export const hasSelfReportOnlyEvidence = (
  replay: RunReplay,
  requestEvidenceRefs: readonly string[] | undefined,
  evaluatedAt: string,
  recordedEvidence: RecordedEvidenceByRef = collectRecordedEvidence(replay.events, evaluatedAt),
): { readonly highRisk: boolean; readonly evidenceEventIds: readonly string[] } => {
  if (requestEvidenceRefs === undefined || requestEvidenceRefs.length === 0) {
    return { highRisk: false, evidenceEventIds: [] };
  }

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
