import type { RecoveryClassification, RecoveryPlan } from '../contracts/index.js';

import { createRecoveryPlanId } from './keying.js';
import { buildAutoRecoverGateRequest, planSelection } from './matrix.js';
import type { PlanRecoveryActionInput } from './types.js';

export const planRecoveryAction = (
  input: PlanRecoveryActionInput,
  classification: RecoveryClassification,
): RecoveryPlan => {
  const planId = createRecoveryPlanId(input, classification);
  const selection = planSelection(input, classification);

  return {
    planId,
    classification,
    selectedAction: selection.selectedAction,
    requiresGate: buildAutoRecoverGateRequest(planId, input, classification, selection.selectedAction),
    lifecycleTarget: selection.lifecycleTarget,
    providerControl: selection.providerControl,
    sourceEventIds: [],
  };
};
