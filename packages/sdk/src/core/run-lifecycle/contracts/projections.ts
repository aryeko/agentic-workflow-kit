import type { RunEventEnvelope } from './envelope.js';
import type { SessionLinkedPayload } from './payloads.js';
import type { RunDegradedHealth, RunLifecycleState } from './result.js';

export type RunProjections = {
  state: RunStateProjection;
  summary: RunSummaryProjection;
  metrics: RunMetricsProjection;
  launch: RunLaunchProjection;
};

export type RunStateProjection = {
  lifecycle: RunLifecycleState | null;
  currentSequence?: number;
  writerEpoch?: number;
  terminalReason?: string;
  degradedHealth: RunDegradedHealth;
};

export type RunSummaryProjection = {
  runId: string;
  taskId?: string;
  status: RunLifecycleState | null;
  ownerSessionId?: string;
  artifactRefs: string[];
  unknownEvents: RunEventEnvelope[];
};

export type RunMetricsProjection = {
  eventCount: number;
  retryCount: number;
  parkedMs: number;
  firstRecordedAt?: string;
  lastRecordedAt?: string;
};

export type RunLaunchProjection = {
  policyDigest?: string;
  taskSnapshotDigest?: string;
  linkage: 'known' | 'unknown' | 'ambiguous';
  currentSession?: SessionLinkedPayload;
  linkHistory: SessionLinkedPayload[];
};
