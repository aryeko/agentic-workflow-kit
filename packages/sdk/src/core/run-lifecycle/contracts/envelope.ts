import type { RunCreatedPayload } from './payloads.js';
import type { RunDegradedHealth, RunDurabilityClass } from './result.js';

export type RunEventEnvelope<TPayload = unknown> = {
  schema: 'kit-vnext.run-event.v1';
  runId: string;
  eventId: string;
  sequence: number;
  writerEpoch: number;
  domain: string;
  type: string;
  durability: RunDurabilityClass;
  occurredAt: string;
  recordedAt: string;
  payloadDigest: string;
  payload: TPayload;
  causationId?: string;
  correlationId?: string;
  artifactRefs?: string[];
};

export type EvidenceEventRef = {
  eventId: string;
  sequence: number;
  payloadDigest: string;
  type: string;
};

export type CreateRunInput = {
  runId: string;
  holder: string;
  leaseTtlMs: number;
  idempotencyKey: string;
  createdAt: string;
  operatorRef?: string;
  correlationId?: string;
  artifactRefs?: string[];
  payload: RunCreatedPayload;
};

export type AppendIntent<TPayload = unknown> = {
  domain: string;
  type: string;
  durability: RunDurabilityClass;
  payload: TPayload;
  eventId?: string;
  occurredAt: string;
  causationId?: string;
  correlationId?: string;
  artifactRefs?: string[];
};

export type RunAppendReceipt = {
  runId: string;
  firstSequence: number;
  lastSequence: number;
  writerEpoch: number;
  durability: RunDurabilityClass;
  eventIds: string[];
  payloadDigests: string[];
  frameDigest: string;
  health: RunDegradedHealth;
};
