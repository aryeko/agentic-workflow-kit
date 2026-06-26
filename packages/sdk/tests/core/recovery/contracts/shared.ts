import type {
  CapabilityGateRecordPayload,
  CapabilityGateRequest,
  EvidenceEventRef,
  LeaseSnapshot,
  RunEventCursor,
  RunLaunchProjection,
  RunStateProjection,
} from '../../../../src/index.js';

export const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${String(value)}`);
};

export const expectedRecoveryStates = [
  'clean-terminal',
  'owned-session-resumable',
  'evidence-refresh-retryable',
  'owned-worker-stale-terminable',
  'safe-empty-restartable',
  'stale-launch-clearable',
  'operator-approval-needed',
  'lease-unavailable',
  'log-unwritable',
  'log-corrupt',
  'launch-duplicate-active',
  'owner-ambiguous',
  'termination-ambiguous',
  'supervision-stale-ambiguous',
  'merge-outcome-ambiguous',
  'provider-evidence-gap',
  'manual-edits-forbidden',
  'terminal-no-recovery',
] as const;

export const expectedActionSafetyClasses = ['auto-safe', 'operator-required', 'forbidden'] as const;

export const expectedRecoveryActions = [
  'none',
  'resume-owned-session',
  'retry-evidence-refresh',
  'request-termination',
  'restart-from-cleared-state',
  'clear-stale-launch',
  'park-for-operator',
  'block-run',
  'fail-run',
] as const;

export const expectedProviderControlKinds = [
  'agent-resume',
  'host-terminate',
  'forge-refresh',
  'work-source-release',
] as const;

export const runEventCursorFixture: RunEventCursor = {
  runId: 'run-recovery-01',
  afterSequence: 64,
};

export const evidenceEventRefFixture: EvidenceEventRef = {
  eventId: 'evt-evidence-01',
  sequence: 64,
  payloadDigest: 'sha256:evidence-01',
  type: 'RecoveryEvidenceRecorded',
};

export const runStateProjectionFixture: RunStateProjection = {
  lifecycle: 'running',
  currentSequence: 64,
  writerEpoch: 3,
  degradedHealth: 'ok',
};

export const runLaunchProjectionFixture: RunLaunchProjection = {
  linkage: 'known',
  currentSession: {
    linkOrdinal: 1,
    sessionId: 'session-owned-01',
    linkRole: 'primary',
    startedAt: '2026-06-27T10:00:00.000Z',
    sourceEventId: 'evt-session-linked-01',
  },
  linkHistory: [],
};

export const leaseSnapshotFixture: LeaseSnapshot = {
  name: 'story-launch:ws-01:track-01:task-01',
  epoch: 5,
  holder: 'run-recovery-01',
  tokenDigest: 'sha256:lease-token-01',
  expiresAt: new globalThis.Date('2026-06-27T11:00:00.000Z'),
};

export const gateRequestFixture: CapabilityGateRequest = {
  gateId: 'gate-auto-recover-01',
  runId: 'run-recovery-01',
  capability: 'auto-recover',
  mode: 'assisted',
  scope: {
    runId: 'run-recovery-01',
    operationId: 'recovery-plan-01',
    providerScopes: [
      {
        provider: 'Execution Host',
        scope: 'worker:termination',
        freshnessKey: 'host:termination:run-recovery-01',
      },
    ],
  },
  policyRef: 'policy:recover',
  policyDecision: {
    policyRef: 'policy:recover',
    permits: true,
  },
  requestedByDomain: 'core-06',
  requestedAction: 'request-termination',
  evaluatedAt: '2026-06-27T10:05:00.000Z',
  evidenceRefs: ['artifact://recovery-gate'],
};

export const gateRecordFixture: CapabilityGateRecordPayload = {
  schema: 'kit-vnext.capability-gate-record.v1',
  gateId: gateRequestFixture.gateId,
  capability: gateRequestFixture.capability,
  decision: 'allow',
  mode: gateRequestFixture.mode,
  scope: gateRequestFixture.scope,
  policyRef: gateRequestFixture.policyRef,
  requestedByDomain: gateRequestFixture.requestedByDomain,
  requestedAction: gateRequestFixture.requestedAction,
  evaluatedAt: gateRequestFixture.evaluatedAt,
  evaluatedGuarantees: [],
  attestationRefs: [],
  evidenceRefs: gateRequestFixture.evidenceRefs,
};
