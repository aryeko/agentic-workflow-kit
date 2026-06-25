import { describe, expect, it } from 'vitest';

import {
  createCredentialScope,
  issueEgressPolicy,
  planInjection,
  stableCanonicalStringify,
  type CredentialBindingTemplate,
  type CredentialGrant,
  type CredentialRef,
  type EgressPolicySource,
} from '../../../../src/index.js';

const hashText = (value: string): string => `digest:${value}`;

const baseRef = (overrides: Partial<CredentialRef> = {}): CredentialRef => ({
  id: 'registry-read',
  kind: 'registry-read',
  purpose: 'install private packages',
  secret: {
    id: 'secret-ref:digest:{"key":"NPM_TOKEN","source":"env"}',
    source: 'env',
    key: 'NPM_TOKEN',
  },
  allowedParties: ['runner', 'worker'],
  allowedPhases: ['dependency-install'],
  allowedHosts: ['registry.npmjs.org'],
  ttlSeconds: 120,
  policyDigest: 'digest:policy-block',
  ...overrides,
});

const baseScope = (overrides: Partial<ReturnType<typeof createCredentialScope>> = {}) =>
  createCredentialScope({
    runId: 'run-123',
    taskId: 'task-456',
    operationId: 'operation-789',
    party: 'worker',
    phase: 'dependency-install',
    commandPrefix: 'pnpm install ',
    expiresAt: '2026-06-22T10:02:00.000Z',
    grantEventId: 'grant-123',
    ...overrides,
  });

const baseBindings = (overrides: Partial<CredentialBindingTemplate> = {}): readonly CredentialBindingTemplate[] => [
  {
    credentialRefId: 'registry-read',
    mode: 'env',
    nameOrPath: 'NPM_TOKEN',
    ...overrides,
  },
];

const baseEgressSource = (overrides: Partial<EgressPolicySource> = {}): EgressPolicySource => ({
  defaultAction: 'deny',
  rules: [
    {
      credentialRefIds: ['registry-read'],
      protocols: ['https'],
      hosts: ['registry.npmjs.org'],
      ports: [443],
      phase: 'dependency-install',
      purpose: 'install private packages',
    },
  ],
  negativeProbes: [
    {
      host: 'github.com',
      protocol: 'https',
      expected: 'blocked',
      reason: 'non-registry egress denied',
    },
  ],
  requiredAttesters: [
    {
      point: 'execution-host',
      capability: 'egress-confinement',
      driverId: 'local-host',
    },
  ],
  ...overrides,
});

const basePlanDependencies = {
  hashText,
  now: '2026-06-22T10:01:00.000Z',
  issuedAt: '2026-06-22T10:00:00.000Z',
  host: 'registry.npmjs.org',
  command: 'pnpm install --frozen-lockfile',
  at: '2026-06-22T10:00:30.000Z',
  prevEventHash: 'digest:previous',
  auditSinkAvailable: true,
  resolveSecretMaterial: () => ({
    material: 'super-secret-value',
    materialHandle: 'memory://registry-read',
    fingerprintId: 'fp-registry-read',
  }),
};

