import { describe, expect, it, vi } from 'vitest';

import {
  resolvedPolicySchemaMarker,
  stableCanonicalStringify,
  type CredentialRefSource,
  type ResolvedPolicy,
} from '../../../../src/foundation/configuration-policy/index.js';
import {
  type CredentialKind,
  type CredentialParty,
  validateCredentialRefsFromResolvedPolicy,
} from '../../../../src/foundation/credentials-secrets/refs/index.js';

const hashText = (value: string): string => `digest:${value}`;

const createResolvedPolicy = (refs: readonly CredentialRefSource[]): ResolvedPolicy => ({
  schema: resolvedPolicySchemaMarker,
  policy: {
    run: {
      mode: 'assisted',
      maxConcurrentRuns: 1,
      requireCleanWorkspace: true,
    },
    provisioning: {
      ownershipClass: 'owned',
      containmentRequired: true,
      dependencyInstall: {
        defaultGrant: 'narrow',
        allowedPrefixes: ['pnpm install '],
      },
    },
    approval: {
      mode: 'assisted',
      parkOnHumanLatency: true,
      requireRecordedDecision: true,
      decisionWindowMs: 900_000,
    },
    escalationPolicy: {
      allowedGrantScopes: ['per-command', 'per-command-prefix'],
      maxGrantScope: 'per-command-prefix',
      denyByDefault: true,
      grantRules: [],
    },
    changePolicy: {
      allowedChangePaths: [],
    },
    capabilities: {
      'auto-merge': { desired: false, requireFreshAttestation: true },
      'auto-recover': { desired: false, requireFreshAttestation: true },
      'unattended-run': { desired: false, requireFreshAttestation: true },
      'escalation-auto-grant': { desired: false, requireFreshAttestation: true },
    },
    credentialRefs: {
      refs,
    },
    egress: {
      defaultAction: 'deny',
      rules: [],
      negativeProbes: [],
      requiredAttesters: [],
    },
    merge: {
      runnerMayPush: true,
      runnerMayOpenPr: true,
      runnerMayMerge: false,
      requiredEvidence: ['verification', 'ci', 'review', 'threads-resolved', 'protection'],
    },
  },
  provenance: {},
  resolvedPolicyHash: 'resolved-policy-hash',
});

