import type {
  AppendReceipt,
  DurabilityClass,
  EventLogStore,
  LeaseCapability,
  NonDurableAck,
  StorageError,
} from '../../../foundation/storage/index.js';
import type {
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunDegradedHealth,
  RunDurabilityClass,
  RunEventEnvelope,
} from '../contracts/index.js';

import { encodeRunEnvelope } from './codec.js';
import { appendFailure } from './failures.js';

type AppendStorageResult =
  | { kind: 'receipt'; receipt: AppendReceipt }
  | { kind: 'partial' }
  | { kind: 'non-durable' }
  | { kind: 'failure'; failure: Result<never, RunAppendFailure> };

const isStorageError = (value: unknown): value is StorageError =>
  Boolean(value && typeof value === 'object' && 'code' in value && 'health' in value);

const isNonDurableAck = (value: unknown): value is NonDurableAck =>
  Boolean(
    value && typeof value === 'object' && 'acknowledged' in value && (value as NonDurableAck).durability === 'buffered',
  );

const isPartialAckUnknown = (value: unknown): boolean =>
  Boolean(value && typeof value === 'object' && 'partialAckUnknown' in value);

export const mapStorageError = (error: StorageError): Result<never, RunAppendFailure> => {
  if (error.code === 'stale-writer-fenced') {
    return appendFailure('stale-writer-fenced', error.message);
  }

  if (error.code === 'log-interior-corrupt') {
    return appendFailure('interior-corrupt', error.message);
  }

  if (error.code === 'network-fs-degraded' || error.health === 'read-only' || error.health === 'unusable') {
    return appendFailure('event-log-unavailable', error.message);
  }

  return appendFailure('sequence-conflict', error.message);
};

export const appendEnvelopes = (
  eventLogStore: EventLogStore,
  runId: string,
  lease: LeaseCapability,
  envelopes: readonly RunEventEnvelope[],
  durability: DurabilityClass,
): AppendStorageResult => {
  const handle = eventLogStore.openForAppend(runId, {
    name: lease.name,
    epoch: lease.epoch,
    token: lease.token,
  });

  if (isStorageError(handle)) {
    return { kind: 'failure', failure: mapStorageError(handle) };
  }

  const result = eventLogStore.append(handle, {
    expectedSequence: envelopes[0]?.sequence ?? 1,
    durability,
    payloads: envelopes.map((envelope) => encodeRunEnvelope(envelope)),
  });

  if (isPartialAckUnknown(result)) {
    return { kind: 'partial' };
  }

  if (isNonDurableAck(result)) {
    return { kind: 'non-durable' };
  }

  if (isStorageError(result)) {
    return { kind: 'failure', failure: mapStorageError(result) };
  }

  return { kind: 'receipt', receipt: result };
};

export const toRunReceipt = (
  runId: string,
  receipt: Pick<AppendReceipt, 'firstSequence' | 'lastSequence' | 'writerEpoch' | 'frameDigest'>,
  durability: RunDurabilityClass,
  envelopes: readonly RunEventEnvelope[],
  health: RunDegradedHealth,
): RunAppendReceipt => ({
  runId,
  firstSequence: receipt.firstSequence,
  lastSequence: receipt.lastSequence,
  writerEpoch: receipt.writerEpoch,
  durability,
  eventIds: envelopes.map((event) => event.eventId),
  payloadDigests: envelopes.map((event) => event.payloadDigest),
  frameDigest: receipt.frameDigest,
  health,
});
