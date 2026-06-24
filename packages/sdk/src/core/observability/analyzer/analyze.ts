import { createHash } from 'node:crypto';

import type { ArtifactRef } from '../../../foundation/storage/artifacts/index.js';
import type { EvidenceEventRef } from '../../run-lifecycle/contracts/index.js';
import { projectMetrics } from '../../run-lifecycle/projections/metrics-projection.js';
import type { MetricValue } from '../telemetry/index.js';

import { type AnalysisRule, type AnalysisRuleIssueInput, defaultAnalysisRules } from './rules.js';
import type { AnalysisFailure, AnalysisIssue, AnalysisRequest, AnalysisResult, AnalysisSnapshot } from './types.js';

const SEVERITY_ORDER: Record<AnalysisIssue['severity'], number> = {
  failed: 0,
  blocked: 1,
  attention: 2,
  info: 3,
};

const sortArtifactRefs = (artifactRefs: readonly ArtifactRef[]): ArtifactRef[] =>
  [...artifactRefs].sort((left, right) => left.id.localeCompare(right.id));

const sortEvidenceRefs = (evidenceRefs: readonly EvidenceEventRef[]): EvidenceEventRef[] =>
  [...evidenceRefs].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    const eventIdOrder = left.eventId.localeCompare(right.eventId);
    if (eventIdOrder !== 0) {
      return eventIdOrder;
    }

    const digestOrder = left.payloadDigest.localeCompare(right.payloadDigest);
    if (digestOrder !== 0) {
      return digestOrder;
    }

    return left.type.localeCompare(right.type);
  });

const getFirstSequence = (issue: Pick<AnalysisIssue, 'evidenceRefs'>): number =>
  sortEvidenceRefs(issue.evidenceRefs)[0]?.sequence ?? Number.MAX_SAFE_INTEGER;

const createIssueId = (
  request: Pick<AnalysisRequest, 'runId' | 'analyzerVersion' | 'trigger'>,
  code: string,
  firstSequence: number,
): string =>
  `analysis-issue:${createHash('sha256')
    .update(
      [request.runId, request.trigger.eventRef.eventId, code, String(firstSequence), request.analyzerVersion].join('|'),
    )
    .digest('hex')
    .slice(0, 16)}`;

const isEvidenceEventRef = (value: unknown): value is EvidenceEventRef => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<EvidenceEventRef>;
  return (
    typeof candidate.eventId === 'string' &&
    typeof candidate.sequence === 'number' &&
    typeof candidate.payloadDigest === 'string' &&
    typeof candidate.type === 'string'
  );
};

const isArtifactRef = (value: unknown): value is ArtifactRef => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ArtifactRef>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.digest === 'string' &&
    typeof candidate.size === 'number' &&
    typeof candidate.mediaType === 'string' &&
    typeof candidate.retentionClass === 'string' &&
    typeof candidate.classification === 'string' &&
    typeof candidate.redactionState === 'string'
  );
};

const isRuleIssueInput = (value: unknown): value is AnalysisRuleIssueInput => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AnalysisRuleIssueInput>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.summary === 'string' &&
    (candidate.severity === 'info' ||
      candidate.severity === 'attention' ||
      candidate.severity === 'blocked' ||
      candidate.severity === 'failed') &&
    Array.isArray(candidate.evidenceRefs) &&
    candidate.evidenceRefs.every(isEvidenceEventRef) &&
    Array.isArray(candidate.artifactRefs) &&
    candidate.artifactRefs.every(isArtifactRef) &&
    Array.isArray(candidate.metricRefs) &&
    candidate.metricRefs.every((metricRef) => typeof metricRef === 'string')
  );
};

const getSnapshotArtifactRefs = (snapshot: AnalysisSnapshot): ArtifactRef[] =>
  sortArtifactRefs(
    Object.keys(snapshot.redactedArtifacts)
      .sort()
      .map((key) => snapshot.redactedArtifacts[key] as ArtifactRef),
  );

const createFailure = (
  request: AnalysisRequest,
  snapshot: AnalysisSnapshot,
  reason: AnalysisFailure['reason'],
): AnalysisFailure => ({
  reason,
  evidenceRefs: [request.trigger.eventRef],
  artifactRefs: getSnapshotArtifactRefs(snapshot),
});

const sortIssues = (issues: readonly AnalysisIssue[]): AnalysisIssue[] =>
  [...issues].sort((left, right) => {
    const severityOrder = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
    if (severityOrder !== 0) {
      return severityOrder;
    }

    const sequenceOrder = getFirstSequence(left) - getFirstSequence(right);
    if (sequenceOrder !== 0) {
      return sequenceOrder;
    }

    const codeOrder = left.code.localeCompare(right.code);
    if (codeOrder !== 0) {
      return codeOrder;
    }

    return left.issueId.localeCompare(right.issueId);
  });

