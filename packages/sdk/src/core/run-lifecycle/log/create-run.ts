import type { CreateRunInput, Result, RunAppendFailure, RunEventEnvelope, RunWriter } from '../contracts/index.js';
import { createRunWriter } from './append-writer.js';
import { appendFailure } from './failures.js';
import { recoverLostAck } from './lost-ack-recovery.js';
import { appendEnvelopes } from './storage.js';
import type { RunEventLogDependencies } from './types.js';

const leaseName = (runId: string): string => `run-writer:${runId}`;

export const createRun = (
  deps: RunEventLogDependencies,
  input: CreateRunInput,
): Result<RunWriter, RunAppendFailure> => {
  const lease = deps.leaseStore.acquire(leaseName(input.runId), input.holder, input.leaseTtlMs);
  if ('code' in lease) {
    return appendFailure('event-log-unavailable', lease.message);
  }

  const created: RunEventEnvelope = {
    schema: 'kit-vnext.run-event.v1',
    runId: input.runId,
    eventId: deps.createEventId({ runId: input.runId, type: 'RunCreated', sequence: 1 }),
    sequence: 1,
    writerEpoch: lease.epoch,
    domain: 'core-01',
    type: 'RunCreated',
    durability: 'barrier',
    occurredAt: input.createdAt,
    recordedAt: deps.now(),
    payloadDigest: deps.digestPayload(input.payload),
    payload: input.payload,
    correlationId: input.correlationId,
    artifactRefs: input.artifactRefs,
  };

  const transitionPayload = {
    from: null,
    to: 'created',
    reason: 'run created',
    authority: 'system',
    sourceEventIds: [created.eventId],
  } as const;

  const transitioned: RunEventEnvelope = {
    schema: 'kit-vnext.run-event.v1',
    runId: input.runId,
    eventId: deps.createEventId({ runId: input.runId, type: 'RunLifecycleTransitioned', sequence: 2 }),
    sequence: 2,
    writerEpoch: lease.epoch,
    domain: 'core-01',
    type: 'RunLifecycleTransitioned',
    durability: 'barrier',
    occurredAt: input.createdAt,
    recordedAt: deps.now(),
    payloadDigest: deps.digestPayload(transitionPayload),
    payload: transitionPayload,
    causationId: created.eventId,
    correlationId: input.correlationId,
    artifactRefs: input.artifactRefs,
  };

  const appended = appendEnvelopes(deps.eventLogStore, input.runId, lease, [created, transitioned], 'barrier');
  if (appended.kind === 'failure') {
    return appended.failure;
  }

  if (appended.kind === 'partial') {
    const recovered = recoverLostAck({ deps, runId: input.runId, lease }, [created, transitioned], 'barrier');
    if (!recovered.ok) {
      return recovered;
    }

    return {
      ok: true,
      value: createRunWriter({ deps, runId: input.runId, lease }),
    };
  }

  if (appended.kind === 'non-durable') {
    return appendFailure('partial-ack-unknown', 'Run creation acknowledgement was not authoritative.');
  }

  return {
    ok: true,
    value: createRunWriter({ deps, runId: input.runId, lease }),
  };
};
