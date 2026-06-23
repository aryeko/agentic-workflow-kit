import type {
  AppendIntent,
  CreateRunInput,
  EvidenceEventRef,
  LeaseCapability,
  RunAppendFailure,
  RunAppendReceipt,
  RunAppendRejectedPayload,
  RunCreatedPayload,
  RunDegradedHealth,
  RunEventCursor,
  RunEventEnvelope,
  RunLaunchProjection,
  RunLifecycleTransitionPayload,
  RunLogCorruptionRecord,
  RunLogHealthRecord,
  RunMetricsProjection,
  RunPolicyBoundPayload,
  RunProjections,
  RunReplay,
  RunReplayFailure,
  RunStateProjection,
  RunSummaryProjection,
  RunWriter,
  SessionLinkedPayload,
  SessionLinkSupersededPayload,
  TaskSnapshotRecordedPayload,
  WaitRunEventsRequest,
  WaitRunEventsResult,
} from '../../../../src/index.js';

export const runId = 'run-123';
export const baseTimestamp = '2026-06-23T12:00:00.000Z';

export const leaseCapabilityFixture: LeaseCapability = {
  name: `run:${runId}`,
  epoch: 4,
  token: 'lease-token',
  expiresAt: new Date('2026-06-23T12:05:00.000Z'),
};

export const runCreatedPayloadFixture: RunCreatedPayload = {
  idempotencyKey: 'idem-1',
  operatorRef: 'operator://arye',
  requestedBy: 'runner',
};

export const runPolicyBoundPayloadFixture: RunPolicyBoundPayload = {
  policyDigest: 'sha256:policy',
  provenanceRef: 'artifact://policy',
  profile: 'strict',
};

export const taskSnapshotRecordedPayloadFixture: TaskSnapshotRecordedPayload = {
  taskId: 'task-1',
  sourceRef: 'tracker://task-1',
  snapshotDigest: 'sha256:task-snapshot',
};

export const runLifecycleTransitionPayloadFixture: RunLifecycleTransitionPayload = {
  from: 'created',
  to: 'configured',
  reason: 'policy bound',
  authority: 'policy',
  sourceEventIds: ['evt-created'],
};

export const sessionLinkedPayloadFixture: SessionLinkedPayload = {
  linkOrdinal: 1,
  sessionId: 'session-1',
  linkRole: 'primary',
  startedAt: '2026-06-23T12:01:00.000Z',
  sourceEventId: 'evt-session-linked',
};

export const sessionLinkSupersededPayloadFixture: SessionLinkSupersededPayload = {
  supersededOrdinal: 1,
  replacementOrdinal: 2,
  reason: 'recovered',
  sourceEventId: 'evt-session-superseded',
};

export const runAppendRejectedPayloadFixture: RunAppendRejectedPayload = {
  attemptedEventId: 'evt-transition',
  attemptedType: 'RunLifecycleTransitioned',
  attemptedDomain: 'core-01',
  failureCode: 'stale-writer-fenced',
  expectedSequence: 2,
  observedSequence: 3,
  writerEpoch: 4,
  recordedReason: 'writer epoch fenced',
};

export const runLogTailRepairedPayloadFixture = {
  repairedAt: '2026-06-23T12:03:00.000Z',
  lastCommittedSequence: 2,
  quarantinedBytes: 64,
  storageHealth: 'log-tail-repaired',
} as const;

export const runEventEnvelopeFixture: RunEventEnvelope<RunCreatedPayload> = {
  schema: 'kit-vnext.run-event.v1',
  runId,
  eventId: 'evt-created',
  sequence: 1,
  writerEpoch: 4,
  domain: 'core-01',
  type: 'RunCreated',
  durability: 'durable',
  occurredAt: baseTimestamp,
  recordedAt: baseTimestamp,
  payloadDigest: 'sha256:payload-created',
  payload: runCreatedPayloadFixture,
  correlationId: 'corr-1',
  artifactRefs: ['artifact://created'],
};

export const evidenceEventRefFixture: EvidenceEventRef = {
  eventId: runEventEnvelopeFixture.eventId,
  sequence: runEventEnvelopeFixture.sequence,
  payloadDigest: runEventEnvelopeFixture.payloadDigest,
  type: runEventEnvelopeFixture.type,
};

