import type { EvidenceEventRef, RunEventEnvelope, RunReplay } from '../../run-lifecycle/contracts/index.js';

import { canonicalJson, createAnalysisKey } from './analysis-keying.js';
import type { AnalysisPayload, AnalysisRecordInput } from './types.js';

export type AnalysisRecordConflict = 'event-id-digest-mismatch' | 'current-analysis-conflict';

export type ExistingAnalysisRecord =
  | { status: 'already-committed'; eventRef: EvidenceEventRef }
  | { status: 'conflict'; conflict: AnalysisRecordConflict }
  | { status: 'absent' };

const ANALYSIS_EVENT_TYPES = new Set(['AnalysisRecorded', 'AnalysisFailed']);

const toEventRef = (event: RunEventEnvelope): EvidenceEventRef => ({
  eventId: event.eventId,
  sequence: event.sequence,
  payloadDigest: event.payloadDigest,
  type: event.type,
});

const isAnalysisPayload = (payload: unknown): payload is AnalysisPayload =>
  typeof payload === 'object' &&
  payload !== null &&
  'schema' in payload &&
  (payload.schema === 'kit-vnext.analysis-recorded.v1' || payload.schema === 'kit-vnext.analysis-failed.v1');

const sameCursor = (left: AnalysisRecordInput, right: AnalysisPayload): boolean =>
  left.request.evaluatedThrough.runId === right.request.evaluatedThrough.runId &&
  left.request.evaluatedThrough.afterSequence === right.request.evaluatedThrough.afterSequence;

const sameAnalysisKey = (input: AnalysisRecordInput, payload: AnalysisPayload): boolean =>
  createAnalysisKey(input) ===
  createAnalysisKey({
    request: payload.request,
    inputHealth: payload.inputHealth,
    outcome:
      payload.schema === 'kit-vnext.analysis-recorded.v1'
        ? {
            kind: 'recorded',
            result: {
              issues: payload.issues,
              metrics: payload.metrics,
              evidenceRefs: payload.evidenceRefs,
              reportArtifactRef: payload.reportArtifactRef,
            },
          }
        : {
            kind: 'failed',
            failure: {
              reason: payload.reason,
              evidenceRefs: payload.evidenceRefs,
              artifactRefs: payload.artifactRefs,
            },
          },
  });

export const resolveExistingAnalysisRecord = (
  replay: RunReplay | undefined,
  input: AnalysisRecordInput,
  attemptedEventId: string,
  attemptedPayloadDigest: string,
  attemptedPayload?: AnalysisPayload,
): ExistingAnalysisRecord => {
  if (replay === undefined) {
    return { status: 'absent' };
  }

  for (const event of replay.events) {
    if (!ANALYSIS_EVENT_TYPES.has(event.type)) {
      continue;
    }

    if (event.eventId === attemptedEventId) {
      if (event.payloadDigest === attemptedPayloadDigest) {
        return { status: 'already-committed', eventRef: toEventRef(event) };
      }

      if (
        attemptedPayload !== undefined &&
        isAnalysisPayload(event.payload) &&
        canonicalJson(event.payload) === canonicalJson(attemptedPayload)
      ) {
        return { status: 'already-committed', eventRef: toEventRef(event) };
      }

      return { status: 'conflict', conflict: 'event-id-digest-mismatch' };
    }
  }

  const currentAnalysisEvents = replay.events.filter(
    (event) =>
      ANALYSIS_EVENT_TYPES.has(event.type) &&
      isAnalysisPayload(event.payload) &&
      sameAnalysisKey(input, event.payload) &&
      sameCursor(input, event.payload),
  );

  if (input.supersedesEventId !== undefined) {
    const supersededEventIds = new Set(
      currentAnalysisEvents.flatMap((event) =>
        isAnalysisPayload(event.payload) && event.payload.supersedesEventId !== undefined
          ? [event.payload.supersedesEventId]
          : [],
      ),
    );
    const currentHeads = currentAnalysisEvents.filter((event) => !supersededEventIds.has(event.eventId));
    return currentHeads.length === 1 && currentHeads[0]?.eventId === input.supersedesEventId
      ? { status: 'absent' }
      : currentAnalysisEvents.length > 0
        ? { status: 'conflict', conflict: 'current-analysis-conflict' }
        : { status: 'absent' };
  }

  return currentAnalysisEvents.length > 0
    ? { status: 'conflict', conflict: 'current-analysis-conflict' }
    : { status: 'absent' };
};
