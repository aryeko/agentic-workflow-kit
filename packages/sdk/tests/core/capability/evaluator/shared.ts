import type {
  CapabilityGatePolicyDecision,
  CapabilityGateRequest,
  CapabilityGateScope,
  ProviderDomain,
} from '../../../../src/core/capability/evaluator/index.js';
import type { CapabilityAttestation, RunEventEnvelope, RunProjections, RunReplay } from '../../../../src/index.js';

export type GateScenario = {
  readonly request: CapabilityGateRequest;
  readonly replay: RunReplay;
  readonly projections: RunProjections;
};

export type RecordedEvidenceSupportKind = 'probe' | 'artifact-digest' | 'self-report' | 'schema-only' | 'feature-list';

type RecordedEvidencePayload = {
  readonly evidenceRef: string;
  readonly supportKind: RecordedEvidenceSupportKind;
  readonly value?: string;
};

type EventInput<TPayload> = {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: string;
  readonly payload: TPayload;
  readonly domain?: string;
  readonly durability?: 'durable' | 'barrier';
  readonly occurredAt?: string;
  readonly recordedAt?: string;
  readonly payloadDigest?: string;
};

export const runId = 'run-gate-evaluator-123';
export const evaluatedAt = '2026-06-23T12:00:00.000Z';
export const policyRef = 'policy:auto-merge';
export const forgeScope = 'repo:aryeko/workflow-kit/pr:42/head#abc123';
export const forgeApprovedParent = 'repo:aryeko/workflow-kit/pr:42';
export const workSourceScope = 'work-source:epic-3/task:core-02-s2-gate-evaluator';
export const forgeFreshnessKey = 'forge:pr-42';
export const workSourceFreshnessKey = 'work-source:core-02-s2';
export const defaultEvidenceRefs = ['evidence:forge-pr-head', 'evidence:verification'] as const;

export const createEvent = <TPayload>({
  eventId,
  sequence,
  type,
  payload,
  domain = 'core-02',
  durability = 'durable',
  occurredAt = evaluatedAt,
  recordedAt = evaluatedAt,
  payloadDigest = `sha256:${eventId}`,
}: EventInput<TPayload>): RunEventEnvelope<TPayload> => ({
  schema: 'kit-vnext.run-event.v1',
  runId,
  eventId,
  sequence,
  writerEpoch: 2,
  domain,
  type,
  durability,
  occurredAt,
  recordedAt,
  payloadDigest,
  payload,
});

export const createEvidenceEvent = (
  eventId: string,
  sequence: number,
  evidenceRef: string,
  overrides: Partial<RecordedEvidencePayload> = {},
): RunEventEnvelope<RecordedEvidencePayload> =>
  createEvent({
    eventId,
    sequence,
    domain: 'core-01',
    type: 'RecordedEvidence',
    payload: {
      evidenceRef,
      supportKind: 'probe',
      value: evidenceRef,
      ...overrides,
    },
  });

export const createAttestationEvent = (
  eventId: string,
  sequence: number,
  provider: ProviderDomain,
  capability: string,
  overrides: Partial<CapabilityAttestation<string>> = {},
): RunEventEnvelope<CapabilityAttestation<string>> =>
  createEvent({
    eventId,
    sequence,
    domain: provider,
    type: 'CapabilityAttestation',
    payload: {
      capability,
      probeMethod: 'live-smoke',
      result: 'positive',
      evidenceRef: defaultEvidenceRefs[0],
      scope: provider === 'Forge' ? forgeScope : workSourceScope,
      expiry: '2026-06-23T13:00:00.000Z',
      driverVersion: '1.2.3',
      platform: 'darwin-arm64',
      freshnessKey: provider === 'Forge' ? forgeFreshnessKey : workSourceFreshnessKey,
      at: '2026-06-23T11:00:00.000Z',
      ...overrides,
    },
  });

