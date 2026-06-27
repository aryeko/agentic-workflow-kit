import type {
  DuplicateLaunchBlockedPayload,
  RecoveryAction,
  RecoveryActionPlannedPayload,
  RecoveryClassifiedPayload,
  ReconciliationBlockedPayload,
  RunEventCursor,
  RunEventEnvelope,
  StoryLaunchLeaseAcquiredPayload,
  StoryLaunchLeaseClearedPayload,
} from '../../../../src/index.js';

export const runIdFixture = 'run-recovery-projection-01';
export const cursorFixture: RunEventCursor = {
  runId: runIdFixture,
  afterSequence: 29,
};

export const evidenceRefFixture = {
  eventId: 'evt-evidence-01',
  sequence: 29,
  payloadDigest: 'sha256:evidence-01',
  type: 'RecoveryEvidenceRecorded',
} as const;

export const createEvent = <TPayload>(input: {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: string;
  readonly payload: TPayload;
  readonly occurredAt?: string;
}): RunEventEnvelope<TPayload> => ({
  schema: 'kit-vnext.run-event.v1',
  runId: runIdFixture,
  eventId: input.eventId,
  sequence: input.sequence,
  writerEpoch: 3,
  domain: 'core-06',
  type: input.type,
  durability: 'barrier',
  occurredAt: input.occurredAt ?? `2026-06-27T14:${String(input.sequence).padStart(2, '0')}:00.000Z`,
  recordedAt: input.occurredAt ?? `2026-06-27T14:${String(input.sequence).padStart(2, '0')}:00.000Z`,
  payloadDigest: `sha256:${input.eventId}`,
  payload: input.payload,
});

export const leaseAcquiredPayloadFixture = (epoch = 5): StoryLaunchLeaseAcquiredPayload => ({
  schema: 'kit-vnext.story-launch-lease-acquired.v1',
  runId: runIdFixture,
  storyLaunchKey: 'story-launch:ws-01:track-01:task-01',
  leaseEpoch: epoch,
  acquiredAt: '2026-06-27T14:01:00.000Z',
  sourceEventIds: ['evt-run-created-01'],
});

export const duplicateLaunchPayloadFixture = (epoch = 5): DuplicateLaunchBlockedPayload => ({
  schema: 'kit-vnext.duplicate-launch-blocked.v1',
  runId: runIdFixture,
  storyLaunchKey: leaseAcquiredPayloadFixture(epoch).storyLaunchKey,
  incumbentLeaseEpoch: epoch,
  blockedAt: '2026-06-27T14:02:00.000Z',
  sourceEventIds: ['evt-run-created-01'],
});

export const classifiedPayloadFixture = (
  recoveryState: RecoveryClassifiedPayload['recoveryState'],
  recommendedAction: RecoveryAction,
): RecoveryClassifiedPayload => ({
  schema: 'kit-vnext.recovery-classified.v1',
  runId: runIdFixture,
  recoveryState,
  actionSafety: 'operator-required',
  recommendedAction,
  classifierRuleVersion: 'recovery-rule-v1',
  cursor: cursorFixture,
  evidenceRefs: [evidenceRefFixture],
  classifiedAt: '2026-06-27T14:03:00.000Z',
});

export const plannedPayloadFixture = (
  planId: string,
  selectedAction: RecoveryAction,
): RecoveryActionPlannedPayload => ({
  schema: 'kit-vnext.recovery-action-planned.v1',
  runId: runIdFixture,
  planId,
  selectedAction,
  requiredGate: 'auto-recover',
  plannedAt: '2026-06-27T14:04:00.000Z',
  sourceEventIds: ['evt-recovery-classified-01'],
});

export const blockedPayloadFixture = (): ReconciliationBlockedPayload => ({
  schema: 'kit-vnext.reconciliation-blocked.v1',
  runId: runIdFixture,
  recoveryState: 'operator-approval-needed',
  parkedReason: 'operator approval is required before recovery can continue',
  severity: 'operator-attention',
  evidenceRefs: [evidenceRefFixture],
  cursor: cursorFixture,
  blockedAt: '2026-06-27T14:05:00.000Z',
});

export const clearedPayloadFixture = (epoch = 5): StoryLaunchLeaseClearedPayload => ({
  schema: 'kit-vnext.story-launch-lease-cleared.v1',
  runId: runIdFixture,
  storyLaunchKey: leaseAcquiredPayloadFixture(epoch).storyLaunchKey,
  clearedLeaseEpoch: epoch,
  clearedAt: '2026-06-27T14:06:00.000Z',
  sourceEventIds: ['evt-recovery-plan-01'],
});
