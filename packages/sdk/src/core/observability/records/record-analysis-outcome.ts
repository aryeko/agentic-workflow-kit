import type { AppendIntent, Result, RunWriter } from '../../run-lifecycle/contracts/index.js';
import type { AnalysisFailure } from '../analyzer/index.js';

import { canonicalJson, createAnalysisEventId, createAnalysisPayloadDigest } from './analysis-keying.js';
import { isRedactedWriteOnceArtifactRef, isStorageError } from './artifact-ref-guard.js';
import { buildAnalysisFailedPayload, buildAnalysisRecordedPayload } from './payload-builders.js';
import { resolveExistingAnalysisRecord } from './record-idempotency.js';
import type {
  AnalysisFailedPayload,
  AnalysisPayload,
  AnalysisRecordCommit,
  AnalysisRecordedPayload,
  AnalysisRecordFailure,
  AnalysisRecordInput,
  AnalysisRecordOptions,
} from './types.js';

const failureResult = (
  attemptedEventId: string,
  attemptedPayloadDigest: string,
  details: Pick<AnalysisRecordFailure, 'appendFailure' | 'conflict'>,
): Result<AnalysisRecordCommit, AnalysisRecordFailure> => ({
  ok: false,
  error: {
    reason: 'analysis-record-unwritable',
    attemptedEventId,
    attemptedPayloadDigest,
    ...details,
    retry: 'replay-before-retry',
  },
});

const createFallbackFailure = (
  input: AnalysisRecordInput,
  reason: AnalysisFailure['reason'],
  artifactRefs = [],
): AnalysisFailure => ({
  reason,
  evidenceRefs:
    input.outcome.kind === 'recorded' ? input.outcome.result.evidenceRefs : input.outcome.failure.evidenceRefs,
  artifactRefs,
});

const buildAppendIntent = (
  input: AnalysisRecordInput,
  payload: AnalysisPayload,
  eventId: string,
  payloadDigest: string,
): AppendIntent<AnalysisPayload> => ({
  domain: 'core-07',
  type: payload.schema === 'kit-vnext.analysis-recorded.v1' ? 'AnalysisRecorded' : 'AnalysisFailed',
  durability: 'barrier',
  payload,
  payloadDigest,
  eventId,
  occurredAt: input.request.analyzedAt,
  causationId: input.request.trigger.eventRef.eventId,
  correlationId: input.request.runId,
  artifactRefs:
    payload.schema === 'kit-vnext.analysis-recorded.v1' && payload.reportArtifactRef !== undefined
      ? [payload.reportArtifactRef.id]
      : payload.schema === 'kit-vnext.analysis-failed.v1'
        ? payload.artifactRefs.map((ref) => ref.id)
        : undefined,
});

const isAnalysisRecordedPayload = (payload: unknown): payload is AnalysisRecordedPayload =>
  typeof payload === 'object' &&
  payload !== null &&
  'schema' in payload &&
  payload.schema === 'kit-vnext.analysis-recorded.v1';

const recordedPayloadWithoutReportRef = (
  payload: AnalysisRecordedPayload,
): Omit<AnalysisRecordedPayload, 'reportArtifactRef'> => {
  const { reportArtifactRef: _reportArtifactRef, ...rest } = payload;
  return rest;
};

const recordedReplayShape = (input: AnalysisRecordInput): Omit<AnalysisRecordedPayload, 'reportArtifactRef'> => {
  if (input.outcome.kind !== 'recorded') {
    throw new Error('recorded replay shape requires a recorded outcome.');
  }

  return {
    schema: 'kit-vnext.analysis-recorded.v1',
    request: input.request,
    inputHealth: input.inputHealth,
    issues: input.outcome.result.issues,
    metrics: input.outcome.result.metrics,
    evidenceRefs: input.outcome.result.evidenceRefs,
    ...(input.supersedesEventId === undefined ? {} : { supersedesEventId: input.supersedesEventId }),
  };
};

const replayReportArtifactRef = (
  input: AnalysisRecordInput,
  replay: AnalysisRecordOptions['replay'],
): AnalysisRecordedPayload['reportArtifactRef'] => {
  if (input.outcome.kind !== 'recorded' || replay === undefined) {
    return undefined;
  }

  const expectedShape = canonicalJson(recordedReplayShape(input));
  for (const event of replay.events) {
    if (event.type !== 'AnalysisRecorded' || !isAnalysisRecordedPayload(event.payload)) {
      continue;
    }

    if (canonicalJson(recordedPayloadWithoutReportRef(event.payload)) === expectedShape) {
      return event.payload.reportArtifactRef;
    }
  }

  return undefined;
};

