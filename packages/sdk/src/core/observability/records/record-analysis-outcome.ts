import type { AppendIntent, Result, RunWriter } from '../../run-lifecycle/contracts/index.js';
import type { AnalysisFailure } from '../analyzer/index.js';

import { createAnalysisEventId, createAnalysisPayloadDigest } from './analysis-keying.js';
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
): AppendIntent<AnalysisPayload> => ({
  domain: 'core-07',
  type: payload.schema === 'kit-vnext.analysis-recorded.v1' ? 'AnalysisRecorded' : 'AnalysisFailed',
  durability: 'barrier',
  payload,
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

const appendPayload = async (
  input: AnalysisRecordInput,
  writer: RunWriter,
  payload: AnalysisPayload,
  eventId: string,
  payloadDigest: string,
): Promise<Result<AnalysisRecordCommit, AnalysisRecordFailure>> => {
  const appendResult = await Promise.resolve(writer.append([buildAppendIntent(input, payload, eventId)]));
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
  const payload =
    input.outcome.kind === 'recorded'
      ? await prepareRecordedPayload(input, options)
      : buildAnalysisFailedPayload(input, input.outcome.failure);
  const payloadDigest = createAnalysisPayloadDigest(payload);
  const eventId = createAnalysisEventId(input, payload, payloadDigest);
  const existing = resolveExistingAnalysisRecord(options.replay, input, eventId, payloadDigest);

  if (existing.status === 'already-committed') {
    return { ok: true, value: existing };
  }

  if (existing.status === 'conflict') {
    return failureResult(eventId, payloadDigest, { conflict: existing.conflict });
  }

  return appendPayload(input, writer, payload, eventId, payloadDigest);
};
