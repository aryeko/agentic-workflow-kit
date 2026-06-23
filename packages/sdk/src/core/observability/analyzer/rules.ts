import type { ArtifactRef } from '../../../foundation/storage/artifacts/index.js';
import type { EvidenceEventRef, RunEventEnvelope } from '../../run-lifecycle/contracts/index.js';

import type { AnalysisRequest, AnalysisSnapshot } from './types.js';

export interface AnalysisRuleIssueInput {
  code: string;
  severity: 'info' | 'attention' | 'blocked' | 'failed';
  summary: string;
  evidenceRefs: EvidenceEventRef[];
  artifactRefs: ArtifactRef[];
  metricRefs: string[];
}

export interface AnalysisRuleContext {
  request: AnalysisRequest;
  snapshot: AnalysisSnapshot;
}

export type AnalysisRule = (context: AnalysisRuleContext) => readonly AnalysisRuleIssueInput[];

const getEventRef = (event: RunEventEnvelope): EvidenceEventRef => ({
  eventId: event.eventId,
  sequence: event.sequence,
  payloadDigest: event.payloadDigest,
  type: event.type,
});

const getPayloadField = (payload: unknown, field: string): string | undefined => {
  if (payload === null || typeof payload !== 'object') {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
};

const issueFromEvent = (
  event: RunEventEnvelope,
  code: string,
  severity: AnalysisRuleIssueInput['severity'],
  summary: string,
): AnalysisRuleIssueInput => ({
  code,
  severity,
  summary,
  evidenceRefs: [getEventRef(event)],
  artifactRefs: [],
  metricRefs: [],
});

const blockedTransitionRule: AnalysisRule = ({ snapshot }) =>
  snapshot.replay.events
    .filter((event) => event.type === 'RunLifecycleTransitioned' && getPayloadField(event.payload, 'to') === 'blocked')
    .map((event) =>
      issueFromEvent(event, 'lifecycle-blocked-transition', 'blocked', 'run recorded a blocked lifecycle transition'),
    );

const staleProgressRule: AnalysisRule = ({ snapshot }) =>
  snapshot.replay.events.flatMap((event) => {
    if (event.type === 'LivenessTimerExpired') {
      return [issueFromEvent(event, 'liveness-stale-progress', 'attention', 'stale progress evidence was recorded')];
    }

    if (
      event.type === 'LivenessStateChanged' &&
      (getPayloadField(event.payload, 'to') ?? getPayloadField(event.payload, 'state')) === 'stale'
    ) {
      return [issueFromEvent(event, 'liveness-stale-progress', 'attention', 'liveness state changed to stale')];
    }

    return [];
  });

const supervisionLostRule: AnalysisRule = ({ snapshot }) =>
  snapshot.replay.events.flatMap((event) => {
    if (event.type === 'SupervisionLost') {
      return [issueFromEvent(event, 'liveness-supervision-lost', 'failed', 'supervision loss was recorded')];
    }

    if (
      event.type === 'LivenessStateChanged' &&
      (getPayloadField(event.payload, 'to') ?? getPayloadField(event.payload, 'state')) === 'supervision-lost'
    ) {
      return [
        issueFromEvent(event, 'liveness-supervision-lost', 'failed', 'liveness state changed to supervision-lost'),
      ];
    }

    return [];
  });

const recoveryRuleMap: Record<string, { code: string; summary: string }> = {
  RecoveryClassified: {
    code: 'recovery-classified',
    summary: 'a recovery classification was recorded',
  },
  RecoveryActionPlanned: {
    code: 'recovery-action-planned',
    summary: 'a recovery action plan was recorded',
  },
  RecoveryActionApplied: {
    code: 'recovery-action-applied',
    summary: 'a recovery action application was recorded',
  },
  ReconciliationBlocked: {
    code: 'reconciliation-blocked',
    summary: 'reconciliation was blocked',
  },
};

const recoveryDecisionRule: AnalysisRule = ({ snapshot }) =>
  snapshot.replay.events.flatMap((event) => {
    const match = recoveryRuleMap[event.type];
    return match === undefined ? [] : [issueFromEvent(event, match.code, 'info', match.summary)];
  });

export const defaultAnalysisRules: readonly AnalysisRule[] = Object.freeze([
  supervisionLostRule,
  blockedTransitionRule,
  staleProgressRule,
  recoveryDecisionRule,
]);