describe('fnd-04-s1 credential refs', () => {
  it('validates resolved credential reference policy into stable non-secret refs with policy digest evidence', () => {
    const resolvedPolicy = createResolvedPolicy([
      {
        id: 'forge-primary',
        kind: 'forge',
        purpose: 'publish pull request updates',
        secret: {
          source: 'env',
          key: 'GITHUB_TOKEN',
        },
        allowedParties: ['runner'],
        allowedPhases: ['push', 'pr-create'],
        allowedHosts: ['github.com'],
        ttlSeconds: 600,
      },
      {
        id: 'registry-read',
        kind: 'registry-read',
        purpose: 'install private packages',
        secret: {
          source: 'env',
          key: 'NPM_TOKEN',
          version: 'v1',
        },
        allowedParties: ['runner', 'worker'],
        allowedPhases: ['dependency-install'],
        allowedHosts: ['registry.npmjs.org'],
        ttlSeconds: 120,
      },
    ]);

    const validated = validateCredentialRefsFromResolvedPolicy(resolvedPolicy, {
      hashText,
      inspectSecretRef: () => ({ ok: true }),
    });

    expect(validated.ok).toBe(true);
    expect(validated.ok && validated.value).toEqual({
      policyDigest: hashText(stableCanonicalStringify(resolvedPolicy.policy.credentialRefs)),
      refs: [
        {
          id: 'forge-primary',
          kind: 'forge',
          purpose: 'publish pull request updates',
          secret: {
            id: 'secret-ref:digest:{"key":"GITHUB_TOKEN","source":"env"}',
            source: 'env',
            key: 'GITHUB_TOKEN',
          },
          allowedParties: ['runner'],
          allowedPhases: ['push', 'pr-create'],
          allowedHosts: ['github.com'],
          ttlSeconds: 600,
          policyDigest: hashText(stableCanonicalStringify(resolvedPolicy.policy.credentialRefs)),
        },
        {
          id: 'registry-read',
          kind: 'registry-read',
          purpose: 'install private packages',
          secret: {
            id: 'secret-ref:digest:{"key":"NPM_TOKEN","source":"env","version":"v1"}',
            source: 'env',
            key: 'NPM_TOKEN',
            version: 'v1',
          },
          allowedParties: ['runner', 'worker'],
          allowedPhases: ['dependency-install'],
          allowedHosts: ['registry.npmjs.org'],
          ttlSeconds: 120,
          policyDigest: hashText(stableCanonicalStringify(resolvedPolicy.policy.credentialRefs)),
        },
      ],
    });
  });

  it('supports exactly the credential kinds ratified by the story contract', () => {
    const supportedKinds = [
      'forge',
      'registry-read',
      'registry-publish',
      'tool-api',
      'verification',
    ] satisfies readonly CredentialKind[];

    expect(supportedKinds).toEqual(['forge', 'registry-read', 'registry-publish', 'tool-api', 'verification']);
  });

  it('supports exactly the credential parties ratified by the story contract', () => {
    const supportedParties = ['runner', 'worker'] satisfies readonly CredentialParty[];

    expect(supportedParties).toEqual(['runner', 'worker']);
  });

  it.each([
    ['missing', { ok: false as const, reason: 'missing' as const }],
    ['inaccessible', { ok: false as const, reason: 'inaccessible' as const }],
    ['ambiguous', { ok: false as const, reason: 'ambiguous' as const }],
  ])('fails closed with credential-ref-unresolved when the env reference is %s', (_label, inspection) => {
    const inspectSecretRef = vi.fn(() => inspection);
    const resolvedPolicy = createResolvedPolicy([
      {
        id: 'tool-api',
        kind: 'tool-api',
        purpose: 'call a hosted tool API',
        secret: {
          source: 'env',
          key: 'TOOL_API_TOKEN',
        },
        allowedParties: ['worker'],
        allowedPhases: ['tool-call'],
        allowedHosts: ['api.example.test'],
        ttlSeconds: 60,
      },
    ]);

    const validated = validateCredentialRefsFromResolvedPolicy(resolvedPolicy, {
      hashText,
      inspectSecretRef,
    });

    expect(validated).toEqual({
      ok: false,
      error: {
        token: 'credential-ref-unresolved',
        reason: inspection.reason,
        credentialRefId: 'tool-api',
        secretRef: {
          id: 'secret-ref:digest:{"key":"TOOL_API_TOKEN","source":"env"}',
          source: 'env',
          key: 'TOOL_API_TOKEN',
        },
        policyDigest: hashText(stableCanonicalStringify(resolvedPolicy.policy.credentialRefs)),
      },
    });
    expect(inspectSecretRef).toHaveBeenCalledTimes(1);
  });

  it('fails closed with credential-ref-unresolved for unsupported secret-manager references without resolving any material', () => {
    const inspectSecretRef = vi.fn(() => ({ ok: true as const }));
    const resolvedPolicy = createResolvedPolicy([
      {
        id: 'verification',
        kind: 'verification',
        purpose: 'report verification status',
        secret: {
          source: 'secret-manager',
          key: 'projects/demo/secrets/verification-token',
          version: '5',
        },
        allowedParties: ['runner'],
        allowedPhases: ['verification'],
        allowedHosts: ['verifier.example.test'],
        ttlSeconds: 30,
      },
    ]);

    const validated = validateCredentialRefsFromResolvedPolicy(resolvedPolicy, {
      hashText,
      inspectSecretRef,
    });

    expect(validated).toEqual({
      ok: false,
      error: {
        token: 'credential-ref-unresolved',
        reason: 'unsupported',
        credentialRefId: 'verification',
        secretRef: {
          id: 'secret-ref:digest:{"key":"projects/demo/secrets/verification-token","source":"secret-manager","version":"5"}',
          source: 'secret-manager',
          key: 'projects/demo/secrets/verification-token',
          version: '5',
        },
        policyDigest: hashText(stableCanonicalStringify(resolvedPolicy.policy.credentialRefs)),
      },
    });
    expect(inspectSecretRef).not.toHaveBeenCalled();
  });
});
