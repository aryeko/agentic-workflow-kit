import type { CapabilityGateScope, CapabilityProviderScope } from './types.js';

const sortStrings = (values: readonly string[]): readonly string[] => [...values].sort();

export const sameStringSet = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = sortStrings(left);
  const sortedRight = sortStrings(right);
  return sortedLeft.every((value, index) => value === sortedRight[index]);
};

const providerScopeSortKey = (scope: CapabilityProviderScope): string =>
  [scope.provider, scope.scope, scope.freshnessKey, ...sortStrings(scope.approvedParentScopes ?? [])].join('\u0000');

const sameProviderScopes = (
  left: readonly CapabilityProviderScope[],
  right: readonly CapabilityProviderScope[],
): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  const leftScopes = left
    .map((scope) => ({ key: providerScopeSortKey(scope), scope }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const rightScopes = right
    .map((scope) => ({ key: providerScopeSortKey(scope), scope }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return leftScopes.every(
    ({ key, scope }, index) =>
      key === rightScopes[index]?.key &&
      sameStringSet(scope.approvedParentScopes ?? [], rightScopes[index]?.scope.approvedParentScopes ?? []),
  );
};

export const sameCapabilityGateScope = (left: CapabilityGateScope, right: CapabilityGateScope): boolean =>
  left.runId === right.runId &&
  left.taskId === right.taskId &&
  left.operationId === right.operationId &&
  left.repoRef === right.repoRef &&
  left.workspaceRef === right.workspaceRef &&
  left.sessionId === right.sessionId &&
  left.pullRequestRef === right.pullRequestRef &&
  left.expectedHeadSha === right.expectedHeadSha &&
  left.egressPolicyDigest === right.egressPolicyDigest &&
  sameProviderScopes(left.providerScopes, right.providerScopes);
