import type { RunAppendFailureCode, RunAppendRejectedPayload, RunEventEnvelope } from '../contracts/index.js';

import type { RunEventLogDependencies } from './types.js';

type RejectionInput = {
  runId: string;
  writerEpoch: number;
  sequence: number;
  attempted?: RunEventEnvelope;
  failureCode: RunAppendFailureCode;
  expectedSequence?: number;
  observedSequence?: number;
  reason: string;
};

export const buildRunAppendRejected = (
  deps: RunEventLogDependencies,
  input: RejectionInput,
): RunEventEnvelope<RunAppendRejectedPayload> => {
  const payload: RunAppendRejectedPayload = {
    attemptedEventId: input.attempted?.eventId,
    attemptedType: input.attempted?.type ?? 'unknown',
    attemptedDomain: input.attempted?.domain ?? 'unknown',
    failureCode: input.failureCode,
    expectedSequence: input.expectedSequence,
    observedSequence: input.observedSequence,
    writerEpoch: input.writerEpoch,
    recordedReason: input.reason,
  };

  return {
    schema: 'kit-vnext.run-event.v1',
    runId: input.runId,
    eventId: deps.createEventId({ runId: input.runId, type: 'RunAppendRejected', sequence: input.sequence }),
    sequence: input.sequence,
    writerEpoch: input.writerEpoch,
    domain: 'core-01',
    type: 'RunAppendRejected',
    durability: 'durable',
    occurredAt: deps.now(),
    recordedAt: deps.now(),
    payloadDigest: deps.digestPayload(payload),
    payload,
  };
};
