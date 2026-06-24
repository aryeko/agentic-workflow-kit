import type {
  Result,
  RunEventEnvelope,
  RunLogHealthRecord,
  RunReplay,
  RunReplayFailure,
} from '../../../../src/index.js';

const baseRunId = 'run-cursor-wait-123';

export const textRunId = baseRunId;

export const makeEnvelope = (sequence: number, overrides: Partial<RunEventEnvelope> = {}): RunEventEnvelope => ({
  schema: 'kit-vnext.run-event.v1',
  runId: baseRunId,
  eventId: `evt-${sequence}`,
  sequence,
  writerEpoch: 4,
  domain: 'core-01',
  type: 'RunLifecycleTransitioned',
  durability: 'durable',
  occurredAt: `2026-06-23T12:${String(sequence).padStart(2, '0')}:00.000Z`,
  recordedAt: `2026-06-23T12:${String(sequence).padStart(2, '0')}:01.000Z`,
  payloadDigest: `sha256:${sequence}`,
  payload: {
    sequence,
  },
  ...overrides,
});

export const makeReplaySuccess = (
  events: RunEventEnvelope[],
  overrides: Partial<RunReplay> = {},
): Result<RunReplay, RunReplayFailure> => ({
  ok: true,
  value: {
    runId: baseRunId,
    events,
    lastSequence: events.at(-1)?.sequence ?? 0,
    writerEpoch: events.at(-1)?.writerEpoch,
    health: 'ok',
    healthRecords: [],
    ...overrides,
  },
});

export const makeReplayFailure = (
  code: RunReplayFailure['code'],
  healthRecords: RunLogHealthRecord[] = [],
): Result<RunReplay, RunReplayFailure> => ({
  ok: false,
  error: {
    code,
    message: `Replay failed with ${code}.`,
    healthRecords,
  },
});
