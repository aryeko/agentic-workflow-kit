import type {
  AnalysisFailure,
  AnalysisRequest,
  AnalysisResult,
  AnalysisSnapshot,
  AnalysisTrigger,
  AnalysisTriggerKind,
} from '../../../../src/core/observability/analyzer/index.js';
import type {
  ArtifactRef,
  EvidenceEventRef,
  RunEventCursor,
  RunEventEnvelope,
  RunLifecycleTransitionPayload,
  RunProjections,
  RunReplay,
} from '../../../../src/index.js';

export const runId = 'run-analyzer-123';
export const baseTimestamp = '2026-06-23T12:00:00.000Z';

export const artifactRefFixture: ArtifactRef = {
  id: 'artifact-analysis-1',
  digest: 'sha256:artifact-analysis-1',
  size: 32,
  mediaType: 'application/json',
  retentionClass: 'run-evidence',
  classification: 'analysis',
  redactionState: 'redacted',
};

export const secondaryArtifactRefFixture: ArtifactRef = {
  id: 'artifact-analysis-2',
  digest: 'sha256:artifact-analysis-2',
  size: 64,
  mediaType: 'text/plain',
  retentionClass: 'run-evidence',
  classification: 'analysis',
  redactionState: 'redacted',
};

type EventInput<TPayload> = {
  eventId: string;
  sequence: number;
  type: string;
  payload: TPayload;
  domain?: string;
  durability?: 'durable' | 'barrier';
  occurredAt?: string;
  recordedAt?: string;
  payloadDigest?: string;
  artifactRefs?: string[];
};

export const createEvent = <TPayload>({
  eventId,
  sequence,
  type,
  payload,
  domain = 'core-07',
  durability = 'durable',
  occurredAt = baseTimestamp,
  recordedAt = baseTimestamp,
  payloadDigest = `sha256:${eventId}`,
  artifactRefs,
}: EventInput<TPayload>): RunEventEnvelope<TPayload> => ({
  schema: 'kit-vnext.run-event.v1',
  runId,
  eventId,
  sequence,
  writerEpoch: 3,
  domain,
  type,
  durability,
  occurredAt,
  recordedAt,
  payloadDigest,
  payload,
  artifactRefs,
});

export const createEvidenceEventRef = (event: RunEventEnvelope): EvidenceEventRef => ({
  eventId: event.eventId,
  sequence: event.sequence,
  payloadDigest: event.payloadDigest,
  type: event.type,
});

export const createLifecycleTransitionEvent = (
  eventId: string,
  sequence: number,
  to: RunLifecycleTransitionPayload['to'],
  from: RunLifecycleTransitionPayload['from'] = 'running',
): RunEventEnvelope<RunLifecycleTransitionPayload> =>
  createEvent<RunLifecycleTransitionPayload>({
    eventId,
    sequence,
    domain: 'core-01',
    type: 'RunLifecycleTransitioned',
    payload: {
      from,
      to,
      reason: `transitioned to ${to}`,
      authority: 'system',
      sourceEventIds: ['evt-source'],
      terminal: to === 'completed' || to === 'failed' || to === 'canceled',
    },
  });

export const createRunCreatedEvent = (eventId = 'evt-created', sequence = 1): RunEventEnvelope =>
  createEvent({
    eventId,
    sequence,
    domain: 'core-01',
    type: 'RunCreated',
    payload: {
      idempotencyKey: 'idem-analyzer',
      requestedBy: 'runner',
    },
  });

export const createLivenessStateChangedEvent = (
  eventId: string,
  sequence: number,
  to: string,
  from = 'active',
): RunEventEnvelope =>
  createEvent({
    eventId,
    sequence,
    domain: 'core-04',
    type: 'LivenessStateChanged',
    payload: {
      from,
      to,
      state: to,
      reason: `${to}-reason`,
    },
  });

export const createLivenessTimerExpiredEvent = (eventId: string, sequence: number): RunEventEnvelope =>
  createEvent({
    eventId,
    sequence,
    domain: 'core-04',
    type: 'LivenessTimerExpired',
    payload: {
      reason: 'no-progress-timeout',
      timerId: 'no-progress',
    },
  });

export const createSupervisionLostEvent = (eventId: string, sequence: number): RunEventEnvelope =>
  createEvent({
    eventId,
    sequence,
    domain: 'core-04',
    type: 'SupervisionLost',
    durability: 'barrier',
    payload: {
      reason: 'termination-unproven',
    },
  });

export const createRecoveryEvent = (
  eventId: string,
  sequence: number,
  type: 'RecoveryClassified' | 'RecoveryActionPlanned' | 'RecoveryActionApplied' | 'ReconciliationBlocked',
): RunEventEnvelope =>
  createEvent({
    eventId,
    sequence,
    domain: 'core-06',
    type,
    payload: {
      reason: `${type}-reason`,
    },
  });

export const createUnknownEvent = (eventId: string, sequence: number): RunEventEnvelope =>
  createEvent({
    eventId,
    sequence,
    domain: 'edge-99',
    type: 'UnrelatedEventObserved',
    payload: {
      value: 'ignored',
    },
  });

export const runEventCursorFixture: RunEventCursor = {
  runId,
  afterSequence: 0,
};

export const createReplay = (overrides: Partial<RunReplay> = {}): RunReplay => ({
  runId,
  events: [createRunCreatedEvent()],
  lastSequence: overrides.events?.[overrides.events.length - 1]?.sequence ?? 1,
  writerEpoch: 3,
  health: 'ok',
  healthRecords: [],
  ...overrides,
});

export const createProjections = (overrides: Partial<RunProjections> = {}): RunProjections => ({
  state: {
    lifecycle: 'running',
    currentSequence: 1,
    writerEpoch: 3,
    degradedHealth: 'ok',
  },
  summary: {
    runId,
    taskId: 'task-123',
    status: 'running',
    ownerSessionId: 'session-123',
    artifactRefs: [],
    unknownEvents: [],
  },
  metrics: {
    eventCount: 1,
    retryCount: 0,
    parkedMs: 0,
    firstRecordedAt: baseTimestamp,
    lastRecordedAt: baseTimestamp,
  },
  launch: {
    linkage: 'known',
    linkHistory: [],
  },
  ...overrides,
});

export const createTrigger = (kind: AnalysisTriggerKind, eventRef?: EvidenceEventRef): AnalysisTrigger => ({
  kind,
  eventRef: eventRef ?? createEvidenceEventRef(createLifecycleTransitionEvent('evt-trigger', 50, 'completed')),
  reason: `${kind}-reason`,
});

export const createRequest = (overrides: Partial<AnalysisRequest> = {}): AnalysisRequest => ({
  runId,
  trigger: createTrigger('terminal-lifecycle'),
  evaluatedThrough: runEventCursorFixture,
  analyzedAt: '2026-06-23T12:30:00.000Z',
  analyzerVersion: 'analyzer-v1',
  ruleSetDigest: 'sha256:rules-v1',
  redactionPolicyDigest: 'sha256:redaction-v1',
  ...overrides,
});

export const createSnapshot = (overrides: Partial<AnalysisSnapshot> = {}): AnalysisSnapshot => ({
  replay: createReplay(),
  projections: createProjections(),
  redactedArtifacts: {
    primary: artifactRefFixture,
  },
  ...overrides,
});

export const isAnalysisFailure = (value: AnalysisResult | AnalysisFailure): value is AnalysisFailure =>
  'reason' in value;
