import type { RecoveryEvidenceSnapshot, RecoveryPlanInput } from '../../../../src/index.js';

export const observedAt = '2026-06-27T10:10:00.000Z';

export const evidenceEventRefFixture = {
  eventId: 'evt-evidence-01',
  sequence: 64,
  payloadDigest: 'sha256:evidence-01',
  type: 'RecoveryEvidenceRecorded',
} as const;

export const createLeaseSnapshot = (
  overrides: Partial<{ name: string; holder: string; expiresAt: string; epoch: number }> = {},
) => ({
  name: overrides.name ?? 'story-launch:ws-01:track-01:task-01',
  epoch: overrides.epoch ?? 5,
  holder: overrides.holder ?? 'run-recovery-01',
  tokenDigest: 'sha256:lease-token-01',
  expiresAt: new globalThis.Date(overrides.expiresAt ?? '2026-06-27T09:55:00.000Z'),
});

export const createSnapshot = (overrides: Partial<RecoveryEvidenceSnapshot> = {}): RecoveryEvidenceSnapshot => ({
  runId: 'run-recovery-01',
  evaluatedThrough: { runId: 'run-recovery-01', afterSequence: 64 },
  observedAt,
  state: {
    lifecycle: 'running',
    currentSequence: 64,
    writerEpoch: 3,
    degradedHealth: 'ok',
  },
  launch: {
    linkage: 'known',
    linkHistory: [],
  },
  leases: {
    leaseHealth: 'ok',
  },
  evidenceRefs: [evidenceEventRefFixture],
  providerGaps: [],
  ownership: { ownerState: 'none' },
  termination: { state: 'none', evidenceRefs: [], containmentEmpty: true },
  approval: { state: 'none', evidenceRefs: [] },
  workSource: { claimState: 'released', evidenceRefs: [] },
  process: { state: 'empty', evidenceRefs: [] },
  manualEditRefs: [],
  ...overrides,
});

export const createPlanInput = (snapshot: RecoveryEvidenceSnapshot): RecoveryPlanInput => ({
  runId: snapshot.runId,
  mode: 'assisted',
  policyRef: 'policy:auto-recover',
  requestedAction: 'restart-from-cleared-state',
  scope: {
    runId: snapshot.runId,
    operationId: 'recovery-plan-01',
    providerScopes: [
      {
        provider: 'Execution Host',
        scope: 'worker:termination',
        freshnessKey: 'host:termination:run-recovery-01',
      },
    ],
  },
  evaluatedThrough: snapshot.evaluatedThrough,
});
