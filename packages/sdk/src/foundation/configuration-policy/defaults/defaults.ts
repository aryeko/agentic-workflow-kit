import type {
  ApprovalPolicy,
  CapabilityPolicy,
  ChangePolicy,
  CredentialReferencePolicy,
  EgressPolicySource,
  EscalationPolicy,
  MergePolicy,
  PolicyLayer,
  ProvisioningPolicy,
  RunPolicy,
} from '../schema/index.js';

const safeDependencyInstallPrefixes = Object.freeze(['pnpm add ', 'pnpm install ', 'pnpm i '] as const);

export const builtInRunPolicyDefaults: RunPolicy = Object.freeze({
  mode: 'assisted',
  maxConcurrentRuns: 1,
  requireCleanWorkspace: true,
});

export const builtInProvisioningPolicyDefaults: ProvisioningPolicy = Object.freeze({
  ownershipClass: 'owned',
  containmentRequired: true,
  dependencyInstall: Object.freeze({
    defaultGrant: 'narrow',
    allowedPrefixes: safeDependencyInstallPrefixes,
  }),
});

export const builtInApprovalPolicyDefaults: ApprovalPolicy = Object.freeze({
  mode: 'assisted',
  parkOnHumanLatency: true,
  requireRecordedDecision: true,
  decisionWindowMs: 900_000,
});

export const builtInEscalationPolicyDefaults: EscalationPolicy = Object.freeze({
  allowedGrantScopes: Object.freeze(['per-command', 'per-command-prefix'] as const),
  maxGrantScope: 'per-command-prefix',
  denyByDefault: true,
  grantRules: Object.freeze([
    Object.freeze({
      reason: 'dependency-install',
      scope: 'per-command-prefix',
      prefixes: safeDependencyInstallPrefixes,
      requiresOperator: false,
    }),
  ]),
});

export const builtInChangePolicyDefaults: ChangePolicy = Object.freeze({
  allowedChangePaths: Object.freeze([]),
});

export const builtInCapabilityPolicyDefaults: CapabilityPolicy = Object.freeze({
  'auto-merge': Object.freeze({
    desired: false,
    requireFreshAttestation: true,
  }),
  'auto-recover': Object.freeze({
    desired: false,
    requireFreshAttestation: true,
  }),
  'unattended-run': Object.freeze({
    desired: false,
    requireFreshAttestation: true,
  }),
  'escalation-auto-grant': Object.freeze({
    desired: false,
    requireFreshAttestation: true,
  }),
});

export const builtInCredentialReferencePolicyDefaults: CredentialReferencePolicy = Object.freeze({
  refs: Object.freeze([]),
});

export const builtInEgressPolicyDefaults: EgressPolicySource = Object.freeze({
  defaultAction: 'deny',
  rules: Object.freeze([]),
  negativeProbes: Object.freeze([]),
  requiredAttesters: Object.freeze([]),
});

export const builtInMergePolicyDefaults: MergePolicy = Object.freeze({
  runnerMayPush: true,
  runnerMayOpenPr: true,
  runnerMayMerge: false,
  requiredEvidence: Object.freeze(['verification', 'ci', 'review', 'threads-resolved', 'protection'] as const),
});

export const builtInPolicyLayerDefaults: PolicyLayer = Object.freeze({
  run: builtInRunPolicyDefaults,
  provisioning: builtInProvisioningPolicyDefaults,
  approval: builtInApprovalPolicyDefaults,
  escalationPolicy: builtInEscalationPolicyDefaults,
  changePolicy: builtInChangePolicyDefaults,
  capabilities: builtInCapabilityPolicyDefaults,
  credentialRefs: builtInCredentialReferencePolicyDefaults,
  egress: builtInEgressPolicyDefaults,
  merge: builtInMergePolicyDefaults,
});