describe('fnd-04-s2 injection planning', () => {
  it('returns an InjectionPlan with operation id, party, bindings, ref ids, egress policy, redaction set, and required planned audit event', () => {
    const scope = baseScope();
    const ref = baseRef();

    const planned = planInjection(
      {
        refs: [ref],
        scope,
        bindingTemplates: baseBindings(),
        egressSource: baseEgressSource(),
      },
      basePlanDependencies,
    );

    expect(planned.ok).toBe(true);
    expect(planned.ok && planned).toMatchObject({
      operationId: 'operation-789',
      party: 'worker',
      bindings: [
        {
          mode: 'env',
          nameOrPath: 'NPM_TOKEN',
          redactionLabel: '[REDACTED:credential:registry-read]',
        },
      ],
      credentialRefIds: ['registry-read'],
      redactionSet: {
        credentialRefIds: ['registry-read'],
        labels: {
          'registry-read': '[REDACTED:credential:registry-read]',
        },
        fingerprintIds: ['fp-registry-read'],
        expiresAt: '2026-06-22T10:02:00.000Z',
      },
      requiredAuditEvent: {
        type: 'CredentialUsePlanned',
        operationId: 'operation-789',
        party: 'worker',
        phase: 'dependency-install',
        credentialRefIds: ['registry-read'],
        egressPolicyId: expect.any(String),
        expiresAt: '2026-06-22T10:02:00.000Z',
      },
    });

    expect(planned.ok && planned.egressPolicy).toEqual(
      issueEgressPolicy(
        {
          refs: [ref],
          scope,
          egressSource: baseEgressSource(),
        },
        {
          hashText,
          at: '2026-06-22T10:00:30.000Z',
          prevEventHash: 'digest:previous',
        },
      ).value,
    );
    expect(planned.ok && planned.requiredAuditEvent.scopeDigest).toBe(hashText(stableCanonicalStringify(scope)));
  });

  it('fails closed as audit-write-unavailable before plan materialization when the audit sink is unavailable', () => {
    const planned = planInjection(
      {
        refs: [baseRef()],
        scope: baseScope(),
        bindingTemplates: baseBindings(),
        egressSource: baseEgressSource(),
      },
      {
        ...basePlanDependencies,
        auditSinkAvailable: false,
      },
    );

    expect(planned).toMatchObject({
      ok: false,
      reason: 'audit-write-unavailable',
      auditEvent: {
        reason: 'audit-write-unavailable',
      },
    });
  });

  it('denies worker plans containing Forge credentials with worker-forge-credential-denied', () => {
    const scope = baseScope({
      phase: 'push',
      commandPrefix: 'git push ',
    });
    const forgeRef = baseRef({
      id: 'forge-primary',
      kind: 'forge',
      purpose: 'push to remote',
      secret: {
        id: 'secret-ref:digest:{"key":"GITHUB_TOKEN","source":"env"}',
        source: 'env',
        key: 'GITHUB_TOKEN',
      },
      allowedPhases: ['push'],
      allowedHosts: ['github.com'],
    });

    const planned = planInjection(
      {
        refs: [forgeRef],
        scope,
        bindingTemplates: [
          {
            credentialRefId: 'forge-primary',
            mode: 'env',
            nameOrPath: 'GITHUB_TOKEN',
          },
        ],
        egressSource: {
          defaultAction: 'deny',
          rules: [
            {
              credentialRefIds: ['forge-primary'],
              protocols: ['https'],
              hosts: ['github.com'],
              phase: 'push',
              purpose: 'push to remote',
            },
          ],
          negativeProbes: [],
          requiredAttesters: [
            {
              point: 'execution-host',
              capability: 'egress-confinement',
              driverId: 'local-host',
            },
          ],
        },
      },
      {
        ...basePlanDependencies,
        host: 'github.com',
        command: 'git push origin HEAD',
      },
    );

    expect(planned).toMatchObject({
      ok: false,
      reason: 'worker-forge-credential-denied',
      auditEvent: {
        type: 'CredentialUseDenied',
        reason: 'worker-forge-credential-denied',
      },
    });
  });

  it('allows runner Forge credentials only for runner Forge phases and configured hosts', () => {
    const forgeRef = baseRef({
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
    });
    const scope = baseScope({
      party: 'runner',
      phase: 'push',
      commandPrefix: 'git push ',
    });
    const egressSource = {
      defaultAction: 'deny',
      rules: [
        {
          credentialRefIds: ['forge-primary'],
          protocols: ['https'],
          hosts: ['github.com'],
          phase: 'push',
          purpose: 'publish pull request updates',
        },
      ],
      negativeProbes: [],
      requiredAttesters: [
        {
          point: 'execution-host',
          capability: 'egress-confinement',
          driverId: 'local-host',
        },
      ],
    } satisfies EgressPolicySource;

    const allowed = planInjection(
      {
        refs: [forgeRef],
        scope,
        bindingTemplates: [
          {
            credentialRefId: 'forge-primary',
            mode: 'env',
            nameOrPath: 'GITHUB_TOKEN',
          },
        ],
        egressSource,
      },
      {
        ...basePlanDependencies,
        host: 'github.com',
        command: 'git push origin HEAD',
        resolveSecretMaterial: () => ({
          material: 'ghp_secret',
          materialHandle: 'memory://forge-primary',
          fingerprintId: 'fp-forge-primary',
        }),
      },
    );
    const deniedByPhase = planInjection(
      {
        refs: [forgeRef],
        scope: baseScope({
          party: 'runner',
          phase: 'dependency-install',
          commandPrefix: 'pnpm install ',
        }),
        bindingTemplates: [
          {
            credentialRefId: 'forge-primary',
            mode: 'env',
            nameOrPath: 'GITHUB_TOKEN',
          },
        ],
        egressSource,
      },
      {
        ...basePlanDependencies,
        host: 'github.com',
        command: 'pnpm install',
      },
    );
    const deniedByHost = planInjection(
      {
        refs: [forgeRef],
        scope,
        bindingTemplates: [
          {
            credentialRefId: 'forge-primary',
            mode: 'env',
            nameOrPath: 'GITHUB_TOKEN',
          },
        ],
        egressSource,
      },
      {
        ...basePlanDependencies,
        host: 'gitlab.com',
        command: 'git push origin HEAD',
      },
    );

    expect(allowed.ok).toBe(true);
    expect(deniedByPhase).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
      auditEvent: {
        reason: 'credential-scope-denied',
      },
    });
    expect(deniedByHost).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
      auditEvent: {
        reason: 'credential-scope-denied',
      },
    });
  });

  it.each([
    [
      'parties',
      {
        allowedParties: ['runner'],
      } satisfies CredentialGrant,
    ],
    [
      'phases',
      {
        allowedPhases: ['push'],
      } satisfies CredentialGrant,
    ],
    [
      'hosts',
      {
        allowedHosts: ['registry.npmjs.org', 'github.com'],
      } satisfies CredentialGrant,
    ],
    [
      'command prefix',
      {
        commandPrefix: 'pnpm ',
      } satisfies CredentialGrant,
    ],
    [
      'ttl',
      {
        expiresAt: '2026-06-22T10:03:00.000Z',
      } satisfies CredentialGrant,
    ],
    [
      'injection mode',
      {
        injectionModes: ['env', 'file'],
      } satisfies CredentialGrant,
    ],
    [
      'egress policy',
      {
        egressPolicyDigest: 'digest:other-policy',
      } satisfies CredentialGrant,
    ],
    [
      'credential kind',
      {
        credentialKinds: ['forge'],
      } satisfies CredentialGrant,
    ],
  ])('denies scoped grants that try to expand configured %s', (_label, grant) => {
    const planned = planInjection(
      {
        refs: [baseRef()],
        scope: baseScope(),
        bindingTemplates: baseBindings(),
        egressSource: baseEgressSource(),
        grant,
      },
      basePlanDependencies,
    );

    expect(planned).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
      auditEvent: {
        type: 'CredentialUseDenied',
        reason: 'credential-scope-denied',
      },
    });
  });

  it('accepts a scoped grant when it exactly matches the configured scope and binding constraints', () => {
    const planned = planInjection(
      {
        refs: [baseRef()],
        scope: baseScope(),
        bindingTemplates: baseBindings(),
        egressSource: baseEgressSource(),
        grant: {
          allowedParties: ['worker'],
          allowedPhases: ['dependency-install'],
          allowedHosts: ['registry.npmjs.org'],
          commandPrefix: 'pnpm install ',
          expiresAt: '2026-06-22T10:02:00.000Z',
          injectionModes: ['env'],
          credentialKinds: ['registry-read'],
          egressPolicyDigest: issueEgressPolicy(
            {
              refs: [baseRef()],
              scope: baseScope(),
              egressSource: baseEgressSource(),
            },
            {
              hashText,
              at: '2026-06-22T10:00:30.000Z',
              prevEventHash: 'digest:previous',
            },
          ).value.egressPolicyDigest,
        },
      },
      basePlanDependencies,
    );

    expect(planned.ok).toBe(true);
  });

  it('retains every configured required attester in the policy so release stays fail-closed', () => {
    const planned = planInjection(
      {
        refs: [baseRef()],
        scope: baseScope({
          commandPrefix: undefined,
        }),
        bindingTemplates: [
          {
            credentialRefId: 'registry-read',
            mode: 'file',
            nameOrPath: '/tmp/registry-read.token',
          },
        ],
        egressSource: baseEgressSource({
          requiredAttesters: [
            {
              point: 'execution-host',
              capability: 'egress-confinement',
              driverId: 'local-host',
            },
            {
              point: 'execution-host',
              capability: 'egress-confinement',
              driverId: 'missing-runtime',
            },
          ],
        }),
      },
      {
        ...basePlanDependencies,
        command: undefined,
        resolveSecretMaterial: () => ({
          material: 'super-secret-value',
          materialHandle: 'memory://registry-read',
          fingerprintId: 'fp-registry-read',
          tempFilePaths: ['/tmp/registry-read.token'],
        }),
      },
    );

    expect(planned.ok).toBe(true);
    expect(planned.ok && planned).toMatchObject({
      bindings: [
        {
          mode: 'file',
          nameOrPath: '/tmp/registry-read.token',
        },
      ],
      egressPolicy: {
        negativeProbeIds: [expect.any(String)],
        requiredAttesters: [
          {
            point: 'execution-host',
            capability: 'egress-confinement',
            driverId: 'local-host',
            scopeDigest: expect.any(String),
            egressPolicyDigest: expect.any(String),
          },
          {
            point: 'execution-host',
            capability: 'egress-confinement',
            driverId: 'missing-runtime',
            scopeDigest: expect.any(String),
            egressPolicyDigest: expect.any(String),
          },
        ],
      },
    });
    if (planned.ok) {
      for (const attester of planned.egressPolicy.requiredAttesters) {
        expect(Object.keys(attester)).toEqual(['point', 'capability', 'driverId', 'scopeDigest', 'egressPolicyDigest']);
      }
    }
  });

  it('denies when the credential scope allows a host but the configured egress policy does not', () => {
    const ref = baseRef({
      allowedHosts: ['registry.npmjs.org', 'npm.pkg.github.com'],
    });

    const planned = planInjection(
      {
        refs: [ref],
        scope: baseScope(),
        bindingTemplates: baseBindings(),
        egressSource: baseEgressSource(),
      },
      {
        ...basePlanDependencies,
        host: 'npm.pkg.github.com',
      },
    );

    expect(planned).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
  });

  it('fails closed with credential-ref-unresolved when secret material cannot be resolved for plan creation', () => {
    const planned = planInjection(
      {
        refs: [baseRef()],
        scope: baseScope(),
        bindingTemplates: baseBindings(),
        egressSource: baseEgressSource(),
      },
      {
        ...basePlanDependencies,
        resolveSecretMaterial: () => undefined,
      },
    );

    expect(planned).toMatchObject({
      ok: false,
      reason: 'credential-ref-unresolved',
      auditEvent: {
        reason: 'credential-ref-unresolved',
      },
    });
  });
});
