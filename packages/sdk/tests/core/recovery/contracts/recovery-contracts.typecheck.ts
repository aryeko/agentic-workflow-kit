import type {
  RecoveryClassification,
  RecoveryCoordinator,
  RecoveryEvidenceSnapshot,
  RecoveryPlan,
  RecoveryPlanInput,
  RecoveryProjection,
  RecoveryRecordInput,
} from '../../../../src/index.js';

import {
  evidenceEventRefFixture,
  gateRecordFixture,
  gateRequestFixture,
  leaseSnapshotFixture,
  runEventCursorFixture,
  runLaunchProjectionFixture,
  runStateProjectionFixture,
} from './shared.js';

const classification: RecoveryClassification = {
  state: 'owned-worker-stale-terminable',
  actionSafety: 'auto-safe',
  recommendedAction: 'request-termination',
  reason: 'worker is stale and termination evidence is available',
  requiredGate: 'auto-recover',
  evidenceRefs: [evidenceEventRefFixture],
};

const snapshot: RecoveryEvidenceSnapshot = {
  runId: 'run-recovery-01',
  evaluatedThrough: runEventCursorFixture,
  observedAt: '2026-06-27T10:10:00.000Z',
  state: runStateProjectionFixture,
  launch: runLaunchProjectionFixture,
  leases: {
    runWriter: { ...leaseSnapshotFixture, name: 'run-writer:run-recovery-01' },
    storyLaunch: leaseSnapshotFixture,
    leaseHealth: 'ok',
  },
  evidenceRefs: [evidenceEventRefFixture],
  providerGaps: [],
  completion: {
    latestDecisionState: 'completion-verified',
    latestMergeState: 'merge-ready',
    postMergeOutcome: 'post-merge-confirmed',
  },
  ownership: {
    ownerState: 'owned',
    sessionId: 'session-owned-01',
    workerHandleId: 'worker-01',
    canResumeOwned: true,
    resumeEvidenceRef: evidenceEventRefFixture,
  },
  termination: {
    state: 'confirmed',
    evidenceRefs: [evidenceEventRefFixture],
    proofRef: 'artifact://termination-proof',
    containmentEmpty: true,
    terminatedAt: '2026-06-27T10:09:00.000Z',
  },
  approval: {
    state: 'none',
    evidenceRefs: [],
  },
  workSource: {
    claimState: 'released',
    evidenceRefs: [evidenceEventRefFixture],
  },
  process: {
    state: 'empty',
    evidenceRefs: [evidenceEventRefFixture],
  },
  manualEditRefs: [],
};

const planInput: RecoveryPlanInput = {
  runId: snapshot.runId,
  mode: 'assisted',
  policyRef: 'policy:recover',
  requestedAction: 'request-termination',
  scope: gateRequestFixture.scope,
  evaluatedThrough: snapshot.evaluatedThrough,
};

const plan: RecoveryPlan = {
  planId: 'plan-recovery-01',
  classification,
  selectedAction: 'request-termination',
  requiresGate: gateRequestFixture,
  lifecycleTarget: 'running',
  providerControl: 'host-terminate',
  sourceEventIds: ['evt-recovery-classified-01'],
};

const recordInput: RecoveryRecordInput = {
  runId: snapshot.runId,
  plan,
  appliedControl: {
    kind: 'host-terminate',
    evidenceRefs: [evidenceEventRefFixture],
  },
  outcome: 'applied',
  gateRef: gateRecordFixture,
  evaluatedThrough: snapshot.evaluatedThrough,
  sourceEventIds: ['evt-recovery-classified-01', 'evt-recovery-plan-01'],
};

const projection: RecoveryProjection = {
  runId: snapshot.runId,
  latestClassification: {
    schema: 'kit-vnext.recovery-classified.v1',
    runId: snapshot.runId,
    recoveryState: classification.state,
    actionSafety: classification.actionSafety,
    recommendedAction: classification.recommendedAction,
    classifierRuleVersion: 'recovery-rule-v1',
    cursor: snapshot.evaluatedThrough,
    evidenceRefs: [evidenceEventRefFixture],
    classifiedAt: snapshot.observedAt,
  },
  activeStoryLaunchLease: {
    schema: 'kit-vnext.story-launch-lease-acquired.v1',
    runId: snapshot.runId,
    storyLaunchKey: leaseSnapshotFixture.name,
    leaseEpoch: leaseSnapshotFixture.epoch,
    acquiredAt: '2026-06-27T10:01:00.000Z',
    sourceEventIds: ['evt-run-created-01'],
  },
  duplicateLaunch: {
    schema: 'kit-vnext.duplicate-launch-blocked.v1',
    runId: snapshot.runId,
    storyLaunchKey: leaseSnapshotFixture.name,
    incumbentLeaseEpoch: leaseSnapshotFixture.epoch,
    blockedAt: '2026-06-27T10:02:00.000Z',
    sourceEventIds: ['evt-run-created-01'],
  },
  latestPlan: {
    schema: 'kit-vnext.recovery-action-planned.v1',
    runId: snapshot.runId,
    planId: plan.planId,
    selectedAction: plan.selectedAction,
    requiredGate: 'auto-recover',
    lifecycleTarget: plan.lifecycleTarget,
    providerControl: plan.providerControl,
    plannedAt: '2026-06-27T10:11:00.000Z',
    sourceEventIds: plan.sourceEventIds,
  },
  parked: false,
};

const coordinator: RecoveryCoordinator = {
  classify: () => classification,
  plan: () => plan,
  record: () => ({
    runId: snapshot.runId,
    firstSequence: 65,
    lastSequence: 66,
    writerEpoch: 3,
    durability: 'barrier',
    eventIds: ['evt-recovery-plan-01'],
    payloadDigests: ['sha256:recovery-plan-01'],
    frameDigest: 'sha256:frame-01',
    health: 'ok',
  }),
};

void coordinator;
void planInput;
void projection;
void recordInput;
void snapshot;
