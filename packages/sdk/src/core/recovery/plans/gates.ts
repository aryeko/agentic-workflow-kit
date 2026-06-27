import type { CapabilityGateRecordPayload, CapabilityGateScope } from '../../capability/evaluator/index.js';
import type { RecoveryPlan } from '../contracts/index.js';

const sortStrings = (values: readonly string[]): readonly string[] => [...values].sort();

const sameStringSet = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && sortStrings(left).every((value, index) => value === sortStrings(right)[index]);

const normalizeScope = (scope: CapabilityGateScope['providerScopes'][number]) => ({
  provider: scope.provider,
  scope: scope.scope,
  freshnessKey: scope.freshnessKey,
  approvedParentScopes: sortStrings(scope.approvedParentScopes ?? []),
});

const sameProviderScopes = (
  left: readonly CapabilityGateScope['providerScopes'][number][],
  right: readonly CapabilityGateScope['providerScopes'][number][],
): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  const leftScopes = left.map(normalizeScope).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const rightScopes = right.map(normalizeScope).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return leftScopes.every((scope, index) => JSON.stringify(scope) === JSON.stringify(rightScopes[index]));
};

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
    gate.scope.runId === plan.requiresGate.scope.runId &&
    gate.scope.operationId === plan.requiresGate.scope.operationId &&
    gate.scope.sessionId === plan.requiresGate.scope.sessionId &&
    gate.scope.expectedHeadSha === plan.requiresGate.scope.expectedHeadSha &&
    gate.scope.pullRequestRef === plan.requiresGate.scope.pullRequestRef &&
    sameProviderScopes(gate.scope.providerScopes, plan.requiresGate.scope.providerScopes) &&
    sameStringSet(gate.evidenceRefs, plan.requiresGate.evidenceRefs)
  );
};
