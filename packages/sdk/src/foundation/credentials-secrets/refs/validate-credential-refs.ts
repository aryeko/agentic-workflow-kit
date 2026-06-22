import {
  stableCanonicalStringify,
  type CredentialRefSource,
  type ResolvedPolicy,
} from '../../configuration-policy/index.js';
import type {
  CredentialRef,
  CredentialRefValidationFailure,
  CredentialRefValidationResult,
  SecretRef,
  ValidateCredentialRefsDependencies,
} from './credential-ref-types.js';

const createSecretRef = (
  secret: CredentialRefSource['secret'],
  hashText: ValidateCredentialRefsDependencies['hashText'],
): SecretRef => ({
  id: `secret-ref:${hashText(stableCanonicalStringify(secret))}`,
  source: secret.source,
  key: secret.key,
  ...(secret.version === undefined ? {} : { version: secret.version }),
});

const createPolicyDigest = (
  resolvedPolicy: ResolvedPolicy,
  hashText: ValidateCredentialRefsDependencies['hashText'],
): string => hashText(stableCanonicalStringify(resolvedPolicy.policy.credentialRefs));

const fail = (error: CredentialRefValidationFailure): CredentialRefValidationResult => ({
  ok: false,
  error,
});

export const validateCredentialRefsFromResolvedPolicy = (
  resolvedPolicy: ResolvedPolicy,
  dependencies: ValidateCredentialRefsDependencies,
): CredentialRefValidationResult => {
  const policyDigest = createPolicyDigest(resolvedPolicy, dependencies.hashText);
  const refs: CredentialRef[] = [];

  for (const source of resolvedPolicy.policy.credentialRefs.refs) {
    const secretRef = createSecretRef(source.secret, dependencies.hashText);

    if (secretRef.source !== 'env') {
      return fail({
        token: 'credential-ref-unresolved',
        reason: 'unsupported',
        credentialRefId: source.id,
        secretRef,
        policyDigest,
      });
    }

    const inspection = dependencies.inspectSecretRef(secretRef);
    if (!inspection.ok) {
      return fail({
        token: 'credential-ref-unresolved',
        reason: inspection.reason,
        credentialRefId: source.id,
        secretRef,
        policyDigest,
      });
    }

    refs.push({
      id: source.id,
      kind: source.kind,
      purpose: source.purpose,
      secret: secretRef,
      allowedParties: [...source.allowedParties],
      allowedPhases: [...source.allowedPhases],
      allowedHosts: [...source.allowedHosts],
      ttlSeconds: source.ttlSeconds,
      policyDigest,
    });
  }

  return {
    ok: true,
    value: {
      policyDigest,
      refs,
    },
  };
};
