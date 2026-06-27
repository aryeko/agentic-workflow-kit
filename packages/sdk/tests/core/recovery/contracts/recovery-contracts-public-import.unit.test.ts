import { ACTION_SAFETY_CLASSES, PROVIDER_CONTROL_KINDS, RECOVERY_ACTIONS, RECOVERY_STATES } from 'sdk';
import type * as sdk from 'sdk';
import { describe, expect, it } from 'vitest';

import {
  evidenceEventRefFixture,
  gateRecordFixture,
  gateRequestFixture,
  leaseSnapshotFixture,
  runEventCursorFixture,
  runLaunchProjectionFixture,
  runStateProjectionFixture,
} from './shared.js';

describe('core-06-s1 public sdk recovery imports', () => {
  it('imports the full recovery contract surface from the sdk entrypoint', () => {
    const recoveryState: sdk.RecoveryState = 'stale-launch-clearable';
    const actionSafety: sdk.ActionSafetyClass = 'auto-safe';
    const recoveryAction: sdk.RecoveryAction = 'clear-stale-launch';
    const providerControl: sdk.ProviderControlKind = 'work-source-release';
    const snapshot: sdk.RecoveryEvidenceSnapshot = {
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
    };
    const classification: sdk.RecoveryClassification = {
      state: recoveryState,
      actionSafety,
      recommendedAction: recoveryAction,
      reason: 'expired launch can be cleared',
      requiredGate: 'auto-recover',
      evidenceRefs: [evidenceEventRefFixture],
    };
    const planInput: sdk.RecoveryPlanInput = {
      runId: snapshot.runId,
      mode: 'assisted',
      policyRef: 'policy:recover',
      requestedAction: recoveryAction,
      scope: gateRequestFixture.scope,
      evaluatedThrough: snapshot.evaluatedThrough,
    };
    const plan: sdk.RecoveryPlan = {
      planId: 'plan-recovery-01',
      classification,
      selectedAction: recoveryAction,
      requiresGate: gateRequestFixture,
      providerControl,
      sourceEventIds: ['evt-recovery-classified-01'],
    };
    const recordInput: sdk.RecoveryRecordInput = {
      runId: snapshot.runId,
      plan,
      appliedControl: {
        kind: providerControl,
        evidenceRefs: [evidenceEventRefFixture],
      },
      outcome: 'applied',
      gateRef: gateRecordFixture,
      evaluatedThrough: snapshot.evaluatedThrough,
      sourceEventIds: ['evt-recovery-classified-01', 'evt-recovery-plan-01'],
    };
    const acquired: sdk.StoryLaunchLeaseAcquiredPayload = {
      schema: 'kit-vnext.story-launch-lease-acquired.v1',
      runId: snapshot.runId,
      storyLaunchKey: leaseSnapshotFixture.name,
      leaseEpoch: leaseSnapshotFixture.epoch,
      acquiredAt: '2026-06-27T10:01:00.000Z',
      sourceEventIds: ['evt-run-created-01'],
    };
    const duplicate: sdk.DuplicateLaunchBlockedPayload = {
      schema: 'kit-vnext.duplicate-launch-blocked.v1',
      runId: snapshot.runId,
      storyLaunchKey: acquired.storyLaunchKey,
      incumbentLeaseEpoch: leaseSnapshotFixture.epoch,
      blockedAt: '2026-06-27T10:02:00.000Z',
      sourceEventIds: ['evt-run-created-01'],
    };
    const classified: sdk.RecoveryClassifiedPayload = {
      schema: 'kit-vnext.recovery-classified.v1',
      runId: snapshot.runId,
      recoveryState,
      actionSafety,
      recommendedAction: recoveryAction,
      classifierRuleVersion: 'recovery-rule-v1',
      cursor: runEventCursorFixture,
      evidenceRefs: [evidenceEventRefFixture],
      classifiedAt: '2026-06-27T10:03:00.000Z',
    };
    const planned: sdk.RecoveryActionPlannedPayload = {
      schema: 'kit-vnext.recovery-action-planned.v1',
      runId: snapshot.runId,
      planId: plan.planId,
      selectedAction: recoveryAction,
      requiredGate: 'auto-recover',
      providerControl,
      plannedAt: '2026-06-27T10:04:00.000Z',
      sourceEventIds: ['evt-recovery-classified-01'],
    };
    const applied: sdk.RecoveryActionAppliedPayload = {
      schema: 'kit-vnext.recovery-action-applied.v1',
      runId: snapshot.runId,
      planId: plan.planId,
      appliedControl: 'host-terminate',
      gateRef: gateRecordFixture,
      appliedEvidenceRefs: [evidenceEventRefFixture],
      appliedAt: '2026-06-27T10:05:00.000Z',
      sourceEventIds: ['evt-recovery-plan-01'],
    };
    const requested: sdk.StaleLaunchClearanceRequestedPayload = {
      schema: 'kit-vnext.stale-launch-clearance-requested.v1',
      runId: snapshot.runId,
      storyLaunchKey: acquired.storyLaunchKey,
      expiredLeaseEpoch: leaseSnapshotFixture.epoch,
      nextLeaseEpoch: leaseSnapshotFixture.epoch + 1,
      requestedAt: '2026-06-27T10:06:00.000Z',
      evidenceRefs: [evidenceEventRefFixture],
    };
    const cleared: sdk.StoryLaunchLeaseClearedPayload = {
      schema: 'kit-vnext.story-launch-lease-cleared.v1',
      runId: snapshot.runId,
      storyLaunchKey: acquired.storyLaunchKey,
      clearedLeaseEpoch: requested.nextLeaseEpoch,
      clearedAt: '2026-06-27T10:07:00.000Z',
      sourceEventIds: ['evt-clear-request-01'],
    };
    const blocked: sdk.ReconciliationBlockedPayload = {
      schema: 'kit-vnext.reconciliation-blocked.v1',
      runId: snapshot.runId,
      recoveryState: 'provider-evidence-gap',
      parkedReason: 'provider evidence is incomplete',
      severity: 'operator-attention',
      evidenceRefs: [evidenceEventRefFixture],
      cursor: runEventCursorFixture,
      blockedAt: '2026-06-27T10:08:00.000Z',
    };
    const projection: sdk.RecoveryProjection = {
      runId: snapshot.runId,
      latestClassification: classified,
      activeStoryLaunchLease: acquired,
      duplicateLaunch: duplicate,
      latestPlan: planned,
      parked: true,
    };
    const coordinator: sdk.RecoveryCoordinator = {
      classify: () => classification,
      plan: () => plan,
      record: () => ({
        runId: snapshot.runId,
        firstSequence: 65,
        lastSequence: 66,
        writerEpoch: 3,
        durability: 'barrier',
        eventIds: ['evt-recovery-record-01'],
        payloadDigests: ['sha256:recovery-record-01'],
        frameDigest: 'sha256:frame-01',
        health: 'ok',
      }),
    };

    expect(RECOVERY_STATES).toContain(recoveryState);
    expect(ACTION_SAFETY_CLASSES).toContain(actionSafety);
    expect(RECOVERY_ACTIONS).toContain(recoveryAction);
    expect(PROVIDER_CONTROL_KINDS).toContain(providerControl);
    expect(recordInput.appliedControl?.kind).toBe('work-source-release');
    expect(applied.appliedControl).toBe('host-terminate');
    expect(blocked.severity).toBe('operator-attention');
    expect(cleared.clearedLeaseEpoch).toBe(6);
    expect(projection.parked).toBe(true);
    expect(coordinator.plan(planInput, classification).planId).toBe('plan-recovery-01');
  });
});
