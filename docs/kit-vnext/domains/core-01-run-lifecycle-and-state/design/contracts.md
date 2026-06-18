---
title: "Run Lifecycle & Event State - contracts"
status: approved
last-reviewed: "2026-06-18"
---

# Contracts

Core-01 exposes this host-neutral run log contract:

```ts
type Result<TValue, TFailure> = { ok: true; value: TValue } | { ok: false; error: TFailure };
type RunDurabilityClass = "durable" | "barrier";
type RunLifecycleState = "created" | "configured" | "task_snapshotted" | "workspace_ready" |
  "worker_starting" | "running" | "parked" | "runner_verifying" | "forge_waiting" |
  "merge_waiting" | "settling" | "completed" | "blocked" | "failed" | "canceled";
type RunDegradedHealth = "ok" | "tail_repaired" | "interior_corrupt" | "event_log_unavailable";
type RunEventEnvelope<TPayload = unknown> = {
  schema: "kit-vnext.run-event.v1"; runId: string; eventId: string; sequence: number;
  writerEpoch: number; domain: string; type: string; durability: RunDurabilityClass;
  occurredAt: string; recordedAt: string; payloadDigest: string; payload: TPayload;
  causationId?: string; correlationId?: string; artifactRefs?: string[];
};
type CreateRunInput = {
  runId: string; holder: string; leaseTtlMs: number; idempotencyKey: string;
  createdAt: string; operatorRef?: string; correlationId?: string; artifactRefs?: string[];
  payload: RunCreatedPayload;
};
type AppendIntent<TPayload = unknown> = {
  domain: string; type: string; durability: RunDurabilityClass; payload: TPayload;
  eventId?: string; occurredAt: string; causationId?: string; correlationId?: string;
  artifactRefs?: string[];
};
type RunAppendReceipt = {
  runId: string; firstSequence: number; lastSequence: number; writerEpoch: number;
  durability: RunDurabilityClass; eventIds: string[]; payloadDigests: string[];
  frameDigest: string; health: RunDegradedHealth;
};
type RunReplay = {
  runId: string; events: RunEventEnvelope[]; lastSequence: number; writerEpoch?: number;
  health: RunDegradedHealth; healthRecords: RunLogHealthRecord[];
};
type RunEventCursor = { runId: string; afterSequence: number; };
type WaitRunEventsRequest = {
  runId: string; cursor: RunEventCursor; timeoutMs: number; maxEvents?: number;
};
type WaitRunEventsResult = {
  runId: string; cursor: RunEventCursor; events: RunEventEnvelope[]; timedOut: boolean;
  lastSequence: number; health: RunDegradedHealth; healthRecords: RunLogHealthRecord[];
};
type RunProjections = {
  state: RunStateProjection; summary: RunSummaryProjection;
  metrics: RunMetricsProjection; launch: RunLaunchProjection;
};
type RunStateProjection = {
  lifecycle: RunLifecycleState; currentSequence: number; writerEpoch?: number;
  terminalReason?: string; degradedHealth: RunDegradedHealth;
};
type RunSummaryProjection = { runId: string; taskId?: string; status: RunLifecycleState;
  ownerSessionId?: string; artifactRefs: string[]; unknownEvents: RunEventEnvelope[]; };
type RunMetricsProjection = { eventCount: number; retryCount: number; parkedMs: number;
  firstRecordedAt?: string; lastRecordedAt?: string; };
type RunLaunchProjection = { policyDigest?: string; taskSnapshotDigest?: string;
  linkage: "known" | "unknown" | "ambiguous"; currentSession?: SessionLinkedPayload;
  linkHistory: SessionLinkedPayload[]; };
type RunAppendFailureCode = "stale_writer_fenced" | "sequence_conflict" |
  "illegal_lifecycle_transition" | "durability_insufficient" | "partial_ack_unknown" |
  "interior_corrupt" | "event_log_unavailable";
type RunAppendFailure = { code: RunAppendFailureCode; message: string; retryable: boolean;
  rejection?: RunAppendRejectedPayload; };
type RunReplayFailure = { code: "malformed_envelope" | "interior_corrupt" |
  "event_log_unavailable" | "malformed_declared_payload"; message: string;
  healthRecords: RunLogHealthRecord[]; };
type RunCreatedPayload = { idempotencyKey: string; operatorRef?: string; requestedBy: string };
type RunPolicyBoundPayload = { policyDigest: string; provenanceRef: string; profile?: string };
type TaskSnapshotRecordedPayload = { taskId: string; sourceRef: string; snapshotDigest: string };
type RunLifecycleTransitionPayload = { from: RunLifecycleState | null; to: RunLifecycleState;
  reason: string; authority: "operator" | "policy" | "system" | "recovery";
  sourceEventIds: string[]; terminal?: boolean; };
type SessionLinkedPayload = { linkOrdinal: number; sessionId: string;
  ownershipClass: "primary" | "recovery" | "observer"; startedAt: string;
  sourceEventId: string; supersedesOrdinal?: number; };
type SessionLinkSupersededPayload = { supersededOrdinal: number; replacementOrdinal: number;
  reason: string; sourceEventId: string; };
type RunAppendRejectedPayload = { attemptedEventId?: string; attemptedType: string;
  attemptedDomain: string; failureCode: RunAppendFailureCode; expectedSequence?: number;
  observedSequence?: number; writerEpoch?: number; recordedReason: string; };
type RunLogTailRepairedPayload = { repairedAt: string; lastCommittedSequence: number;
  quarantinedBytes: number; storageHealth: "log-tail-repaired"; };
type RunLogCorruptionRecord = { kind: "tail_repaired" | "interior_corrupt";
  detectedAt: string; firstAffectedSequence?: number; lastValidSequence?: number;
  storageHealth: "log-tail-repaired" | "log-interior-corrupt"; detail: string; };
type RunLogHealthRecord = RunLogCorruptionRecord | { kind: "event_log_unavailable";
  detectedAt: string; storageHealth: "network-fs-degraded" | "read-only" | "unusable";
  detail: string; };
interface RunEventLog { createRun(input: CreateRunInput): Result<RunWriter, RunAppendFailure>;
  openWriter(runId: string, lease: LeaseCapability): Result<RunWriter, RunAppendFailure>;
  replay(runId: string): Result<RunReplay, RunReplayFailure>;
  waitRunEvents(request: WaitRunEventsRequest): Result<WaitRunEventsResult, RunReplayFailure>;
  project(runId: string): Result<RunProjections, RunReplayFailure>; }
interface RunWriter { append(batch: AppendIntent[]): Result<RunAppendReceipt, RunAppendFailure>;
  renew(lease: LeaseCapability): Result<RunWriter, RunAppendFailure>; }
```

`AppendIntent.durability` is the event's requested durability. `RunAppendReceipt.durability` is the
effective fnd-02 batch durability after the writer applies the strongest requested durability across
the batch.