export const createRunInputFixture: CreateRunInput = {
  runId,
  holder: 'runner',
  leaseTtlMs: 30_000,
  idempotencyKey: 'idem-1',
  createdAt: baseTimestamp,
  operatorRef: 'operator://arye',
  correlationId: 'corr-1',
  artifactRefs: ['artifact://created'],
  payload: runCreatedPayloadFixture,
};

export const appendIntentFixture: AppendIntent<RunLifecycleTransitionPayload> = {
  domain: 'core-01',
  type: 'RunLifecycleTransitioned',
  durability: 'barrier',
  payload: runLifecycleTransitionPayloadFixture,
  eventId: 'evt-transition',
  occurredAt: '2026-06-23T12:02:00.000Z',
  causationId: 'evt-created',
  correlationId: 'corr-1',
  artifactRefs: ['artifact://transition'],
};

export const runAppendReceiptFixture: RunAppendReceipt = {
  runId,
  firstSequence: 2,
  lastSequence: 2,
  writerEpoch: 4,
  durability: 'barrier',
  eventIds: ['evt-transition'],
  payloadDigests: ['sha256:payload-transition'],
  frameDigest: 'sha256:frame-2',
  health: 'ok',
};

export const runLogCorruptionRecordFixture: RunLogCorruptionRecord = {
  kind: 'tail-repaired',
  detectedAt: '2026-06-23T12:03:00.000Z',
  firstAffectedSequence: 3,
  lastValidSequence: 2,
  storageHealth: 'log-tail-repaired',
  detail: 'truncated uncommitted bytes',
};

export const runLogUnavailableRecordFixture: RunLogHealthRecord = {
  kind: 'event-log-unavailable',
  detectedAt: '2026-06-23T12:04:00.000Z',
  storageHealth: 'read-only',
  detail: 'filesystem remounted read-only',
};

export const runReplayFixture: RunReplay = {
  runId,
  events: [runEventEnvelopeFixture],
  lastSequence: 1,
  writerEpoch: 4,
  health: 'tail-repaired',
  healthRecords: [runLogCorruptionRecordFixture],
};

export const runEventCursorFixture: RunEventCursor = {
  runId,
  afterSequence: 1,
};

export const waitRunEventsRequestFixture: WaitRunEventsRequest = {
  runId,
  cursor: runEventCursorFixture,
  timeoutMs: 10_000,
  maxEvents: 25,
};

export const waitRunEventsResultFixture: WaitRunEventsResult = {
  runId,
  cursor: runEventCursorFixture,
  events: [runEventEnvelopeFixture],
  timedOut: false,
  lastSequence: 1,
  health: 'ok',
  healthRecords: [],
};

export const runStateProjectionFixture: RunStateProjection = {
  lifecycle: 'running',
  currentSequence: 4,
  writerEpoch: 4,
  degradedHealth: 'ok',
};

export const runSummaryProjectionFixture: RunSummaryProjection = {
  runId,
  taskId: 'task-1',
  status: 'running',
  ownerSessionId: 'session-1',
  artifactRefs: ['artifact://summary'],
  unknownEvents: [],
};

export const runMetricsProjectionFixture: RunMetricsProjection = {
  eventCount: 4,
  retryCount: 1,
  parkedMs: 1250,
  firstRecordedAt: baseTimestamp,
  lastRecordedAt: '2026-06-23T12:05:00.000Z',
};

export const runLaunchProjectionFixture: RunLaunchProjection = {
  policyDigest: 'sha256:policy',
  taskSnapshotDigest: 'sha256:task-snapshot',
  linkage: 'known',
  currentSession: sessionLinkedPayloadFixture,
  linkHistory: [sessionLinkedPayloadFixture],
};

export const runProjectionsFixture: RunProjections = {
  state: runStateProjectionFixture,
  summary: runSummaryProjectionFixture,
  metrics: runMetricsProjectionFixture,
  launch: runLaunchProjectionFixture,
};

export const runAppendFailureFixture: RunAppendFailure = {
  code: 'stale-writer-fenced',
  message: 'writer fenced',
  retryable: true,
  rejection: runAppendRejectedPayloadFixture,
};

export const runReplayFailureFixture: RunReplayFailure = {
  code: 'interior-corrupt',
  message: 'corrupt event frame',
  healthRecords: [runLogCorruptionRecordFixture],
};

export const degradedHealthFixture: RunDegradedHealth = 'event-log-unavailable';

export const runWriterFixture: RunWriter = {
  append: () => ({ ok: true, value: runAppendReceiptFixture }),
  renew: () => ({ ok: true, value: runWriterFixture }),
};
