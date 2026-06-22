import { stableCanonicalStringify } from '../../configuration-policy/index.js';
import type { CredentialRef } from '../refs/index.js';
import type {
  CredentialScope,
  CredentialScopeValidationFailure,
  CredentialScopeValidationResult,
  ValidateCredentialScopeUseContext,
} from './credential-scope-types.js';

const parseTimestamp = (value: string): number => globalThis.Date.parse(value);

const createScopeDigest = (scope: CredentialScope, hashText: ValidateCredentialScopeUseContext['hashText']): string =>
  hashText(stableCanonicalStringify(scope));

const deny = (
  ref: CredentialRef,
  scopeDigest: string,
  error: Pick<CredentialScopeValidationFailure, 'token' | 'reason'>,
): CredentialScopeValidationResult => ({
  ok: false,
  error: {
    ...error,
    credentialRefId: ref.id,
    policyDigest: ref.policyDigest,
    scopeDigest,
  },
});

export const createCredentialScope = (scope: CredentialScope): CredentialScope => ({ ...scope });

export const validateCredentialScopeUse = (
  ref: CredentialRef,
  scope: CredentialScope,
  context: ValidateCredentialScopeUseContext,
): CredentialScopeValidationResult => {
  const scopeDigest = createScopeDigest(scope, context.hashText);

  if (scope.party === 'worker' && ref.kind === 'forge') {
    return deny(ref, scopeDigest, {
      token: 'worker-forge-credential-denied',
      reason: 'worker-forge',
    });
  }

  if (!ref.allowedParties.includes(scope.party)) {
    return deny(ref, scopeDigest, {
      token: 'credential-scope-denied',
      reason: 'party-not-allowed',
    });
  }

  if (!ref.allowedPhases.includes(scope.phase)) {
    return deny(ref, scopeDigest, {
      token: 'credential-scope-denied',
      reason: 'phase-not-allowed',
    });
  }

  if (context.host === undefined || !ref.allowedHosts.includes(context.host)) {
    return deny(ref, scopeDigest, {
      token: 'credential-scope-denied',
      reason: 'host-not-allowed',
    });
  }

  if (
    scope.commandPrefix !== undefined &&
    (context.command === undefined || !context.command.startsWith(scope.commandPrefix))
  ) {
    return deny(ref, scopeDigest, {
      token: 'credential-scope-denied',
      reason: 'command-prefix-mismatch',
    });
  }

  const issuedAtMs = parseTimestamp(context.issuedAt);
  const expiresAtMs = parseTimestamp(scope.expiresAt);
  const nowMs = parseTimestamp(context.now);

  if (
    !Number.isFinite(issuedAtMs) ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs - issuedAtMs > ref.ttlSeconds * 1_000
  ) {
    return deny(ref, scopeDigest, {
      token: 'credential-scope-denied',
      reason: 'ttl-exceeded',
    });
  }

  if (!Number.isFinite(nowMs) || expiresAtMs <= nowMs) {
    return deny(ref, scopeDigest, {
      token: 'credential-scope-denied',
      reason: 'scope-expired',
    });
  }

  return {
    ok: true,
    value: {
      scope,
      policyDigest: ref.policyDigest,
      scopeDigest,
    },
  };
};
