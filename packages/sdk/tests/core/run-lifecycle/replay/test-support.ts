import type { EventLogStore, ReplayResult, RunEventEnvelope, StoredRecord } from '../../../../src/index.js';

const textEncoder = new TextEncoder();

const encodeJson = (value: unknown): Uint8Array => textEncoder.encode(JSON.stringify(value));

export const runId = 'run-replay-123';
export const digestPayload = (payload: unknown): string => `digest:${JSON.stringify(payload)}`;

export const lifecycleTransitionPayload = {
  from: 'created',
  to: 'configured',
  reason: 'policy bound',
  authority: 'policy',
  sourceEventIds: ['evt-1'],
} as const;

export const tailRepairedPayload = {
  repairedAt: '2026-06-23T12:03:00.000Z',
  lastCommittedSequence: 2,
  quarantinedBytes: 64,
  storageHealth: 'log-tail-repaired',
} as const;

export const makeEnvelope = (
  sequence: number,
  type: string,
  payload: unknown,
  overrides: Partial<RunEventEnvelope> = {},
): RunEventEnvelope => ({
  schema: 'kit-vnext.run-event.v1',
  runId,
  eventId: `evt-${sequence}`,
  sequence,
  writerEpoch: 4,
  domain: 'core-01',
  type,
  durability: 'durable',
  occurredAt: `2026-06-23T12:0${sequence}:00.000Z`,
  recordedAt: `2026-06-23T12:0${sequence}:01.000Z`,
  payloadDigest: digestPayload(payload),
  payload,
  ...overrides,
});

export const makeStoredRecord = (
  sequence: number,
  envelope: unknown,
  overrides: Partial<StoredRecord> = {},
): StoredRecord => ({
  sequence,
  writerEpoch: 4,
  leaseName: `run-writer:${runId}`,
  payloadLength: encodeJson(envelope).length,
  payloadDigest: `digest:${sequence}`,
  frameDigest: `frame:${sequence}`,
  byteRange: {
    start: (sequence - 1) * 100,
    end: sequence * 100,
  },
  payload: encodeJson(envelope),
  ...overrides,
});

export const makeReplayStore = (result: ReplayResult): EventLogStore => ({
  openForAppend() {
    throw new Error('not implemented in replay tests');
  },
  append() {
    throw new Error('not implemented in replay tests');
  },
  replay(logId: string): ReplayResult {
    if (logId !== runId) {
      throw new Error(`unexpected run id: ${logId}`);
    }

    return result;
  },
});
