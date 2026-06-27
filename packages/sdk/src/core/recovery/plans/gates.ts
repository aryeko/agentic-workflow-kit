import {
  sameCapabilityGateScope,
  sameStringSet,
  type CapabilityGateRecordPayload,
} from '../../capability/evaluator/index.js';
import type { RecoveryPlan } from '../contracts/index.js';

export const hasMatchingAutoRecoverGate = (
  plan: RecoveryPlan,
  gate: CapabilityGateRecordPayload | undefined,
): gate is CapabilityGateRecordPayload => {
  if (plan.requiresGate === undefined) {
    return true;
  }
  if (gate === undefined) {
    return false;
  }

  return (
    gate.capability === 'auto-recover' &&
    gate.decision === 'allow' &&
    gate.mode === 'assisted' &&
    gate.policyRef === plan.requiresGate.policyRef &&
    gate.requestedByDomain === 'core-06' &&
    gate.requestedAction === plan.selectedAction &&
    sameCapabilityGateScope(gate.scope, plan.requiresGate.scope) &&
    sameStringSet(gate.evidenceRefs, plan.requiresGate.evidenceRefs)
  );
};