const prepareRecordedPayload = async (
  input: AnalysisRecordInput,
  options: AnalysisRecordOptions,
): Promise<AnalysisRecordedPayload | AnalysisFailedPayload> => {
  if (input.outcome.kind !== 'recorded') {
    throw new Error('recorded payload preparation requires a recorded outcome.');
  }

  if (input.inputHealth.redaction === 'unavailable' || input.inputHealth.artifactInputs === 'unavailable') {
    return buildAnalysisFailedPayload(input, createFallbackFailure(input, 'analysis-redaction-unavailable'));
  }

  if (options.artifactStore !== undefined && options.reportArtifact !== undefined) {
    const storedRef = await options.artifactStore.put(options.reportArtifact);
    if (isStorageError(storedRef)) {
      return buildAnalysisFailedPayload(input, createFallbackFailure(input, 'analysis-artifact-unavailable'));
    }

    if (!isRedactedWriteOnceArtifactRef(storedRef)) {
      return buildAnalysisFailedPayload(input, createFallbackFailure(input, 'analysis-redaction-unavailable'));
    }

    return buildAnalysisRecordedPayload(input, storedRef);
  }

  const candidateRef = input.outcome.result.reportArtifactRef;
  if (candidateRef === undefined || !isRedactedWriteOnceArtifactRef(candidateRef)) {
    return buildAnalysisFailedPayload(input, createFallbackFailure(input, 'analysis-redaction-unavailable'));
  }

  return buildAnalysisRecordedPayload(input, candidateRef);
};

const prepareReplayPayload = async (
  input: AnalysisRecordInput,
  replay: AnalysisRecordOptions['replay'],
): Promise<AnalysisPayload> => {
  if (input.outcome.kind !== 'recorded') {
    return buildAnalysisFailedPayload(input, input.outcome.failure);
  }

  const committedReportRef = replayReportArtifactRef(input, replay);
  if (committedReportRef !== undefined && isRedactedWriteOnceArtifactRef(committedReportRef)) {
    return buildAnalysisRecordedPayload(input, committedReportRef);
  }

  return prepareRecordedPayload(input, {});
};

const appendPayload = async (
  input: AnalysisRecordInput,
  writer: RunWriter,
  payload: AnalysisPayload,
  eventId: string,
  payloadDigest: string,
): Promise<Result<AnalysisRecordCommit, AnalysisRecordFailure>> => {
  const appendResult = await Promise.resolve(
    writer.append([buildAppendIntent(input, payload, eventId, payloadDigest)]),
  );
  if (!appendResult.ok) {
    return failureResult(eventId, payloadDigest, { appendFailure: appendResult.error });
  }

  return {
    ok: true,
    value: {
      status: 'appended',
      eventRef: {
        eventId: appendResult.value.eventIds[0] ?? eventId,
        sequence: appendResult.value.firstSequence,
        payloadDigest: appendResult.value.payloadDigests[0] ?? payloadDigest,
        type: payload.schema === 'kit-vnext.analysis-recorded.v1' ? 'AnalysisRecorded' : 'AnalysisFailed',
      },
      appendReceipt: appendResult.value,
    },
  };
};

export const recordAnalysisOutcome = async (
  input: AnalysisRecordInput,
  writer: RunWriter,
  options: AnalysisRecordOptions = {},
): Promise<Result<AnalysisRecordCommit, AnalysisRecordFailure>> => {
  const replayPayload = await prepareReplayPayload(input, options.replay);
  const replayPayloadDigest = createAnalysisPayloadDigest(replayPayload);
  const replayEventId = createAnalysisEventId(input, replayPayload, replayPayloadDigest);
  const replayExisting = resolveExistingAnalysisRecord(options.replay, input, replayEventId, replayPayloadDigest);

  if (replayExisting.status === 'already-committed') {
    return { ok: true, value: replayExisting };
  }

  if (replayExisting.status === 'conflict') {
    return failureResult(replayEventId, replayPayloadDigest, { conflict: replayExisting.conflict });
  }

  const payload =
    input.outcome.kind === 'recorded'
      ? await prepareRecordedPayload(input, options)
      : buildAnalysisFailedPayload(input, input.outcome.failure);
  const payloadDigest = createAnalysisPayloadDigest(payload);
  const eventId = createAnalysisEventId(input, payload, payloadDigest);
  const existing =
    eventId === replayEventId && payloadDigest === replayPayloadDigest
      ? replayExisting
      : resolveExistingAnalysisRecord(options.replay, input, eventId, payloadDigest);

  if (existing.status === 'already-committed') {
    return { ok: true, value: existing };
  }

  if (existing.status === 'conflict') {
    return failureResult(eventId, payloadDigest, { conflict: existing.conflict });
  }

  return appendPayload(input, writer, payload, eventId, payloadDigest);
};
