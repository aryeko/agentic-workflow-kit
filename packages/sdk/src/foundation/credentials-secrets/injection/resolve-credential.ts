import { validateCredentialScopeUse } from '../scopes/index.js';
import { denyUnattestedEgressPolicy } from '../egress/index.js';
import { denyAuditWriteUnavailable } from '../failures/index.js';
import { createCredentialDenied } from '../failures/index.js';
import { createStartedAuditEvent, denyCredential } from './operation-audit.js';
import type {
  ResolveCredentialDependencies,
  ResolveCredentialInput,
  ResolveCredentialResult,
} from './injection-types.js';

const parseTimestamp = (value: string): number => globalThis.Date.parse(value);

const matchesEgressAttestation = (
  input: ResolveCredentialInput,
  dependencies: ResolveCredentialDependencies,
): readonly import('../egress/index.js').EgressAttestation[] => {
  if (input.egressPolicy === undefined) {
    return [];
  }

  const attestationsById = new Map((input.attestations ?? []).map((attestation) => [attestation.id, attestation]));
  const selected = (input.attestationIds ?? []).flatMap((attestationId) => {
    const attestation = attestationsById.get(attestationId);
    return attestation === undefined ? [] : [attestation];
  });

  return selected.filter((attestation) => {
    const required = input.egressPolicy?.requiredAttesters.find(
      (candidate) => candidate.driverId === attestation.driverId,
    );
    if (required === undefined) {
      return false;
    }

    const evidenceRef = attestation.evidenceRef.trim();
    const missingNegativeProbeCoverage = input.egressPolicy?.negativeProbeIds.some(
      (negativeProbeId) => !attestation.negativeProbeIds.includes(negativeProbeId),
    );

    return (
      required.runtimeMetadataAvailable &&
      attestation.result === 'positive' &&
      evidenceRef.length > 0 &&
      !missingNegativeProbeCoverage &&
      parseTimestamp(attestation.expiresAt) > parseTimestamp(dependencies.now) &&
      attestation.point === required.point &&
      attestation.capability === required.capability &&
      attestation.scopeDigest === required.scopeDigest &&
      attestation.egressPolicyDigest === required.egressPolicyDigest &&
      attestation.freshnessKey === input.egressPolicy?.freshnessKey &&
      attestation.platform === required.platform &&
      attestation.driverVersion === required.driverVersion
    );
  });
};

export const resolveCredential = (
  input: ResolveCredentialInput,
  dependencies: ResolveCredentialDependencies,
): ResolveCredentialResult => {
  const validation = validateCredentialScopeUse(input.ref, input.scope, {
    hashText: dependencies.hashText,
    now: dependencies.now,
    issuedAt: dependencies.issuedAt,
    host: dependencies.host,
    command: dependencies.command,
  });
  if (!validation.ok) {
    return denyCredential(
      validation.error.token,
      {
        refs: [input.ref],
        scope: input.scope,
        at: dependencies.at,
        prevEventHash: dependencies.prevEventHash,
      },
      dependencies,
    );
  }

  if (!dependencies.auditSinkAvailable || input.requiredAuditEvent === undefined) {
    return denyAuditWriteUnavailable(
      {
        audit: {
          runId: input.scope.runId,
          taskId: input.scope.taskId,
          operationId: input.scope.operationId,
          credentialRefIds: [input.ref.id],
          party: input.scope.party,
          phase: input.scope.phase,
          policyDigest: input.ref.policyDigest,
          credentialRefDigest: input.requiredAuditEvent?.credentialRefDigest ?? dependencies.hashText(input.ref.id),
          scopeDigest: input.requiredAuditEvent?.scopeDigest ?? dependencies.hashText(input.scope.operationId),
          ...(input.scope.grantEventId === undefined ? {} : { grantEventId: input.scope.grantEventId }),
          attestationEventIds: [],
          evidenceRefs: [],
          prevEventHash: dependencies.prevEventHash,
          at: dependencies.at,
        },
      },
      dependencies,
    );
  }

  if (input.redactionSet === undefined) {
    return createCredentialDenied('redaction-unavailable', {
      ...input.requiredAuditEvent,
      type: 'CredentialUseDenied',
      reason: 'redaction-unavailable',
      prevEventHash: dependencies.prevEventHash,
      at: dependencies.at,
      eventHash: dependencies.hashText(
        JSON.stringify({
          type: 'CredentialUseDenied',
          reason: 'redaction-unavailable',
          operationId: input.scope.operationId,
        }),
      ),
    });
  }

  const matchedAttestations = matchesEgressAttestation(input, dependencies);
  if (input.egressPolicy !== undefined && input.egressPolicy.requiredAttesters.length > 0) {
    const requiredIds = input.egressPolicy.requiredAttesters.map((requiredAttester) => requiredAttester.driverId);
    const matchedIds = matchedAttestations.map((attestation) => attestation.driverId);
    if (requiredIds.some((driverId) => !matchedIds.includes(driverId))) {
      return denyUnattestedEgressPolicy(
        {
          refs: [input.ref],
          scope: input.scope,
          egressPolicyDigest: input.egressPolicy.egressPolicyDigest,
          at: dependencies.at,
          prevEventHash: dependencies.prevEventHash,
        },
        dependencies,
      );
    }
  }

  const resolved = dependencies.resolveSecretMaterial(input.ref);
  if (resolved === undefined) {
    return denyCredential(
      'credential-ref-unresolved',
      {
        refs: [input.ref],
        scope: input.scope,
        at: dependencies.at,
        prevEventHash: dependencies.prevEventHash,
      },
      dependencies,
    );
  }

  return {
    ok: true,
    credentialRefId: input.ref.id,
    materialHandle: resolved.materialHandle,
    redactionSet: input.redactionSet,
    auditEvent: createStartedAuditEvent(
      {
        refs: [input.ref],
        scope: input.scope,
        redactionSet: input.redactionSet,
        injectionModes: input.injectionModes,
        attestations: matchedAttestations,
        at: dependencies.at,
        prevEventHash: dependencies.prevEventHash,
      },
      dependencies,
    ),
  };
};
