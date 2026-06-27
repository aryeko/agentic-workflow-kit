import type { CapabilityGateRequest } from '../../capability/evaluator/index.js';
import type { RunLifecycleState } from '../../run-lifecycle/contracts/index.js';
import type { RecoveryAction, RecoveryClassification, RecoveryPlan } from '../contracts/index.js';

import type { PlanRecoveryActionInput } from './types.js';

const providerControlByAction: Partial<Record<RecoveryAction, NonNullable<RecoveryPlan['providerControl']>>> = {
  'resume-owned-session': 'agent-resume',
  'retry-evidence-refresh': 'forge-refresh',
  'request-termination': 'host-terminate',
  'restart-from-cleared-state': 'work-source-release',
};

const lifecycleTargetByAction: Partial<Record<RecoveryAction, RunLifecycleState>> = {
  'block-run': 'blocked',
  'fail-run': 'failed',
};

const selectRequestedAction = (
  input: PlanRecoveryActionInput,
  classification: RecoveryClassification,
): RecoveryAction => {
  if (classification.actionSafety === 'auto-safe') {
    if (input.mode !== 'assisted' || input.requestedAction === 'park-for-operator') {
      return 'park-for-operator';
    }
    return classification.recommendedAction;
  }

  if (classification.actionSafety === 'operator-required') {
    return input.requestedAction === 'block-run' ? 'block-run' : 'park-for-operator';
  }

  if (
    input.requestedAction === 'fail-run' ||
    input.requestedAction === 'block-run' ||
    input.requestedAction === 'none'
  ) {
    return input.requestedAction;
  }
  return classification.recommendedAction;
};

export const buildAutoRecoverGateRequest = (
  planId: string,
  input: PlanRecoveryActionInput,
  classification: RecoveryClassification,
  selectedAction: RecoveryAction,
): CapabilityGateRequest | undefined => {
  if (
    classification.actionSafety !== 'auto-safe' ||
    input.mode !== 'assisted' ||
    selectedAction !== classification.recommendedAction
  ) {
    return undefined;
  }

  return {
    gateId: `gate:auto-recover:${planId.slice('recovery-plan:'.length)}`,
    runId: input.runId,
    capability: 'auto-recover',
    mode: input.mode,
    scope: input.scope,
    policyRef: input.policyRef,
    policyDecision: {
      policyRef: input.policyRef,
      permits: true,
    },
    requestedByDomain: 'core-06',
    requestedAction: selectedAction,
    evaluatedAt: input.plannedAt,
    evidenceRefs: classification.evidenceRefs.map((ref) => ref.eventId),
  };
};

export const planSelection = (input: PlanRecoveryActionInput, classification: RecoveryClassification) => {
  const selectedAction = selectRequestedAction(input, classification);
  return {
    selectedAction,
    providerControl: providerControlByAction[selectedAction],
    lifecycleTarget: lifecycleTargetByAction[selectedAction],
  };
};
