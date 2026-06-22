export const CREDENTIAL_DENIAL_REASONS = [
  'credential-ref-unresolved',
  'credential-scope-denied',
  'worker-forge-credential-denied',
  'egress-policy-unattested',
  'redaction-unavailable',
  'audit-write-unavailable',
] as const;

export type CredentialDenialReason = (typeof CREDENTIAL_DENIAL_REASONS)[number];

export const CREDENTIAL_FAILURE_TOKENS = [
  ...CREDENTIAL_DENIAL_REASONS,
  'credential-destroy-unconfirmed',
  'artifact-redaction-failed',
] as const;

export type CredentialFailureToken = (typeof CREDENTIAL_FAILURE_TOKENS)[number];
