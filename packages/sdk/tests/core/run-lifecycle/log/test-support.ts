import { expect } from 'vitest';
import { createRunEventLog } from '../../../../src/core/run-lifecycle/log/index.js';
import type {
  AppendBatch,
  AppendIntent,
  AppendReceipt,
  EventLogStore,
  LeaseCapability,
  LeaseStore,
  LogHandle,
  NonDurableAck,
  Result,
  RunAppendFailure,
  RunEventEnvelope,
  RunEventLog,
  RunLifecycleTransitionPayload,
  RunReplayFailure,
  StorageError,
  StorageHealth,
  StoredRecord,
} from '../../../../src/index.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const runId = 'run-log-123';
export const recordedAt = '2026-06-23T12:00:00.500Z';

export type AppendCall = {
  handle: LogHandle;
  batch: AppendBatch;
  envelopes: RunEventEnvelope[];
};

export type ReleaseCall = {
  name: string;
  epoch: number;
  token: string;
};

type PartialAckUnknown = {
  code: 'partial-ack-unknown';
  commit: 'exact' | 'absent' | 'conflict';
};

type AppendOutcome = AppendReceipt | NonDurableAck | StorageError | PartialAckUnknown;

type HarnessOptions = {
  replayHealth?: StorageHealth;
  appendOutcomes?: AppendOutcome[];
};

export type LogHarness = {
  log: RunEventLog;
  leaseStore: LeaseStore;
  eventLogStore: EventLogStore;
  appendCalls: AppendCall[];
  releaseCalls: ReleaseCall[];
  records: StoredRecord[];
  acquireLease(): LeaseCapability;
  supersedeLease(): LeaseCapability;
  seedCreatedRun(): void;
  seedLifecycle(
    state: RunLifecycleTransitionPayload['to'],
    sequence: number,
    overrides?: Partial<RunEventEnvelope>,
  ): void;
  decode(payload: Uint8Array): RunEventEnvelope;
  resetAppendCalls(): void;
};

const encode = (value: unknown): Uint8Array => textEncoder.encode(JSON.stringify(value));

const decode = (payload: Uint8Array): RunEventEnvelope => JSON.parse(textDecoder.decode(payload)) as RunEventEnvelope;

const makeReceipt = (batch: AppendBatch, handle: LogHandle, appendIndex: number): AppendReceipt => ({
  firstSequence: batch.expectedSequence,
  lastSequence: batch.expectedSequence + batch.payloads.length - 1,
  writerEpoch: handle.epoch,
  leaseName: handle.leaseName,
  durability: batch.durability,
  byteRange: { start: appendIndex * 100, end: appendIndex * 100 + batch.payloads.length },
  payloadDigest: `frame-payload:${appendIndex}`,
  frameDigest: `frame:${appendIndex}`,
});

const makeRecord = (envelope: RunEventEnvelope, index: number): StoredRecord => ({
  sequence: envelope.sequence,
  writerEpoch: envelope.writerEpoch,
  leaseName: `run-writer:${envelope.runId}`,
  payloadLength: encode(envelope).length,
  payloadDigest: envelope.payloadDigest,
  frameDigest: `record-frame:${index}`,
  byteRange: { start: index * 100, end: index * 100 + 1 },
  payload: encode(envelope),
});

export function makeEnvelope<TPayload>(
  sequence: number,
  type: string,
  payload: TPayload,
  overrides: Partial<RunEventEnvelope<TPayload>> = {},
): RunEventEnvelope<TPayload> {
  return {
    schema: 'kit-vnext.run-event.v1',
    runId,
    eventId: `evt-${sequence}`,
    sequence,
    writerEpoch: 1,
    domain: 'core-01',
    type,
    durability: 'barrier',
    occurredAt: `2026-06-23T12:00:${String(sequence).padStart(2, '0')}.000Z`,
    recordedAt,
    payloadDigest: `digest:${type}:${JSON.stringify(payload)}`,
    payload,
    ...overrides,
  };
}

