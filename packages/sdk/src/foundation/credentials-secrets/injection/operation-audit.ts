import { stableCanonicalStringify } from '../../configuration-policy/index.js';
import {
  createCredentialUseDenied,
  createCredentialUsePlanned,
  createCredentialUseStarted,
  type AuditSeed,
  type CredentialUsePlanned,
  type CredentialUseStarted,
} from '../audit/index.js';
import { createCredentialDenied } from '../failures/index.js';
import type { CredentialDenied } from '../failures/index.js';
import type { CredentialRef } from '../refs/index.js';
import { createCredentialScope } from '../scopes/index.js';
import type { EgressAttestation, EgressPolicy } from '../egress/index.js';
import type { ResolveCredentialInput, SharedCredentialOperationDependencies } from './injection-types.js';

const unique = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    ordered.push(value);
  }

  return ordered;
};

export const createScopeDigest = (
  scope: Parameters<typeof createCredentialScope>[0],
  hashText: SharedCredentialOperationDependencies['hashText'],
): string => hashText(stableCanonicalStringify(createCredentialScope(scope)));

export const createCredentialRefDigest = (
  refs: readonly CredentialRef[],
  hashText: SharedCredentialOperationDependencies['hashText'],
): string =>
  hashText(
    stableCanonicalStringify(
      refs.map((ref) => ({
        id: ref.id,
        kind: ref.kind,
        policyDigest: ref.policyDigest,
        allowedParties: ref.allowedParties,
        allowedPhases: ref.allowedPhases,
        allowedHosts: ref.allowedHosts,
      })),
    ),
  );

export const buildAuditSeed = (
  input: {
    readonly refs: readonly CredentialRef[];
    readonly scope: Parameters<typeof createCredentialScope>[0];
    readonly at: string;
    readonly prevEventHash: string;
    readonly attestationEventIds?: readonly string[];
    readonly evidenceRefs?: readonly string[];
  },
  hashText: SharedCredentialOperationDependencies['hashText'],
): AuditSeed => ({
  runId: input.scope.runId,
  taskId: input.scope.taskId,
  operationId: input.scope.operationId,
  credentialRefIds: unique(input.refs.map((ref) => ref.id)),
  party: input.scope.party,
  phase: input.scope.phase,
  policyDigest:
    input.refs.length === 1
      ? input.refs[0].policyDigest
      : hashText(unique(input.refs.map((ref) => ref.policyDigest)).join('|')),
  credentialRefDigest: createCredentialRefDigest(input.refs, hashText),
  scopeDigest: createScopeDigest(input.scope, hashText),
  ...(input.scope.grantEventId === undefined ? {} : { grantEventId: input.scope.grantEventId }),
  attestationEventIds: [...(input.attestationEventIds ?? [])],
  evidenceRefs: [...(input.evidenceRefs ?? [])],
  prevEventHash: input.prevEventHash,
  at: input.at,
});

export const denyCredential = (
  reason: import('../failures/index.js').CredentialDenialReason,
  input: {
    readonly refs: readonly CredentialRef[];
    readonly scope: Parameters<typeof createCredentialScope>[0];
    readonly at: string;
    readonly prevEventHash: string;
  },
  dependencies: Pick<SharedCredentialOperationDependencies, 'hashText'>,
): CredentialDenied =>
  createCredentialDenied(
    reason,
    createCredentialUseDenied(
      {
        audit: buildAuditSeed(
          {
            refs: input.refs,
            scope: input.scope,
            at: input.at,
            prevEventHash: input.prevEventHash,
          },
          dependencies.hashText,
        ),
        reason,
      },
      dependencies,
    ),
  );

export const createPlannedAuditEvent = (
  input: {
    readonly refs: readonly CredentialRef[];
    readonly scope: Parameters<typeof createCredentialScope>[0];
    readonly egressPolicy: EgressPolicy;
    readonly at: string;
    readonly prevEventHash: string;
  },
  dependencies: Pick<SharedCredentialOperationDependencies, 'hashText'>,
): CredentialUsePlanned =>
  createCredentialUsePlanned(
    {
      audit: buildAuditSeed(
        {
          refs: input.refs,
          scope: input.scope,
          at: input.at,
          prevEventHash: input.prevEventHash,
        },
        dependencies.hashText,
      ),
      egressPolicyId: input.egressPolicy.id,
      expiresAt: input.scope.expiresAt,
      reason: 'scoped injection required',
    },
    dependencies,
  );

export const createStartedAuditEvent = (
  input: {
    readonly refs: readonly CredentialRef[];
    readonly scope: Parameters<typeof createCredentialScope>[0];
    readonly redactionSet: ResolveCredentialInput['redactionSet'];
    readonly injectionModes: readonly import('../refs/index.js').InjectionMode[];
    readonly attestations: readonly EgressAttestation[];
    readonly at: string;
    readonly prevEventHash: string;
  },
  dependencies: Pick<SharedCredentialOperationDependencies, 'hashText'>,
): CredentialUseStarted =>
  createCredentialUseStarted(
    {
      audit: buildAuditSeed(
        {
          refs: input.refs,
          scope: input.scope,
          at: input.at,
          prevEventHash: input.prevEventHash,
          attestationEventIds: input.attestations.map((attestation) => attestation.id),
          evidenceRefs: input.attestations.map((attestation) => attestation.evidenceRef),
        },
        dependencies.hashText,
      ),
      injectionModes: [...input.injectionModes],
      redactionFingerprintIds: [...(input.redactionSet?.fingerprintIds ?? [])],
    },
    dependencies,
  );
