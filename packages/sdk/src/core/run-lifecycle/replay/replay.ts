import type { EventLogStore } from '../../../foundation/storage/index.js';
import type { Result, RunEventEnvelope, RunReplay, RunReplayFailure } from '../contracts/index.js';

import { isRunEventEnvelope } from './envelope-validator.js';
import { classifyReplayHealth } from './health-classifier.js';
import { hasValidDeclaredPayload } from './payload-validator.js';

const textDecoder = new TextDecoder();
export type ReplayPayloadDigest = (payload: unknown) => string;

const malformedEnvelopeFailure = (
  healthRecords: RunReplayFailure['healthRecords'],
): Result<RunReplay, RunReplayFailure> => ({
  ok: false,
  error: {
    code: 'malformed-envelope',
    message: 'Committed frame does not satisfy the RunEventEnvelope contract.',
    healthRecords,
  },
});

const malformedDeclaredPayloadFailure = (
  healthRecords: RunReplayFailure['healthRecords'],
): Result<RunReplay, RunReplayFailure> => ({
  ok: false,
  error: {
    code: 'malformed-declared-payload',
    message: 'Committed frame payload does not satisfy the declared core-01 payload schema.',
    healthRecords,
  },
});

const decodeEnvelope = (payload: Uint8Array): unknown => {
  try {
    return JSON.parse(textDecoder.decode(payload));
  } catch {
    return undefined;
  }
};

export const replay = (
  runId: string,
  store: EventLogStore,
  digestPayload: ReplayPayloadDigest,
): Result<RunReplay, RunReplayFailure> => {
  const replayed = store.replay(runId);
  const events: RunEventEnvelope[] = [];

  for (let index = 0; index < replayed.records.length; index += 1) {
    const record = replayed.records[index];
    const expectedSequence = index + 1;
    const decoded = decodeEnvelope(record?.payload ?? new Uint8Array());

    if (!isRunEventEnvelope(decoded, runId, expectedSequence)) {
      return malformedEnvelopeFailure([]);
    }

    if (!hasValidDeclaredPayload(decoded)) {
      return malformedDeclaredPayloadFailure([]);
    }

    if (decoded.payloadDigest !== digestPayload(decoded.payload)) {
      return malformedEnvelopeFailure([]);
    }

    events.push(decoded);
  }

  const healthResult = classifyReplayHealth(runId, events, replayed.health);
  if (!healthResult.ok) {
    return healthResult;
  }

  return {
    ok: true,
    value: {
      runId,
      events,
      lastSequence: healthResult.value.lastSequence,
      writerEpoch: healthResult.value.writerEpoch,
      health: healthResult.value.health,
      healthRecords: healthResult.value.healthRecords,
    },
  };
};
