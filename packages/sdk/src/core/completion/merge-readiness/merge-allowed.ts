import type { CapabilityGateRecordPayload, CapabilityGateScope } from '../../capability/evaluator/index.js';
import type { ForgeEvidenceSnapshot, ForgeStatusCheckContext } from '../../../providers/forge/index.js';
import type { MergeDecisionState } from '../contracts/index.js';

import type { MergeAllowedInput, MergeReadinessDetails } from './types.js';

const successStates = new Set(['SUCCESS']);

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

const isSuccessfulCheck = (context: ForgeStatusCheckContext): boolean =>
  successStates.has((context.conclusion ?? context.state ?? '').toUpperCase());

const requiredChecks = (snapshot: ForgeEvidenceSnapshot): readonly string[] => {
  const branchChecks = snapshot.protection.branchProtectionRules.flatMap((rule) =>
    rule.requiresStatusChecks ? rule.requiredStatusCheckContexts : [],
  );
  const rulesetChecks = snapshot.protection.rulesets
    .filter((ruleset) => ruleset.enforcement.toLowerCase() !== 'disabled')
    .flatMap((ruleset) => ruleset.requiredStatusChecks);
  return [...new Set([...branchChecks, ...rulesetChecks])];
};

const gateMatches = (
  gate: CapabilityGateRecordPayload | undefined,
  input: MergeAllowedInput,
  candidateHeadSha: string,
): gate is CapabilityGateRecordPayload => {
  if (gate === undefined || input.gate === undefined) {
    return false;
  }

  return (
    gate.capability === 'auto-merge' &&
    gate.decision === 'allow' &&
    gate.policyRef === input.policy.policyRef &&
    gate.scope.expectedHeadSha === candidateHeadSha &&
    gate.scope.pullRequestRef === input.gate.pullRequestRef &&
    sameProviderScopes(gate.scope.providerScopes, input.gate.providerScopes) &&
    sameStringSet(gate.evidenceRefs, input.gate.evidenceRefs)
  );
};

const forgeUsable = (
  snapshot: ForgeEvidenceSnapshot,
  input: MergeAllowedInput,
  candidateHeadSha: string,
): MergeDecisionState | undefined => {
  if (snapshot.expectedHeadSha !== candidateHeadSha) {
    return 'merge-branch-not-fresh';
  }

  if (snapshot.pullRequest.headSha !== candidateHeadSha || snapshot.prState.headRefOid !== candidateHeadSha) {
    return 'merge-branch-not-fresh';
  }

  if (input.forge?.expectedBaseSha !== undefined && snapshot.prState.baseRefOid !== input.forge.expectedBaseSha) {
    return 'merge-branch-not-fresh';
  }

  return undefined;
};

export const evaluateMergeState = (input: MergeAllowedInput): MergeReadinessDetails => {
  const candidateHeadSha = input.candidateHeadSha ?? input.completionDecision.headSha ?? input.local.headSha;
  const forgeRefs = input.forge === undefined ? [] : [input.forge.ref];

  if (
    candidateHeadSha === undefined ||
    input.completionDecision.state !== 'completion-verified' ||
    input.completionDecision.headSha !== candidateHeadSha ||
    input.local.headSha !== candidateHeadSha ||
    !input.local.clean ||
    !input.local.changedFilesAllowed ||
    !input.local.verificationFresh
  ) {
    return { state: 'merge-head-ambiguous', forgeRefs };
  }

  if (!input.policy.runnerMayMerge) {
    return { state: 'merge-policy-disabled', forgeRefs };
  }

  if (input.policy.allowedMethod !== input.policy.selectedMethod) {
    return { state: 'merge-policy-disabled', forgeRefs };
  }

  const snapshot = input.forge?.snapshot;
  if (snapshot === undefined) {
    return { state: 'merge-forge-unavailable', forgeRefs };
  }

  if (
    !input.forge?.protectionFresh ||
    !snapshot.scope.capabilities.includes('canInspectProtection') ||
    !snapshot.scope.capabilities.includes('supportsRulesets')
  ) {
    return { state: 'merge-protection-snapshot-stale', forgeRefs };
  }

  const freshnessState = forgeUsable(snapshot, input, candidateHeadSha);
  if (freshnessState !== undefined) {
    return { state: freshnessState, forgeRefs };
  }

  if (input.policy.requiredEvidence.includes('ci')) {
    for (const name of requiredChecks(snapshot)) {
      const context = snapshot.statusChecks.contexts.find((entry) => entry.name === name);
      if (context === undefined) {
        return { state: 'merge-required-check-missing', forgeRefs };
      }
      if (!isSuccessfulCheck(context)) {
        return { state: 'merge-required-check-failed', forgeRefs };
      }
    }
  }

  if (input.policy.requiredEvidence.includes('review') && snapshot.prState.reviewDecision !== 'APPROVED') {
    return { state: 'merge-review-not-approved', forgeRefs };
  }

  if (
    input.policy.requiredEvidence.includes('threads-resolved') &&
    snapshot.reviewThreads.threads.some((thread) => !thread.isResolved)
  ) {
    return { state: 'merge-unresolved-review-threads', forgeRefs };
  }

  const gateRef = gateMatches(input.gate?.record, input, candidateHeadSha) ? input.gate?.record : undefined;
  if (gateRef === undefined) {
    return { state: 'merge-capability-denied', forgeRefs };
  }

  if (input.appendable === false) {
    return { state: 'merge-intent-unwritable', forgeRefs, gateRef };
  }

  return { state: 'merge-ready', forgeRefs, gateRef };
};

export const mergeAllowed = (input: MergeAllowedInput): MergeDecisionState => evaluateMergeState(input).state;