export const createScope = (overrides: Partial<CapabilityGateScope> = {}): CapabilityGateScope => ({
  runId,
  operationId: 'op-auto-merge',
  providerScopes: [
    {
      provider: 'Forge',
      scope: forgeScope,
      freshnessKey: forgeFreshnessKey,
      approvedParentScopes: [forgeApprovedParent],
    },
    {
      provider: 'Work Source',
      scope: workSourceScope,
      freshnessKey: workSourceFreshnessKey,
    },
  ],
  pullRequestRef: 'pr-42',
  expectedHeadSha: 'abc123',
  ...overrides,
});

export const createPolicyDecision = (
  overrides: Partial<CapabilityGatePolicyDecision> = {},
): CapabilityGatePolicyDecision => ({
  policyRef,
  permits: true,
  ...overrides,
});

export const createRequest = (overrides: Partial<CapabilityGateRequest> = {}): CapabilityGateRequest => ({
  gateId: 'gate-123',
  runId,
  capability: 'auto-merge',
  mode: 'assisted',
  scope: createScope(),
  policyRef,
  policyDecision: createPolicyDecision(),
  requestedByDomain: 'core-05',
  requestedAction: 'merge-pull-request',
  evaluatedAt,
  evidenceRefs: [...defaultEvidenceRefs],
  ...overrides,
});

export const createReplay = (overrides: Partial<RunReplay> = {}): RunReplay => ({
  runId,
  events: [],
  lastSequence: overrides.events?.[overrides.events.length - 1]?.sequence ?? 0,
  writerEpoch: 2,
  health: 'ok',
  healthRecords: [],
  ...overrides,
});

export const createProjections = (overrides: Partial<RunProjections> = {}): RunProjections => ({
  state: {
    lifecycle: 'running',
    currentSequence: 7,
    writerEpoch: 2,
    degradedHealth: 'ok',
  },
  summary: {
    runId,
    taskId: 'task-42',
    status: 'running',
    ownerSessionId: 'session-1',
    artifactRefs: [],
    unknownEvents: [],
  },
  metrics: {
    eventCount: 7,
    retryCount: 0,
    parkedMs: 0,
    firstRecordedAt: '2026-06-23T11:00:00.000Z',
    lastRecordedAt: evaluatedAt,
  },
  launch: {
    linkage: 'known',
    currentSession: {
      linkOrdinal: 1,
      sessionId: 'session-1',
      linkRole: 'primary',
      startedAt: '2026-06-23T11:00:00.000Z',
      sourceEventId: 'evt-session-linked',
    },
    linkHistory: [],
  },
  ...overrides,
});

export const createAllowAutoMergeScenario = (): GateScenario => {
  const replayEvents = [
    createEvidenceEvent('evt-evidence-head', 1, defaultEvidenceRefs[0], { value: 'abc123' }),
    createEvidenceEvent('evt-evidence-verify', 2, defaultEvidenceRefs[1], { value: 'verified' }),
    createAttestationEvent('evt-forge-inspect', 3, 'Forge', 'canInspectProtection'),
    createAttestationEvent('evt-forge-rulesets', 4, 'Forge', 'supportsRulesets'),
    createAttestationEvent('evt-forge-merge-queue', 5, 'Forge', 'supportsMergeQueue', {
      evidenceRef: defaultEvidenceRefs[1],
    }),
    createAttestationEvent('evt-work-source-status', 6, 'Work Source', 'supportsStatusWrite', {
      evidenceRef: defaultEvidenceRefs[1],
    }),
  ];

  return {
    request: createRequest(),
    replay: createReplay({
      events: replayEvents,
      lastSequence: replayEvents[replayEvents.length - 1]?.sequence ?? 0,
    }),
    projections: createProjections(),
  };
};

export const createScenario = (overrides: Partial<GateScenario> = {}): GateScenario => {
  const base = createAllowAutoMergeScenario();

  return {
    request: overrides.request ?? base.request,
    replay: overrides.replay ?? base.replay,
    projections: overrides.projections ?? base.projections,
  };
};

export const assertNever = (_value: never): never => {
  throw new Error('unreachable');
};