export function lifecyclePayload(
  from: RunLifecycleTransitionPayload['from'],
  to: RunLifecycleTransitionPayload['to'],
  overrides: Partial<RunLifecycleTransitionPayload> = {},
): RunLifecycleTransitionPayload {
  return {
    from,
    to,
    reason: overrides.reason ?? `${from ?? 'null'} -> ${to}`,
    authority: overrides.authority ?? 'system',
    sourceEventIds: overrides.sourceEventIds ?? [`Evidence:${to}`],
    terminal: overrides.terminal,
  };
}

export function createHarness(options: HarnessOptions = {}): LogHarness {
  let currentLease: LeaseCapability | undefined;
  let nextEpoch = 1;
  let nextGeneratedId = 1;
  const records: StoredRecord[] = [];
  const appendCalls: AppendCall[] = [];
  const releaseCalls: ReleaseCall[] = [];
  const appendOutcomes = [...(options.appendOutcomes ?? [])];

  const leaseStore: LeaseStore = {
    acquire(name: string): LeaseCapability {
      currentLease = {
        name,
        epoch: nextEpoch,
        token: `token-${nextEpoch}`,
        expiresAt: new Date('2026-06-23T13:00:00.000Z'),
      };
      nextEpoch += 1;
      return currentLease;
    },
    renew(name: string, epoch: number, token: string): LeaseCapability | StorageError {
      if (!currentLease || currentLease.name !== name || currentLease.epoch !== epoch || currentLease.token !== token) {
        return {
          code: 'stale-writer-fenced',
          message: 'stale lease',
          health: 'ok',
        };
      }

      currentLease = {
        ...currentLease,
        epoch: nextEpoch,
        token: `token-${nextEpoch}`,
      };
      nextEpoch += 1;
      return currentLease;
    },
    release(name: string, epoch: number, token: string) {
      releaseCalls.push({ name, epoch, token });
      if (!currentLease || currentLease.name !== name || currentLease.epoch !== epoch || currentLease.token !== token) {
        return {
          code: 'stale-writer-fenced',
          message: 'stale lease',
          health: 'ok',
        };
      }

      currentLease = undefined;
      return undefined;
    },
    read(name: string) {
      return {
        snapshot: currentLease
          ? {
              name,
              epoch: currentLease.epoch,
              holder: 'holder-1',
              tokenDigest: `digest:${currentLease.token}`,
              expiresAt: currentLease.expiresAt,
            }
          : undefined,
        health: 'ok',
      };
    },
    fence(name: string, epoch: number, token: string): boolean {
      return Boolean(
        currentLease && currentLease.name === name && currentLease.epoch === epoch && currentLease.token === token,
      );
    },
  };

  const eventLogStore: EventLogStore = {
    openForAppend(logId: string, lease: { name: string; epoch: number; token: string }): LogHandle {
      return {
        logId,
        leaseName: lease.name,
        epoch: lease.epoch,
        token: lease.token,
      };
    },
    append(handle: LogHandle, batch: AppendBatch): AppendReceipt | NonDurableAck | StorageError {
      const envelopes = batch.payloads.map((payload) => decode(payload));
      appendCalls.push({ handle, batch, envelopes });
      const outcome = appendOutcomes.shift();

      if (outcome && 'code' in outcome && outcome.code === 'partial-ack-unknown') {
        if (outcome.commit === 'exact') {
          records.push(...envelopes.map((envelope, index) => makeRecord(envelope, records.length + index)));
        }

        if (outcome.commit === 'conflict') {
          records.push(
            ...envelopes.map((envelope, index) =>
              makeRecord(
                {
                  ...envelope,
                  eventId: `${envelope.eventId}:conflict`,
                  payloadDigest: `${envelope.payloadDigest}:conflict`,
                },
                records.length + index,
              ),
            ),
          );
        }

        return {
          code: 'network-fs-degraded',
          message: 'lost acknowledgement',
          health: 'network-fs-degraded',
          partialAckUnknown: true,
        } as StorageError & { partialAckUnknown: true };
      }

      if (outcome) {
        if ('firstSequence' in outcome || 'acknowledged' in outcome || 'code' in outcome) {
          return outcome;
        }
      }

      records.push(...envelopes.map((envelope, index) => makeRecord(envelope, records.length + index)));
      return makeReceipt(batch, handle, appendCalls.length);
    },
    replay(logId: string) {
      if (logId !== runId) {
        throw new Error(`unexpected log id: ${logId}`);
      }

      return {
        records: [...records],
        health: options.replayHealth ?? 'ok',
      };
    },
  };

  const log = createRunEventLog({
    leaseStore,
    eventLogStore,
    now: () => recordedAt,
    waitClock: () => 0,
    createEventId: () => `generated-${nextGeneratedId++}`,
    digestPayload: (payload) => `digest:${JSON.stringify(payload)}`,
  });

  const acquireLease = (): LeaseCapability =>
    leaseStore.acquire(`run-writer:${runId}`, 'holder-1', 60_000) as LeaseCapability;

  const supersedeLease = (): LeaseCapability =>
    leaseStore.acquire(`run-writer:${runId}`, 'holder-2', 60_000) as LeaseCapability;

  const seedCreatedRun = (): void => {
    const created = makeEnvelope(1, 'RunCreated', {
      idempotencyKey: 'idempotency-1',
      requestedBy: 'operator-1',
    });
    const transitioned = makeEnvelope(
      2,
      'RunLifecycleTransitioned',
      lifecyclePayload(null, 'created', {
        sourceEventIds: [created.eventId],
      }),
      {
        eventId: 'evt-created-transition',
      },
    );
    records.push(makeRecord(created, records.length), makeRecord(transitioned, records.length + 1));
  };

  const seedLifecycle = (
    state: RunLifecycleTransitionPayload['to'],
    sequence: number,
    overrides: Partial<RunEventEnvelope> = {},
  ): void => {
    const prior = records.length > 0 ? decode(records[records.length - 1].payload) : undefined;
    const from =
      state === 'created' ? null : ((prior?.payload as RunLifecycleTransitionPayload | undefined)?.to ?? 'created');
    const envelope = makeEnvelope(sequence, 'RunLifecycleTransitioned', lifecyclePayload(from, state), overrides);
    records.push(makeRecord(envelope, records.length));
  };

  return {
    log,
    leaseStore,
    eventLogStore,
    appendCalls,
    releaseCalls,
    records,
    acquireLease,
    supersedeLease,
    seedCreatedRun,
    seedLifecycle,
    decode,
    resetAppendCalls() {
      appendCalls.splice(0, appendCalls.length);
    },
  };
}

export function expectFailureCode(
  result: Result<unknown, RunAppendFailure | RunReplayFailure>,
  code: RunAppendFailure['code'] | RunReplayFailure['code'],
): void {
  if (result.ok) {
    throw new Error(`expected failure ${code}`);
  }

  expect(result.error.code).toBe(code);
}

export function appendIntent<TPayload>(
  type: string,
  payload: TPayload,
  overrides: Partial<AppendIntent<TPayload>> & { sequence?: number; writerEpoch?: number; payloadDigest?: string } = {},
): AppendIntent<TPayload> {
  return {
    domain: overrides.domain ?? 'core-01',
    type,
    durability: overrides.durability ?? 'durable',
    payload,
    occurredAt: overrides.occurredAt ?? '2026-06-23T12:00:10.000Z',
    eventId: overrides.eventId,
    causationId: overrides.causationId,
    correlationId: overrides.correlationId,
    artifactRefs: overrides.artifactRefs,
    ...overrides,
  };
}