const buildMetrics = (snapshot: AnalysisSnapshot): Record<string, MetricValue<unknown>> => {
  const lastReplayEvent = snapshot.replay.events[snapshot.replay.events.length - 1];
  const evidenceRefs =
    lastReplayEvent === undefined
      ? []
      : [
          {
            eventId: lastReplayEvent.eventId,
            sequence: lastReplayEvent.sequence,
            payloadDigest: lastReplayEvent.payloadDigest,
            type: lastReplayEvent.type,
          },
        ];

  const metrics: Record<string, MetricValue<unknown>> = {
    'event-count': {
      state: 'available',
      value: snapshot.projections.metrics.eventCount,
      unit: 'count',
      evidenceRefs,
    },
    'retry-count': {
      state: 'available',
      value: snapshot.projections.metrics.retryCount,
      unit: 'count',
      evidenceRefs,
    },
    'parked-ms': {
      state: 'available',
      value: snapshot.projections.metrics.parkedMs,
      unit: 'ms',
      evidenceRefs,
    },
  };

  metrics['last-recorded-at'] =
    snapshot.projections.metrics.lastRecordedAt === undefined
      ? {
          state: 'unavailable',
          reason: 'last-recorded-at source evidence is absent',
          evidenceRefs,
        }
      : {
          state: 'available',
          value: snapshot.projections.metrics.lastRecordedAt,
          unit: 'iso-8601',
          evidenceRefs,
        };

  return metrics;
};

const getUniqueEvidenceRefs = (request: AnalysisRequest, issues: readonly AnalysisIssue[]): EvidenceEventRef[] => {
  const unique = new Map<string, EvidenceEventRef>();
  const addEvidenceRef = (evidenceRef: EvidenceEventRef): void => {
    const key = `${evidenceRef.sequence}:${evidenceRef.eventId}:${evidenceRef.payloadDigest}:${evidenceRef.type}`;
    unique.set(key, evidenceRef);
  };

  addEvidenceRef(request.trigger.eventRef);
  for (const issue of issues) {
    for (const evidenceRef of issue.evidenceRefs) {
      addEvidenceRef(evidenceRef);
    }
  }

  return sortEvidenceRefs([...unique.values()]);
};

const isInputDegraded = (snapshot: AnalysisSnapshot): boolean =>
  snapshot.replay.health === 'interior-corrupt' ||
  snapshot.replay.health === 'event-log-unavailable' ||
  snapshot.projections === undefined;

const bindSnapshotToCursor = (request: AnalysisRequest, snapshot: AnalysisSnapshot): AnalysisSnapshot => {
  const events = snapshot.replay.events.filter((event) => event.sequence <= request.evaluatedThrough.afterSequence);
  const replay = {
    ...snapshot.replay,
    events,
    lastSequence: Math.min(snapshot.replay.lastSequence, request.evaluatedThrough.afterSequence),
  };
  const boundedMetrics = projectMetrics(replay);

  return {
    ...snapshot,
    replay,
    projections: {
      ...snapshot.projections,
      metrics: {
        ...snapshot.projections.metrics,
        eventCount: boundedMetrics.eventCount,
        retryCount: boundedMetrics.retryCount,
        parkedMs: boundedMetrics.parkedMs,
        lastRecordedAt:
          snapshot.projections.metrics.lastRecordedAt === undefined ? undefined : boundedMetrics.lastRecordedAt,
      },
    },
  };
};

export function analyzeWithRuleSet(
  request: AnalysisRequest,
  snapshot: AnalysisSnapshot,
  rules: readonly AnalysisRule[],
): AnalysisResult | AnalysisFailure {
  if (isInputDegraded(snapshot)) {
    return createFailure(request, snapshot, 'analysis-input-degraded');
  }

  const boundedSnapshot = bindSnapshotToCursor(request, snapshot);
  const issues: AnalysisIssue[] = [];
  try {
    for (const rule of rules) {
      const producedIssues = rule({ request, snapshot: boundedSnapshot });
      if (!Array.isArray(producedIssues)) {
        return createFailure(request, boundedSnapshot, 'analysis-rule-error');
      }

      for (const producedIssue of producedIssues) {
        if (!isRuleIssueInput(producedIssue)) {
          return createFailure(request, boundedSnapshot, 'analysis-rule-error');
        }

        const evidenceRefs = sortEvidenceRefs(producedIssue.evidenceRefs);
        const firstSequence = evidenceRefs[0]?.sequence ?? Number.MAX_SAFE_INTEGER;
        issues.push({
          issueId: createIssueId(request, producedIssue.code, firstSequence),
          code: producedIssue.code,
          severity: producedIssue.severity,
          summary: producedIssue.summary,
          evidenceRefs,
          artifactRefs: sortArtifactRefs(producedIssue.artifactRefs),
          metricRefs: [...producedIssue.metricRefs],
        });
      }
    }
  } catch {
    return createFailure(request, boundedSnapshot, 'analysis-rule-error');
  }

  const sortedIssues = sortIssues(issues);
  return {
    issues: sortedIssues,
    metrics: buildMetrics(boundedSnapshot),
    evidenceRefs: getUniqueEvidenceRefs(request, sortedIssues),
  };
}

export function analyze(request: AnalysisRequest, snapshot: AnalysisSnapshot): AnalysisResult | AnalysisFailure {
  return analyzeWithRuleSet(request, snapshot, defaultAnalysisRules);
}
