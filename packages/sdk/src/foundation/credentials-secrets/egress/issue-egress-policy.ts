import { stableCanonicalStringify } from '../../configuration-policy/index.js';
import { createCredentialUseDenied } from '../audit/index.js';
import { createCredentialDenied } from '../failures/index.js';
import type { CredentialRef } from '../refs/index.js';
import { createCredentialScope } from '../scopes/index.js';
import type {
  EgressPolicy,
  IssueEgressPolicyDependencies,
  IssueEgressPolicyInput,
  IssueEgressPolicyResult,
  RequiredAttester,
} from './egress-types.js';

const unique = <TValue>(values: readonly TValue[]): readonly TValue[] => {
  const seen = new Set<TValue>();
  const ordered: TValue[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    ordered.push(value);
  }

  return ordered;
};

const createScopeDigest = (
  scope: IssueEgressPolicyInput['scope'],
  hashText: IssueEgressPolicyDependencies['hashText'],
): string => hashText(stableCanonicalStringify(createCredentialScope(scope)));

const createPolicyDigest = (
  policy: Omit<EgressPolicy, 'id' | 'egressPolicyDigest' | 'requiredAttesters'> & {
    readonly requiredAttesters: readonly Omit<RequiredAttester, 'egressPolicyDigest'>[];
  },
  hashText: IssueEgressPolicyDependencies['hashText'],
): string => hashText(stableCanonicalStringify(policy));

const createCredentialRefDigest = (
  refs: readonly CredentialRef[],
  hashText: IssueEgressPolicyDependencies['hashText'],
): string =>
  hashText(
    stableCanonicalStringify(
      refs.map((ref) => ({
        id: ref.id,
        kind: ref.kind,
        policyDigest: ref.policyDigest,
      })),
    ),
  );

const selectRules = (input: IssueEgressPolicyInput): EgressPolicy['rules'] =>
  input.egressSource.rules
    .filter(
      (rule) =>
        rule.phase === input.scope.phase &&
        rule.credentialRefIds.some((credentialRefId) => input.refs.some((ref) => ref.id === credentialRefId)),
    )
    .map((rule) => ({
      credentialRefIds: [...rule.credentialRefIds],
      protocols: [...rule.protocols],
      hosts: [...rule.hosts],
      ...(rule.ports === undefined ? {} : { ports: [...rule.ports] }),
      phase: rule.phase,
      purpose: rule.purpose,
    }));

const selectNegativeProbes = (input: IssueEgressPolicyInput): EgressPolicy['negativeProbes'] =>
  input.egressSource.negativeProbes.map((probe) => ({
    host: probe.host,
    protocol: probe.protocol,
    expected: probe.expected,
    reason: probe.reason,
  }));

const createNegativeProbeId = (
  probe: EgressPolicy['negativeProbes'][number],
  hashText: IssueEgressPolicyDependencies['hashText'],
): string => `negative-probe:${hashText(stableCanonicalStringify(probe))}`;

const resolveRequiredAttesters = (
  input: IssueEgressPolicyInput,
  scopeDigest: string,
  egressPolicyDigest: string,
): readonly RequiredAttester[] =>
  input.egressSource.requiredAttesters.map((requiredAttester) => ({
    point: requiredAttester.point,
    capability: requiredAttester.capability,
    driverId: requiredAttester.driverId,
    scopeDigest,
    egressPolicyDigest,
  }));

const denyPolicyIssuance = (
  ref: CredentialRef,
  scope: IssueEgressPolicyInput['scope'],
  reason: 'credential-scope-denied' | 'worker-forge-credential-denied',
  dependencies: IssueEgressPolicyDependencies,
) =>
  createCredentialDenied(
    reason,
    createCredentialUseDenied(
      {
        audit: {
          runId: scope.runId,
          taskId: scope.taskId,
          operationId: scope.operationId,
          credentialRefIds: [ref.id],
          party: scope.party,
          phase: scope.phase,
          policyDigest: ref.policyDigest,
          credentialRefDigest: createCredentialRefDigest([ref], dependencies.hashText),
          scopeDigest: createScopeDigest(scope, dependencies.hashText),
          ...(scope.grantEventId === undefined ? {} : { grantEventId: scope.grantEventId }),
          attestationEventIds: [],
          evidenceRefs: [],
          prevEventHash: dependencies.prevEventHash,
          at: dependencies.at,
        },
        reason,
      },
      dependencies,
    ),
  );

