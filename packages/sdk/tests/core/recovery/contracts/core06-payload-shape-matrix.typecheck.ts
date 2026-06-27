import type {
  DuplicateLaunchBlockedPayload,
  ReconciliationBlockedPayload,
  RecoveryActionAppliedPayload,
  RecoveryActionPlannedPayload,
  RecoveryClassifiedPayload,
  StaleLaunchClearanceRequestedPayload,
  StoryLaunchLeaseAcquiredPayload,
  StoryLaunchLeaseClearedPayload,
} from '../../../../src/index.js';

import { evidenceEventRefFixture, gateRecordFixture, runEventCursorFixture } from './shared.js';

const acquired: StoryLaunchLeaseAcquiredPayload = {
  schema: 'kit-vnext.story-launch-lease-acquired.v1',
  runId: 'run-recovery-01',
  storyLaunchKey: 'story-launch:ws-01:track-01:task-01',
  leaseEpoch: 5,
  acquiredAt: '2026-06-27T10:01:00.000Z',
  sourceEventIds: ['evt-run-created-01'],
};

const duplicate: DuplicateLaunchBlockedPayload = {
  schema: 'kit-vnext.duplicate-launch-blocked.v1',
  runId: 'run-recovery-01',
  storyLaunchKey: acquired.storyLaunchKey,
  incumbentLeaseEpoch: 5,
  blockedAt: '2026-06-27T10:02:00.000Z',
  sourceEventIds: ['evt-run-created-01'],
};

const classified: RecoveryClassifiedPayload = {
  schema: 'kit-vnext.recovery-classified.v1',
  runId: 'run-recovery-01',
  recoveryState: 'stale-launch-clearable',
  actionSafety: 'auto-safe',
  recommendedAction: 'clear-stale-launch',
  classifierRuleVersion: 'recovery-rule-v1',
  cursor: runEventCursorFixture,
  evidenceRefs: [evidenceEventRefFixture],
  classifiedAt: '2026-06-27T10:03:00.000Z',
};

const planned: RecoveryActionPlannedPayload = {
  schema: 'kit-vnext.recovery-action-planned.v1',
  runId: 'run-recovery-01',
  planId: 'plan-recovery-01',
  selectedAction: 'clear-stale-launch',
  requiredGate: 'auto-recover',
  providerControl: 'work-source-release',
  plannedAt: '2026-06-27T10:04:00.000Z',
  sourceEventIds: ['evt-recovery-classified-01'],
};

const applied: RecoveryActionAppliedPayload = {
  schema: 'kit-vnext.recovery-action-applied.v1',
  runId: 'run-recovery-01',
  planId: planned.planId,
  appliedControl: 'host-terminate',
  gateRef: gateRecordFixture,
  appliedEvidenceRefs: [evidenceEventRefFixture],
  appliedAt: '2026-06-27T10:05:00.000Z',
  sourceEventIds: ['evt-recovery-plan-01'],
};

const requested: StaleLaunchClearanceRequestedPayload = {
  schema: 'kit-vnext.stale-launch-clearance-requested.v1',
  runId: 'run-recovery-01',
  storyLaunchKey: acquired.storyLaunchKey,
  expiredLeaseEpoch: 5,
  nextLeaseEpoch: 6,
  requestedAt: '2026-06-27T10:06:00.000Z',
  evidenceRefs: [evidenceEventRefFixture],
};

const cleared: StoryLaunchLeaseClearedPayload = {
  schema: 'kit-vnext.story-launch-lease-cleared.v1',
  runId: 'run-recovery-01',
  storyLaunchKey: acquired.storyLaunchKey,
  clearedLeaseEpoch: 6,
  clearedAt: '2026-06-27T10:07:00.000Z',
  sourceEventIds: ['evt-clear-request-01'],
};

const blocked: ReconciliationBlockedPayload = {
  schema: 'kit-vnext.reconciliation-blocked.v1',
  runId: 'run-recovery-01',
  recoveryState: 'provider-evidence-gap',
  parkedReason: 'provider evidence is incomplete',
  severity: 'operator-attention',
  evidenceRefs: [evidenceEventRefFixture],
  cursor: runEventCursorFixture,
  blockedAt: '2026-06-27T10:08:00.000Z',
};

const invalidClassifiedPayload: RecoveryClassifiedPayload = {
  ...classified,
  // @ts-expect-error RecoveryClassifiedPayload does not carry leaseEpoch.
  leaseEpoch: 9,
};

void acquired;
void applied;
void blocked;
void cleared;
void classified;
void duplicate;
void invalidClassifiedPayload;
void planned;
void requested;
