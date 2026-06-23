import type { RunEventEnvelope } from './envelope.js';
import type { RunLogHealthRecord } from './health.js';
import type { RunDegradedHealth } from './result.js';

export type RunReplay = {
  runId: string;
  events: RunEventEnvelope[];
  lastSequence: number;
  writerEpoch?: number;
  health: RunDegradedHealth;
  healthRecords: RunLogHealthRecord[];
};

export type RunEventCursor = {
  runId: string;
  afterSequence: number;
};

export type WaitRunEventsRequest = {
  runId: string;
  cursor: RunEventCursor;
  timeoutMs: number;
  maxEvents?: number;
};

export type WaitRunEventsResult = {
  runId: string;
  cursor: RunEventCursor;
  events: RunEventEnvelope[];
  timedOut: boolean;
  lastSequence: number;
  health: RunDegradedHealth;
  healthRecords: RunLogHealthRecord[];
};
