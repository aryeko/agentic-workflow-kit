import { describe, expect, it } from 'vitest';

import {
  builtInPolicyLayerDefaults,
  builtInApprovalPolicyDefaults,
  builtInCapabilityPolicyDefaults,
  builtInChangePolicyDefaults,
  builtInCredentialReferencePolicyDefaults,
  builtInEgressPolicyDefaults,
  builtInEscalationPolicyDefaults,
  builtInMergePolicyDefaults,
  builtInProvisioningPolicyDefaults,
  builtInRunPolicyDefaults,
} from '../../../../src/foundation/configuration-policy/defaults/index.js';

describe('fnd-01-s1-config-schema safe defaults', () => {
  it('include complete values for the entire policy layer', () => {
    expect(builtInPolicyLayerDefaults).toEqual({
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
  });

  it('keep the autonomous surface default-off and supervised', () => {
    expect(builtInRunPolicyDefaults).toEqual({
      mode: 'assisted',
      maxConcurrentRuns: 1,
      requireCleanWorkspace: true,
    });

    expect(builtInApprovalPolicyDefaults).toEqual({
      mode: 'assisted',
      parkOnHumanLatency: true,
      requireRecordedDecision: true,
      decisionWindowMs: 900_000,
    });

    expect(builtInCapabilityPolicyDefaults).toEqual({
      'auto-merge': {
        desired: false,
        requireFreshAttestation: true,
      },
      'auto-recover': {
        desired: false,
        requireFreshAttestation: true,
      },
      'unattended-run': {
        desired: false,
        requireFreshAttestation: true,
      },
      'escalation-auto-grant': {
        desired: false,
        requireFreshAttestation: true,
      },
    });

    expect(builtInProvisioningPolicyDefaults).toEqual({
      ownershipClass: 'owned',
      containmentRequired: true,
      dependencyInstall: {
        defaultGrant: 'narrow',
        allowedPrefixes: ['pnpm add ', 'pnpm install ', 'pnpm i '],
      },
    });

    expect(builtInEscalationPolicyDefaults).toEqual({
      allowedGrantScopes: ['per-command', 'per-command-prefix'],
      maxGrantScope: 'per-command-prefix',
      denyByDefault: true,
      grantRules: [
        {
          reason: 'dependency-install',
          scope: 'per-command-prefix',
          prefixes: ['pnpm add ', 'pnpm install ', 'pnpm i '],
          requiresOperator: false,
        },
      ],
    });

    expect(builtInChangePolicyDefaults).toEqual({
      allowedChangePaths: [],
    });

    expect(builtInCredentialReferencePolicyDefaults).toEqual({
      refs: [],
    });

    expect(builtInEgressPolicyDefaults).toEqual({
      defaultAction: 'deny',
      rules: [],
      negativeProbes: [],
      requiredAttesters: [],
    });

    expect(builtInMergePolicyDefaults).toEqual({
      runnerMayPush: true,
      runnerMayOpenPr: true,
      runnerMayMerge: false,
      requiredEvidence: ['verification', 'ci', 'review', 'threads-resolved', 'protection'],
    });
  });
});
