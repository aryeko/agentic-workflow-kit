export type ForgeCapability =
  | 'supportsRulesets'
  | 'supportsMergeQueue'
  | 'supportsThreadResolution'
  | 'canInspectProtection';

export type ForgeFailureToken =
  | 'forge-credential-unavailable'
  | 'forge-auth-denied'
  | 'forge-head-mismatch'
  | 'forge-state-unknown'
  | 'forge-protection-uninspectable'
  | 'forge-rulesets-unattested'
  | 'forge-merge-queue-unavailable'
  | 'forge-review-threads-uninspectable'
  | 'forge-admin-bypass-refused'
  | 'forge-ghes-capability-unknown'
  | 'forge-rate-limited'
  | 'forge-redaction-unavailable';

export type ForgeCredentialPhase = 'push' | 'PR create/update' | 'evidence refresh' | 'review metadata' | 'merge';
