import type { EvidenceEventRef, RunEventEnvelope, RunReplay } from '../../run-lifecycle/contracts/index.js';

import { isRedactedWriteOnceArtifactRef } from './artifact-ref-guard.js';
import type { AnalysisReportRefCandidate, TerminalAnalysisInvariantResult } from './types.js';

const TERMINAL_STATES = new Set(['completed', 'blocked', 'failed', 'canceled']);
const USABLE_REPLAY_HEALTH = new Set(['ok', 'tail-repaired']);
const ANALYSIS_FAILED_REASONS = new Set([
  'analysis-input-degraded',
  'analysis-artifact-unavailable',
  'analysis-redaction-unavailable',
  'analysis-rule-error',
  'analysis-invariant-missing',
]);

const toEventRef = (event: RunEventEnvelope): EvidenceEventRef => ({
  eventId: event.eventId,
  sequence: event.sequence,
  payloadDigest: event.payloadDigest,
  type: event.type,
});

const isTerminalLifecycleEvent = (event: RunEventEnvelope): boolean => {
  if (event.type !== 'RunLifecycleTransitioned') {
    return false;
  }

  const payload = event.payload as { readonly to?: string };
  return payload.to !== undefined && TERMINAL_STATES.has(payload.to);
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAnalysisReportRefCandidate = (value: unknown): value is AnalysisReportRefCandidate =>
  isObjectRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.digest === 'string' &&
  typeof value.size === 'number' &&
  typeof value.mediaType === 'string' &&
  typeof value.retentionClass === 'string' &&
  typeof value.classification === 'string' &&
  typeof value.redactionState === 'string';

const isRecordableAnalysisFailureReason = (value: unknown): value is string =>
  typeof value === 'string' && ANALYSIS_FAILED_REASONS.has(value);

const isValidAnalysisRecordedPayload = (payload: unknown): boolean =>
  isObjectRecord(payload) &&
  payload.schema === 'kit-vnext.analysis-recorded.v1' &&
  isObjectRecord(payload.request) &&
  isObjectRecord(payload.inputHealth) &&
  Array.isArray(payload.issues) &&
  isObjectRecord(payload.metrics) &&
  Array.isArray(payload.evidenceRefs) &&
  payload.reportArtifactRef !== undefined &&
  isAnalysisReportRefCandidate(payload.reportArtifactRef) &&
  isRedactedWriteOnceArtifactRef(payload.reportArtifactRef);

const isValidAnalysisFailedPayload = (payload: unknown): boolean =>
  isObjectRecord(payload) &&
  payload.schema === 'kit-vnext.analysis-failed.v1' &&
  isObjectRecord(payload.request) &&
  isObjectRecord(payload.inputHealth) &&
  isRecordableAnalysisFailureReason(payload.reason) &&
  Array.isArray(payload.evidenceRefs) &&
  Array.isArray(payload.artifactRefs);

const isValidAnalysisEvent = (event: RunEventEnvelope): boolean =>
  (event.type === 'AnalysisRecorded' && isValidAnalysisRecordedPayload(event.payload)) ||
  (event.type === 'AnalysisFailed' && isValidAnalysisFailedPayload(event.payload));

export const checkTerminalAnalysisInvariant = (
  replay: RunReplay,
  options: { readonly logWritable?: boolean } = {},
): TerminalAnalysisInvariantResult => {
  const terminalEvent = replay.events
    .filter(isTerminalLifecycleEvent)
    .sort((left, right) => right.sequence - left.sequence)[0];

  if (terminalEvent === undefined) {
    return { status: 'not-terminal' };
  }

  const terminalEventRef = toEventRef(terminalEvent);
  if (!USABLE_REPLAY_HEALTH.has(replay.health) || options.logWritable === false) {
    return { status: 'unmet', reason: 'analysis-record-unwritable', terminalEventRef };
  }

  const analysisEvent = replay.events.find(
    (event) => event.sequence >= terminalEvent.sequence && isValidAnalysisEvent(event),
  );

  if (analysisEvent === undefined) {
    return { status: 'unmet', reason: 'analysis-invariant-missing', terminalEventRef };
  }

  return { status: 'satisfied', eventRef: toEventRef(analysisEvent) };
};
