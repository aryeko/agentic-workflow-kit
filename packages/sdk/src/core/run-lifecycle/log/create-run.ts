import type { CreateRunInput, Result, RunAppendFailure, RunEventEnvelope, RunWriter } from '../contracts/index.js';
import { createRunWriter } from './append-writer.js';
import { appendFailure } from './failures.js';
import { recoverLostAck } from './lost-ack-recovery.js';
import { appendEnvelopes } from './storage.js';
import type { RunEventLogDependencies } from './types.js';

const leaseName = (runId: string): string => `run-writer:${runId}`;

type AcquiredLease = {
  name: string;
  epoch: number;
  token: string;
};

const createRunPayload = (input: CreateRunInput): CreateRunInput['payload'] => ({
  idempotencyKey: input.idempotencyKey,
  ...(input.operatorRef === undefined ? {} : { operatorRef: input.operatorRef }),
  requestedBy: input.requestedBy,
});

const releaseAcquiredLease = (deps: RunEventLogDependencies, lease: AcquiredLease): void => {
  deps.leaseStore.release(lease.name, lease.epoch, lease.token);
};

export const createRun = (
  deps: RunEventLogDependencies,
  input: CreateRunInput,
): Result<RunWriter, RunAppendFailure> => {
  const lease = deps.leaseStore.acquire(leaseName(input.runId), input.holder, input.leaseTtlMs);
  if ('code' in lease) {
    if (lease.code === 'stale-writer-fenced') {
      return appendFailure('stale-writer-fenced', lease.message);
    }

    return appendFailure('event-log-unavailable', lease.message);
  }

  const payload = createRunPayload(input);
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
    payloadDigest: deps.digestPayload(payload),
    payload,
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

  const appended = appendEnvelopes(deps.eventLogStore, input.runId, lease, [created, transitioned], 'barrier', () =>
    deps.leaseStore.fence(lease.name, lease.epoch, lease.token),
  );
  if (appended.kind === 'failure') {
    releaseAcquiredLease(deps, lease);
    return appended.failure;
  }

  if (appended.kind === 'partial') {
    const recovered = recoverLostAck({ deps, runId: input.runId, lease }, [created, transitioned], 'barrier');
    if (!recovered.ok) {
      releaseAcquiredLease(deps, lease);
      return recovered;
    }

    return {
      ok: true,
      value: createRunWriter({ deps, runId: input.runId, lease }),
    };
  }

  if (appended.kind === 'non-durable') {
    releaseAcquiredLease(deps, lease);
    return appendFailure('partial-ack-unknown', 'Run creation acknowledgement was not authoritative.');
  }

  return {
    ok: true,
    value: createRunWriter({ deps, runId: input.runId, lease }),
  };
};
