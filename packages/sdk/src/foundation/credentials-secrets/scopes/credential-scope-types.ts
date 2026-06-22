import type { Result } from '../../configuration-policy/index.js';
import type { CredentialRef, CredentialParty } from '../refs/index.js';

export type CredentialScope = {
  readonly runId: string;
  readonly taskId: string;
  readonly operationId: string;
  readonly party: CredentialParty;
  readonly phase: string;
  readonly commandPrefix?: string;
  readonly processId?: string;
  readonly expiresAt: string;
  readonly grantEventId?: string;
};

export type CredentialScopeDenialReason =
  | 'party-not-allowed'
  | 'phase-not-allowed'
  | 'host-not-allowed'
  | 'command-prefix-mismatch'
  | 'ttl-exceeded'
  | 'scope-expired'
  | 'worker-forge';

export type CredentialScopeValidationReport = {
  readonly scope: CredentialScope;
  readonly policyDigest: CredentialRef['policyDigest'];
  readonly scopeDigest: string;
};

export type CredentialScopeValidationFailure = {
  readonly token: 'credential-scope-denied' | 'worker-forge-credential-denied';
  readonly reason: CredentialScopeDenialReason;
  readonly credentialRefId: CredentialRef['id'];
  readonly policyDigest: CredentialRef['policyDigest'];
  readonly scopeDigest: string;
};

export type CredentialScopeValidationResult = Result<CredentialScopeValidationReport, CredentialScopeValidationFailure>;

export type ValidateCredentialScopeUseContext = {
  readonly hashText: (value: string) => string;
  readonly now: string;
  readonly issuedAt: string;
  readonly host?: string;
  readonly command?: string;
};
