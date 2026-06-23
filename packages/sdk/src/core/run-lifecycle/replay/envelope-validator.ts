import type { RunEventEnvelope } from '../contracts/index.js';

const RUN_EVENT_SCHEMA = 'kit-vnext.run-event.v1';
const RUN_DURABILITY_CLASSES = new Set(['durable', 'barrier']);

const hasString = (value: unknown): value is string => typeof value === 'string';
const hasNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(hasString);

export const isRunEventEnvelope = (
  value: unknown,
  runId: string,
  expectedSequence: number,
): value is RunEventEnvelope => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const envelope = value as Partial<RunEventEnvelope>;

  return (
    envelope.schema === RUN_EVENT_SCHEMA &&
    envelope.runId === runId &&
    envelope.sequence === expectedSequence &&
    hasString(envelope.eventId) &&
    hasNumber(envelope.writerEpoch) &&
    hasString(envelope.domain) &&
    hasString(envelope.type) &&
    hasString(envelope.occurredAt) &&
    hasString(envelope.recordedAt) &&
    hasString(envelope.payloadDigest) &&
    envelope.payload !== undefined &&
    RUN_DURABILITY_CLASSES.has(envelope.durability ?? '') &&
    (envelope.causationId === undefined || hasString(envelope.causationId)) &&
    (envelope.correlationId === undefined || hasString(envelope.correlationId)) &&
    (envelope.artifactRefs === undefined || isStringArray(envelope.artifactRefs))
  );
};
