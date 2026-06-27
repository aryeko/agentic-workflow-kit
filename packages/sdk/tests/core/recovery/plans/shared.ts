import type {
  CapabilityGateRecordPayload,
  EvidenceEventRef,
  RecoveryClassification,
  RecoveryClassifiedPayload,
  RecoveryEvidenceSnapshot,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
  StaleLaunchClearanceRequestedPayload,
} from '../../../../src/index.js';
import { createRecoveryClassifiedPayload } from '../../../../src/core/recovery/classifier/index.js';
import type { PlanRecoveryActionInput, RecoveryCommittedPlan } from '../../../../src/core/recovery/plans/index.js';

export const runIdFixture = 'run-recovery-plan-01';
export const plannedAtFixture = '2026-06-27T13:00:00.000Z';
export const appliedAtFixture = '2026-06-27T13:05:00.000Z';

export const evidenceRefFixture: EvidenceEventRef = {
  eventId: 'evt-evidence-01',
  sequence: 51,
  payloadDigest: 'sha256:evidence-01',
  type: 'RecoveryEvidenceRecorded',
};

export const clearanceRequestEventIdFixture = 'evt-clearance-request-01';

export const classificationFixture = (overrides: Partial<RecoveryClassification> = {}): RecoveryClassification => ({
  state: 'safe-empty-restartable',
  actionSafety: 'auto-safe',
  recommendedAction: 'restart-from-cleared-state',
  reason: 'restart is safe from a cleared state',
  requiredGate: 'auto-recover',
  evidenceRefs: [evidenceRefFixture],
  ...overrides,
});

export const recoverySnapshotFixture: RecoveryEvidenceSnapshot = {
  runId: runIdFixture,
  evaluatedThrough: {
    runId: runIdFixture,
    afterSequence: 51,
  },
  observedAt: '2026-06-27T12:55:00.000Z',
  state: {
    lifecycle: 'settling',
    currentSequence: 51,
    writerEpoch: 4,
    degradedHealth: 'ok',
  },
  launch: {
    linkage: 'known',
    linkHistory: [],
  },
  leases: {
    leaseHealth: 'ok',
  },
  evidenceRefs: [evidenceRefFixture],
  providerGaps: [],
  ownership: {
    ownerState: 'none',
  },
  termination: {
    state: 'none',
    evidenceRefs: [],
    containmentEmpty: true,
  },
  approval: {
    state: 'none',
    evidenceRefs: [],
  },
  workSource: {
    claimState: 'released',
    evidenceRefs: [],
  },
  process: {
    state: 'empty',
    evidenceRefs: [],
  },
  manualEditRefs: [],
};

export const recoveryClassifiedPayloadFixture = (
  classification: RecoveryClassification = classificationFixture(),
): RecoveryClassifiedPayload =>
  createRecoveryClassifiedPayload(recoverySnapshotFixture, classification, '2026-06-27T12:58:00.000Z');

export const planInputFixture = (overrides: Partial<PlanRecoveryActionInput> = {}): PlanRecoveryActionInput => ({
  runId: runIdFixture,
  mode: 'assisted',
  policyRef: 'policy:auto-recover',
  requestedAction: 'restart-from-cleared-state',
  scope: {
    runId: runIdFixture,
    operationId: 'recovery-plan-01',
    providerScopes: [
      {
        provider: 'Work Source',
        scope: 'claim:release',
        freshnessKey: 'work-source:claim:run-recovery-plan-01',
      },
    ],
  },
  evaluatedThrough: recoverySnapshotFixture.evaluatedThrough,
  plannedAt: plannedAtFixture,
  ...overrides,
});

export const gateRecordFixture = (
  overrides: Partial<CapabilityGateRecordPayload> = {},
): CapabilityGateRecordPayload => ({
  schema: 'kit-vnext.capability-gate-record.v1',
  gateId: 'gate:auto-recover:01',
  capability: 'auto-recover',
  decision: 'allow',
  mode: 'assisted',
  scope: planInputFixture().scope,
  policyRef: 'policy:auto-recover',
  requestedByDomain: 'core-06',
  requestedAction: 'restart-from-cleared-state',
  evaluatedAt: plannedAtFixture,
  evaluatedGuarantees: [],
  attestationRefs: [],
  evidenceRefs: [evidenceRefFixture.eventId],
  ...overrides,
});

export const staleLaunchRequestFixture = (
  overrides: Partial<StaleLaunchClearanceRequestedPayload> = {},
): StaleLaunchClearanceRequestedPayload => ({
  schema: 'kit-vnext.stale-launch-clearance-requested.v1',
  runId: runIdFixture,
  storyLaunchKey: 'story-launch:ws-01:track-01:task-01',
  expiredLeaseEpoch: 4,
  nextLeaseEpoch: 5,
  requestedAt: '2026-06-27T12:59:00.000Z',
  evidenceRefs: [evidenceRefFixture],
  ...overrides,
});

export const storyLaunchLeaseFixture = (epoch = 5) => ({
  name: 'story-launch:ws-01:track-01:task-01',
  epoch,
  holder: 'run-recovery-plan-01',
  tokenDigest: 'sha256:lease-token-01',
  expiresAt: new globalThis.Date('2026-06-27T13:30:00.000Z'),
});

export const appendFailureFixture: RunAppendFailure = {
  code: 'event-log-unavailable',
  message: 'event log unavailable',
  retryable: true,
};

const appendReceipt = (callIndex: number): RunAppendReceipt => ({
  runId: runIdFixture,
  firstSequence: 60 + callIndex,
  lastSequence: 60 + callIndex,
  writerEpoch: 4,
  durability: 'barrier',
  eventIds: [`evt-core-06-${String(callIndex).padStart(2, '0')}`],
  payloadDigests: [`sha256:core-06-${callIndex}`],
  frameDigest: `sha256:frame-${callIndex}`,
  health: 'ok',
});

export const createWriterHarness = (options?: { readonly failAt?: number }) => {
  const appendCalls: Array<readonly unknown[]> = [];

  const writer: RunWriter = {
    append(batch) {
      appendCalls.push(batch);
      const callIndex = appendCalls.length;
      if (options?.failAt === callIndex) {
        return { ok: false, error: appendFailureFixture };
      }
      return { ok: true, value: appendReceipt(callIndex) };
    },
    renew() {
      return { ok: true, value: writer };
    },
  };

  return { writer, appendCalls };
};

export const expectSingleIntent = <TPayload>(appendCalls: Array<readonly unknown[]>, callIndex: number) =>
  appendCalls[callIndex]?.[0] as {
    readonly domain: string;
    readonly type: string;
    readonly durability: string;
    readonly payload: TPayload;
    readonly occurredAt: string;
  };

export const committedPlanFixture = (plan: RecoveryCommittedPlan): RecoveryCommittedPlan => plan;
