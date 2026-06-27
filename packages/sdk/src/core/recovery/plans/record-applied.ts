import type { RecoveryActionAppliedPayload, StoryLaunchLeaseClearedPayload } from '../contracts/index.js';

import { hasMatchingAutoRecoverGate } from './gates.js';
import { appendRecoveryBarrier } from './append.js';
import type { RecoveryApplyResult, RecordRecoveryActionAppliedInput } from './types.js';
import { blockedResult, unsupportedProviderControlFailure } from './types.js';

const uniqueEventIds = (eventIds: readonly string[]): readonly string[] => [...new Set(eventIds)];

const clearAllowed = (input: RecordRecoveryActionAppliedInput): boolean =>
  input.committedPlan.plan.classification.state === 'stale-launch-clearable' &&
  input.committedPlan.plan.selectedAction === 'clear-stale-launch' &&
  input.staleLaunchRequest !== undefined &&
  input.staleLaunchRequestEventId !== undefined &&
  input.activeStoryLaunchLease !== undefined &&
  input.activeStoryLaunchLease.name === input.staleLaunchRequest.storyLaunchKey &&
  input.activeStoryLaunchLease.epoch === input.staleLaunchRequest.expiredLeaseEpoch;

const supportsAppliedControl = (input: RecordRecoveryActionAppliedInput): boolean =>
  input.appliedControl !== undefined &&
  input.appliedControl.evidenceRefs.length > 0 &&
  input.committedPlan.plan.providerControl !== undefined &&
  input.appliedControl.kind === input.committedPlan.plan.providerControl;

const gateRequiredForPlan = (plan: RecordRecoveryActionAppliedInput['committedPlan']['plan']): boolean =>
  plan.classification.actionSafety === 'auto-safe' &&
  plan.selectedAction === plan.classification.recommendedAction &&
  (plan.providerControl !== undefined || plan.selectedAction === 'clear-stale-launch');

export const recordRecoveryActionApplied = (input: RecordRecoveryActionAppliedInput): RecoveryApplyResult => {
  const { plan, classifiedEventId, planEventId } = input.committedPlan;

  if (
    gateRequiredForPlan(plan) &&
    (plan.requiresGate === undefined || !hasMatchingAutoRecoverGate(plan, input.gateRef))
  ) {
    return { ok: true, value: blockedResult() };
  }

  if (plan.selectedAction === 'clear-stale-launch') {
    if (!clearAllowed(input)) {
      return { ok: true, value: blockedResult() };
    }
    const activeLease = input.activeStoryLaunchLease;
    const staleLaunchRequest = input.staleLaunchRequest;
    const staleLaunchRequestEventId = input.staleLaunchRequestEventId;
    if (activeLease === undefined || staleLaunchRequest === undefined || staleLaunchRequestEventId === undefined) {
      return { ok: true, value: blockedResult() };
    }

    const payload: StoryLaunchLeaseClearedPayload = {
      schema: 'kit-vnext.story-launch-lease-cleared.v1',
      runId: input.runId,
      storyLaunchKey: activeLease.name,
      clearedLeaseEpoch: staleLaunchRequest.nextLeaseEpoch,
      clearedAt: input.appliedAt,
      sourceEventIds: uniqueEventIds([classifiedEventId, planEventId, staleLaunchRequestEventId]),
    };

    const appended = appendRecoveryBarrier(input.writer, 'StoryLaunchLeaseCleared', payload, input.appliedAt, 'apply');
    if (!appended.ok) {
      return appended;
    }

    return {
      ok: true,
      value: {
        status: 'applied',
        clearedPayload: payload,
        clearedReceipt: appended.value,
      },
    };
  }

  if (plan.providerControl === undefined || plan.selectedAction === 'park-for-operator') {
    return { ok: true, value: blockedResult() };
  }
  if (!supportsAppliedControl(input)) {
    return { ok: false, error: unsupportedProviderControlFailure() };
  }
  const appliedControl = input.appliedControl;
  if (appliedControl === undefined) {
    return { ok: false, error: unsupportedProviderControlFailure() };
  }

  const payload: RecoveryActionAppliedPayload = {
    schema: 'kit-vnext.recovery-action-applied.v1',
    runId: input.runId,
    planId: plan.planId,
    appliedControl: appliedControl.kind,
    gateRef: input.gateRef,
    appliedEvidenceRefs: appliedControl.evidenceRefs,
    appliedAt: input.appliedAt,
    sourceEventIds: uniqueEventIds([classifiedEventId, planEventId]),
  };

  const appended = appendRecoveryBarrier(input.writer, 'RecoveryActionApplied', payload, input.appliedAt, 'apply');
  if (!appended.ok) {
    return appended;
  }

  return {
    ok: true,
    value: {
      status: 'applied',
      payload,
      appendReceipt: appended.value,
    },
  };
};
