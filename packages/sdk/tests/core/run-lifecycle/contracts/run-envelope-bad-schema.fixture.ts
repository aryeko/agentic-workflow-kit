import type { RunCreatedPayload, RunEventEnvelope } from '../../../../src/index.js';

const invalidEnvelope: RunEventEnvelope<RunCreatedPayload> = {
  schema: 'kit-vnext.run-event.v2',
  runId: 'run-123',
  eventId: 'evt-created',
  sequence: 1,
  writerEpoch: 1,
  domain: 'core-01',
  type: 'RunCreated',
  durability: 'durable',
  occurredAt: '2026-06-23T12:00:00.000Z',
  recordedAt: '2026-06-23T12:00:00.000Z',
  payloadDigest: 'sha256:payload',
  payload: {
    idempotencyKey: 'idem-1',
    requestedBy: 'runner',
  },
};

void invalidEnvelope;