const validatePublicEgressPolicyInput = (
  input: IssueEgressPolicyInput,
  dependencies: IssueEgressPolicyDependencies,
): IssueEgressPolicyResult | undefined => {
  for (const ref of input.refs) {
    if (ref.kind !== 'forge') {
      continue;
    }

    if (input.scope.party === 'worker') {
      return denyPolicyIssuance(ref, input.scope, 'worker-forge-credential-denied', dependencies);
    }

    if (!ref.allowedParties.includes(input.scope.party)) {
      return denyPolicyIssuance(ref, input.scope, 'credential-scope-denied', dependencies);
    }

    if (!ref.allowedPhases.includes(input.scope.phase)) {
      return denyPolicyIssuance(ref, input.scope, 'credential-scope-denied', dependencies);
    }

    const selectedRules = input.egressSource.rules.filter(
      (rule) => rule.phase === input.scope.phase && rule.credentialRefIds.includes(ref.id),
    );
    if (
      selectedRules.length === 0 ||
      selectedRules.some((rule) => rule.hosts.some((host) => !ref.allowedHosts.includes(host)))
    ) {
      return denyPolicyIssuance(ref, input.scope, 'credential-scope-denied', dependencies);
    }
  }

  return undefined;
};

export const issueEgressPolicy = (
  input: IssueEgressPolicyInput,
  dependencies: IssueEgressPolicyDependencies,
): IssueEgressPolicyResult => {
  const validation = validatePublicEgressPolicyInput(input, dependencies);
  if (validation !== undefined) {
    return validation;
  }

  const scopeDigest = createScopeDigest(input.scope, dependencies.hashText);
  const rules = selectRules(input);
  const negativeProbes = selectNegativeProbes(input);
  const negativeProbeIds = negativeProbes.map((probe) => createNegativeProbeId(probe, dependencies.hashText));
  const freshnessKey = dependencies.hashText(
    stableCanonicalStringify({
      operationId: input.scope.operationId,
      credentialRefIds: unique(input.refs.map((ref) => ref.id)),
      scopeDigest,
      rules,
      negativeProbeIds,
    }),
  );
  const preliminary = {
    runId: input.scope.runId,
    operationId: input.scope.operationId,
    audience: input.scope.party,
    defaultAction: input.egressSource.defaultAction,
    rules,
    negativeProbes,
    negativeProbeIds,
    requiredAttesters: resolveRequiredAttesters(input, scopeDigest, ''),
    freshnessKey,
    expiresAt: input.scope.expiresAt,
  } satisfies Omit<EgressPolicy, 'id' | 'egressPolicyDigest'> & {
    readonly requiredAttesters: readonly Omit<RequiredAttester, 'egressPolicyDigest'>[];
  };
  const egressPolicyDigest = createPolicyDigest(preliminary, dependencies.hashText);
  const requiredAttesters = resolveRequiredAttesters(input, scopeDigest, egressPolicyDigest);
  const policy: EgressPolicy = {
    id: `egress-policy:${egressPolicyDigest}`,
    runId: input.scope.runId,
    operationId: input.scope.operationId,
    audience: input.scope.party,
    egressPolicyDigest,
    defaultAction: input.egressSource.defaultAction,
    rules,
    negativeProbes,
    negativeProbeIds,
    requiredAttesters,
    freshnessKey,
    expiresAt: input.scope.expiresAt,
  };

  return {
    ok: true,
    value: policy,
  };
};

export const denyUnattestedEgressPolicy = (
  input: {
    readonly refs: readonly CredentialRef[];
    readonly scope: IssueEgressPolicyInput['scope'];
    readonly egressPolicyDigest: string;
    readonly at: string;
    readonly prevEventHash: string;
  },
  dependencies: Pick<IssueEgressPolicyDependencies, 'hashText'>,
) =>
  createCredentialDenied(
    'egress-policy-unattested',
    createCredentialUseDenied(
      {
        audit: {
          runId: input.scope.runId,
          taskId: input.scope.taskId,
          operationId: input.scope.operationId,
          credentialRefIds: input.refs.map((ref) => ref.id),
          party: input.scope.party,
          phase: input.scope.phase,
          policyDigest: input.refs[0]?.policyDigest ?? input.egressPolicyDigest,
          credentialRefDigest: createCredentialRefDigest(input.refs, dependencies.hashText),
          scopeDigest: createScopeDigest(input.scope, dependencies.hashText),
          ...(input.scope.grantEventId === undefined ? {} : { grantEventId: input.scope.grantEventId }),
          attestationEventIds: [],
          evidenceRefs: [],
          prevEventHash: input.prevEventHash,
          at: input.at,
        },
        reason: 'egress-policy-unattested',
      },
      dependencies,
    ),
  );
