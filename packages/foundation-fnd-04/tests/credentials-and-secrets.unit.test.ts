import type { PolicyLayer } from '@kit-vnext/foundation-fnd-01';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  buildClosedInjectionEnvironment,
  createCredentialsAndSecrets,
  credentialAuditEventHash,
  credentialRefFromSource,
  type AuditWriter,
  type CredentialAuditEvent,
  type CredentialClock,
  type CredentialRef,
  type CredentialScope,
  type EgressCapabilityAttestation,
  type EgressPolicy,
  type IdGenerator,
  type RedactedInput,
  type SecretResolver,
} from '../src/index.js';

const occurredAt = '2026-06-19T09:00:00.000Z';
const later = '2026-06-19T09:05:00.000Z';
const expired = '2026-06-19T08:59:00.000Z';
const placeholderMaterial = 'placeholder-material-alpha/"one\\two two';
const encodedPlaceholder = encodeURIComponent(placeholderMaterial);
const doubleEncodedPlaceholder = encodeURIComponent(encodedPlaceholder);
const base64Placeholder = Buffer.from(placeholderMaterial, 'utf8').toString('base64');
const jsonEscapedPlaceholder = JSON.stringify(placeholderMaterial).slice(1, -1);

class FixedClock implements CredentialClock {
  constructor(private readonly iso: string = occurredAt) {}

  now(): Date {
    return new Date(this.iso);
  }
}

class SequenceIds implements IdGenerator {
  #next = 0;

  nextId(purpose: string): string {
    this.#next += 1;
    return `${purpose}-${this.#next}`;
  }
}

const sourceRef = (overrides: Partial<PolicyLayer['credentialRefs']['refs'][number]> = {}): CredentialRef =>
  credentialRefFromSource({
    id: 'forge-runner',
    kind: 'forge',
    purpose: 'GitHub Forge operations',
    secret: { source: 'env', key: 'FORGE_RUNNER_REF', version: 'v1' },
    allowedParties: ['runner'],
    allowedPhases: ['merge'],
    allowedHosts: ['github.com'],
    ttlSeconds: 300,
    ...overrides,
  });

const registryRef = (): CredentialRef =>
  sourceRef({
    id: 'registry-read',
    kind: 'registry-read',
    purpose: 'package registry read',
    secret: { source: 'env', key: 'REGISTRY_READ_REF' },
    allowedParties: ['worker'],
    allowedPhases: ['install'],
    allowedHosts: ['registry.npmjs.org'],
  });

const githubWorkerRef = (): CredentialRef =>
  sourceRef({
    id: 'github-worker',
    kind: 'tool-api',
    purpose: 'GitHub API read',
    secret: { source: 'env', key: 'GITHUB_WORKER_REF' },
    allowedParties: ['worker'],
    allowedPhases: ['install'],
    allowedHosts: ['github.com'],
  });

const scope = (overrides: Partial<CredentialScope> = {}): CredentialScope => ({
  runId: 'run-1',
  taskId: 'task-1',
  operationId: 'operation-1',
  party: 'runner',
  phase: 'merge',
  hosts: ['github.com'],
  expiresAt: later,
  grantEventId: 'grant-1',
  ...overrides,
});

const egressSource = (ref: CredentialRef): PolicyLayer['egress'] => ({
  defaultAction: 'deny',
  rules: [
    {
      credentialRefIds: [ref.id],
      protocols: ['https'],
      hosts: [...ref.allowedHosts],
      ports: [443],
      phase: ref.allowedPhases[0] ?? 'phase',
      purpose: ref.purpose,
    },
  ],
  negativeProbes: [{ host: 'blocked.example.test', protocol: 'https', expected: 'blocked', reason: 'default-deny' }],
  requiredAttesters: [{ point: 'execution-host', capability: 'egress-confinement', driverId: 'local-host' }],
});

const secretResolverFor = (material: string): SecretResolver => ({
  resolve: (ref) => ({
    ok: true,
    value: {
      materialHandle: `handle:${ref.id}`,
      material,
    },
  }),
});

const secretResolver = secretResolverFor(placeholderMaterial);

const successfulAuditWriter = (auditEvents: CredentialAuditEvent[]): AuditWriter => ({
  append: (event) => {
    auditEvents.push(event);
    return { ok: true, value: undefined };
  },
});

const variantSurvivorsFor = (secret: string, key = 'REGISTRY_READ_REF'): readonly string[] => {
  const uriEncoded = encodeURIComponent(secret);
  return [
    secret,
    uriEncoded,
    encodeURIComponent(uriEncoded),
    JSON.stringify(secret).slice(1, -1),
    Buffer.from(secret, 'utf8').toString('base64'),
    `Bearer ${secret}`,
    `Authorization: Bearer ${secret}`,
    `${key}=${secret}`,
    `export ${key}=${secret}`,
  ];
};

const embeddedSecretVariants = (secret: string, value: RedactedInput): RedactedInput => {
  const uriEncoded = encodeURIComponent(secret);
  const doubleEncoded = encodeURIComponent(uriEncoded);
  const jsonEscaped = JSON.stringify(secret).slice(1, -1);
  const base64 = Buffer.from(secret, 'utf8').toString('base64');

  return {
    [`raw-key-${secret}`]: value,
    nested: [
      { [`uri-key-${uriEncoded}`]: `uri=${uriEncoded}` },
      { [`double-uri-key-${doubleEncoded}`]: `redirect=${doubleEncoded}` },
      { [`json-key-${jsonEscaped}`]: `{"credential":"${jsonEscaped}"}` },
      { [`base64-key-${base64}`]: `payload:${base64}` },
      {
        shell: `REGISTRY_READ_REF=${secret}`,
        exportedShell: `export REGISTRY_READ_REF=${secret}`,
        bearer: `Authorization: Bearer ${secret}`,
      },
    ],
  };
};

const redactedInputArbitrary: fc.Arbitrary<RedactedInput> = fc.letrec((tie) => ({
  value: fc.oneof(
    { maxDepth: 3 },
    fc.string({ maxLength: 24 }),
    fc.integer({ min: -1000, max: 1000 }),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie('value') as fc.Arbitrary<RedactedInput>, { maxLength: 3 }),
    fc.dictionary(
      fc.string({ minLength: 1, maxLength: 12 }).filter((key) => key !== '__proto__'),
      tie('value') as fc.Arbitrary<RedactedInput>,
      { maxKeys: 3 },
    ),
  ),
})).value as fc.Arbitrary<RedactedInput>;

const contractFor = (
  options: {
    readonly ref?: CredentialRef;
    readonly attestations?: readonly EgressCapabilityAttestation[];
    readonly auditEvents?: CredentialAuditEvent[];
    readonly auditWriter?: AuditWriter | null;
    readonly egress?: PolicyLayer['egress'];
    readonly injectionModeFor?: Parameters<typeof createCredentialsAndSecrets>[0]['injectionModeFor'];
    readonly secretMaterial?: string;
    readonly secretResolver?: SecretResolver;
    readonly tempFileRemover?: Parameters<typeof createCredentialsAndSecrets>[0]['tempFileRemover'];
    readonly runnerForgePhases?: readonly string[];
    readonly attesterMetadata?: Parameters<typeof createCredentialsAndSecrets>[0]['attesterMetadata'];
  } = {},
) => {
  const auditEvents = options.auditEvents ?? [];
  const auditWriter =
    options.auditWriter === null ? undefined : (options.auditWriter ?? successfulAuditWriter(auditEvents));
  return createCredentialsAndSecrets({
    clock: new FixedClock(),
    idGenerator: new SequenceIds(),
    fingerprintKey: 'test-fingerprint-key',
    secretResolver:
      options.secretResolver ?? (options.secretMaterial ? secretResolverFor(options.secretMaterial) : secretResolver),
    egress: options.egress ?? egressSource(options.ref ?? sourceRef()),
    attesterMetadata: options.attesterMetadata ?? {
      'local-host': { platform: 'darwin-arm64', driverVersion: '1.0.0' },
    },
    attestations: options.attestations ?? [],
    injectionModeFor: options.injectionModeFor,
    auditWriter: auditWriter as AuditWriter,
    tempFileRemover: options.tempFileRemover,
    runnerForgePhases: options.runnerForgePhases,
  });
};

const matchingAttestation = (
  policy: EgressPolicy,
  overrides: Partial<EgressCapabilityAttestation> = {},
): EgressCapabilityAttestation => ({
  eventId: 'attestation-1',
  capability: 'egress-confinement',
  result: 'positive',
  point: 'execution-host',
  driverId: policy.requiredAttesters[0]?.driverId ?? 'local-host',
  scopeDigest: policy.requiredAttesters[0]?.scopeDigest ?? 'scope',
  egressPolicyDigest: policy.egressPolicyDigest,
  freshnessKey: policy.freshnessKey,
  platform: policy.requiredAttesters[0]?.platform ?? 'darwin-arm64',
  driverVersion: policy.requiredAttesters[0]?.driverVersion ?? '1.0.0',
  expiresAt: later,
  evidenceRef: 'artifact:egress-attestation',
  negativeProbeIds: policy.negativeProbes.map((probe) => probe.id),
  ...overrides,
});

describe('Credentials & Secrets', () => {
  it('property-tests that no policy or grant can inject Forge credentials into a worker', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('runner' as const, 'worker' as const), { minLength: 1, maxLength: 2 }),
        fc.array(fc.string({ minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 4 }),
        fc.string({ minLength: 1, maxLength: 12 }),
        (allowedParties, allowedPhases, phase) => {
          const ref = sourceRef({ allowedParties, allowedPhases });
          const result = contractFor({ ref }).planInjection([ref], scope({ party: 'worker', phase }));

          expect(result).toMatchObject({
            ok: false,
            reason: 'worker-forge-credential-denied',
            auditEvent: { type: 'CredentialUseDenied' },
          });
        },
      ),
      { seed: 20_260_619, numRuns: 100 },
    );
  });

  it('plans scoped injection only for allowed party, phase, and fresh egress attestation', () => {
    const forge = sourceRef();
    const runnerScope = scope();
    const policyResult = contractFor({ ref: forge }).issueEgressPolicy([forge], runnerScope);
    expect(policyResult).toMatchObject({ defaultAction: 'deny' });
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }

    const contract = contractFor({ ref: forge, attestations: [matchingAttestation(policyResult)] });
    const plan = contract.planInjection([forge], runnerScope);

    expect(plan).toMatchObject({
      ok: true,
      party: 'runner',
      credentialRefIds: ['forge-runner'],
      bindings: [{ mode: 'env', nameOrPath: 'KIT_CREDENTIAL_FORGE_RUNNER' }],
      requiredAuditEvent: { type: 'CredentialUsePlanned' },
    });
    if (!plan.ok) {
      throw new Error('expected runner plan');
    }
    expect(JSON.stringify(plan)).not.toContain(placeholderMaterial);
    expect(plan.redactionSet.state).toBe('planned');

    const wrongPhase = contract.planInjection([forge], scope({ phase: 'install' }));
    expect(wrongPhase).toMatchObject({ ok: false, reason: 'credential-scope-denied' });
  });

  it('keeps worker environments closed and injects only typed non-Forge bindings', () => {
    const registry = registryRef();
    const workerScope = scope({
      party: 'worker',
      phase: 'install',
      operationId: 'operation-worker',
      hosts: ['registry.npmjs.org'],
    });
    const policyResult = contractFor({ ref: registry }).issueEgressPolicy([registry], workerScope);
    expect(policyResult).toMatchObject({ audience: 'worker' });
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }

    const contract = contractFor({ ref: registry, attestations: [matchingAttestation(policyResult)] });
    const plan = contract.planInjection([registry], workerScope);
    expect(plan).toMatchObject({ ok: true, party: 'worker' });
    if (!plan.ok) {
      throw new Error('expected worker plan');
    }

    const env = buildClosedInjectionEnvironment(plan, {
      PATH: '/usr/bin',
      GITHUB_TOKEN: 'ambient-token-placeholder',
      REGISTRY_READ_REF: 'ambient-registry-placeholder',
    });

    expect(env).toEqual({ KIT_CREDENTIAL_REGISTRY_READ: '[REDACTED:credential:registry-read]' });
    expect(JSON.stringify(env)).not.toContain('GITHUB_TOKEN');
    expect(JSON.stringify(env)).not.toContain('ambient');
  });

  it('denies mixed host injection when each credential allows only one scoped host', () => {
    const github = githubWorkerRef();
    const registry = registryRef();
    const workerScope = scope({
      party: 'worker',
      phase: 'install',
      operationId: 'operation-mixed-hosts',
      hosts: ['github.com', 'registry.npmjs.org'],
    });
    const egress: PolicyLayer['egress'] = {
      ...egressSource(github),
      rules: [
        {
          credentialRefIds: [github.id],
          protocols: ['https'],
          hosts: ['github.com'],
          ports: [443],
          phase: 'install',
          purpose: github.purpose,
        },
        {
          credentialRefIds: [registry.id],
          protocols: ['https'],
          hosts: ['registry.npmjs.org'],
          ports: [443],
          phase: 'install',
          purpose: registry.purpose,
        },
      ],
    };
    const contract = contractFor({ ref: github, egress });

    expect(contract.issueEgressPolicy([github, registry], workerScope)).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
    expect(contract.planInjection([github, registry], workerScope)).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
      auditEvent: { type: 'CredentialUseDenied', reason: 'credential-scope-denied' },
    });
  });

  it('denies missing, stale, mismatched, and partial egress attestations', () => {
    const forge = sourceRef();
    const runnerScope = scope();
    const policyResult = contractFor({ ref: forge }).issueEgressPolicy([forge], runnerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }

    const cases: readonly EgressCapabilityAttestation[][] = [
      [],
      [matchingAttestation(policyResult, { expiresAt: expired })],
      [matchingAttestation(policyResult, { egressPolicyDigest: 'sha256:mismatch' })],
      [matchingAttestation(policyResult, { negativeProbeIds: [] })],
    ];

    for (const attestations of cases) {
      expect(contractFor({ ref: forge, attestations }).planInjection([forge], runnerScope)).toMatchObject({
        ok: false,
        reason: 'egress-policy-unattested',
      });
    }
  });

  it('denies missing, empty, and partial egress policies before injection or resolution', () => {
    const forge = sourceRef();
    const runnerScope = scope();
    const emptyPolicy: PolicyLayer['egress'] = {
      defaultAction: 'deny',
      rules: [],
      negativeProbes: [],
      requiredAttesters: [],
    };
    const partialPolicy: PolicyLayer['egress'] = {
      ...egressSource(forge),
      rules: [{ ...egressSource(forge).rules[0], credentialRefIds: ['different-ref'] }],
    };

    for (const egress of [emptyPolicy, partialPolicy]) {
      const contract = contractFor({ ref: forge, egress });
      expect(contract.issueEgressPolicy([forge], runnerScope)).toMatchObject({
        ok: false,
        reason: 'egress-policy-unattested',
      });
      expect(contract.planInjection([forge], runnerScope)).toMatchObject({
        ok: false,
        reason: 'egress-policy-unattested',
      });
      expect(contract.resolveCredential(forge, runnerScope)).toMatchObject({
        ok: false,
        reason: 'egress-policy-unattested',
      });
    }
  });

  it('enforces TTL, command-prefix, and operation host bounds', () => {
    const forge: CredentialRef = { ...sourceRef({ ttlSeconds: 1 }), allowedCommandPrefixes: ['gh pr'] };
    const contract = contractFor({ ref: forge });

    expect(contract.planInjection([forge], scope({ expiresAt: '2026-06-19T10:00:00.000Z' }))).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
    expect(contract.planInjection([forge], scope({ hosts: ['evil.example.test'] }))).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
    expect(contract.planInjection([forge], scope())).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
    expect(contract.planInjection([forge], scope({ commandPrefix: 'git push' }))).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
  });

  it('allows matching command prefixes and documents unknown attester metadata as policy data', () => {
    const forge: CredentialRef = { ...sourceRef(), allowedCommandPrefixes: ['gh pr'] };
    const runnerScope = scope({ commandPrefix: 'gh pr view 113' });
    const egress: PolicyLayer['egress'] = {
      ...egressSource(forge),
      requiredAttesters: [{ point: 'execution-host', capability: 'egress-confinement', driverId: 'unknown-host' }],
    };
    const policyResult = contractFor({ ref: forge, egress, attesterMetadata: {} }).issueEgressPolicy(
      [forge],
      runnerScope,
    );
    expect(policyResult).toMatchObject({
      audience: 'runner',
      requiredAttesters: [{ platform: 'unknown', driverVersion: 'unknown' }],
    });
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }

    const contract = contractFor({
      ref: forge,
      egress,
      attesterMetadata: {},
      attestations: [matchingAttestation(policyResult)],
    });
    expect(contract.planInjection([forge], runnerScope)).toMatchObject({ ok: true });
    expect(contract.resolveCredential(forge, runnerScope)).toMatchObject({ ok: true });
  });

  it('denies resolver access when scope or attestation gates are closed', () => {
    const forge = sourceRef();
    const runnerScope = scope();
    const policyResult = contractFor({ ref: forge }).issueEgressPolicy([forge], runnerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }
    const contract = contractFor({ ref: forge });

    expect(contract.resolveCredential(forge, scope({ hosts: ['evil.example.test'] }))).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
    expect(contract.resolveCredential(forge, runnerScope)).toMatchObject({
      ok: false,
      reason: 'egress-policy-unattested',
    });
  });

  it('denies egress when rules assign an operation host outside the referenced credential policy', () => {
    const github = sourceRef({ id: 'github-runner', allowedHosts: ['github.com'] });
    const registry = registryRef();
    const runnerScope = scope({ hosts: ['registry.npmjs.org'] });
    const egress: PolicyLayer['egress'] = {
      ...egressSource(github),
      rules: [
        {
          credentialRefIds: [github.id],
          protocols: ['https'],
          hosts: ['registry.npmjs.org'],
          phase: 'merge',
          purpose: 'misbound host',
        },
      ],
    };

    expect(contractFor({ ref: github, egress }).issueEgressPolicy([github, registry], runnerScope)).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
  });

  it('makes plan-time redaction explicit and denies capture until material is resolved', () => {
    const registry = registryRef();
    const workerScope = scope({
      party: 'worker',
      phase: 'install',
      operationId: 'operation-plan-redact',
      hosts: ['registry.npmjs.org'],
    });
    const policyResult = contractFor({ ref: registry }).issueEgressPolicy([registry], workerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }
    const contract = contractFor({ ref: registry, attestations: [matchingAttestation(policyResult)] });
    const plan = contract.planInjection([registry], workerScope);
    expect(plan).toMatchObject({ ok: true });
    if (!plan.ok) {
      throw new Error('expected plan');
    }

    expect(plan.redactionSet).toMatchObject({ state: 'planned' });
    expect(contract.redact(`token=${placeholderMaterial}`, plan.redactionSet)).toMatchObject({
      ok: false,
      reason: 'redaction-unavailable',
    });
  });

  it('denies plan and resolve when audit writing is not configured', () => {
    const registry = registryRef();
    const workerScope = scope({
      party: 'worker',
      phase: 'install',
      operationId: 'operation-audit-missing',
      hosts: ['registry.npmjs.org'],
    });
    const policyResult = contractFor({ ref: registry }).issueEgressPolicy([registry], workerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }

    const contract = contractFor({
      ref: registry,
      attestations: [matchingAttestation(policyResult)],
      auditWriter: null,
    });

    expect(contract.planInjection([registry], workerScope)).toMatchObject({
      ok: false,
      reason: 'audit-write-unavailable',
      auditEvent: { type: 'CredentialUseDenied', reason: 'audit-write-unavailable' },
    });
    expect(contract.resolveCredential(registry, workerScope)).toMatchObject({
      ok: false,
      reason: 'audit-write-unavailable',
      auditEvent: { type: 'CredentialUseDenied', reason: 'audit-write-unavailable' },
    });
  });

  it('denies use on failed audit append without advancing the audit chain', () => {
    const auditEvents: CredentialAuditEvent[] = [];
    const registry = registryRef();
    const workerScope = scope({
      party: 'worker',
      phase: 'install',
      operationId: 'operation-audit-failure',
      hosts: ['registry.npmjs.org'],
    });
    const policyResult = contractFor({ ref: registry }).issueEgressPolicy([registry], workerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }
    let appendAttempt = 0;
    const auditWriter: AuditWriter = {
      append: (event) => {
        appendAttempt += 1;
        if (appendAttempt === 2) {
          return { ok: false, error: 'audit-write-unavailable' };
        }
        auditEvents.push(event);
        return { ok: true, value: undefined };
      },
    };
    const contract = contractFor({
      ref: registry,
      attestations: [matchingAttestation(policyResult)],
      auditWriter,
    });

    const firstPlan = contract.planInjection([registry], workerScope);
    expect(firstPlan).toMatchObject({ ok: true });
    if (!firstPlan.ok) {
      throw new Error('expected first plan');
    }
    const failedResolve = contract.resolveCredential(registry, workerScope);
    expect(failedResolve).toMatchObject({
      ok: false,
      reason: 'audit-write-unavailable',
      auditEvent: {
        type: 'CredentialUseDenied',
        reason: 'audit-write-unavailable',
        prevEventHash: firstPlan.requiredAuditEvent.eventHash,
      },
    });

    const secondPlan = contract.planInjection([registry], workerScope);
    expect(secondPlan).toMatchObject({ ok: true });
    if (!secondPlan.ok) {
      throw new Error('expected second plan');
    }
    expect(auditEvents.map((event) => event.type)).toEqual(['CredentialUsePlanned', 'CredentialUsePlanned']);
    expect(secondPlan.requiredAuditEvent.prevEventHash).toBe(firstPlan.requiredAuditEvent.eventHash);
  });

  it('recursively redacts structured data, process output, and text artifacts across encodings', () => {
    const registry = registryRef();
    const workerScope = scope({
      party: 'worker',
      phase: 'install',
      operationId: 'operation-redact',
      hosts: ['registry.npmjs.org'],
    });
    const policyResult = contractFor({ ref: registry }).issueEgressPolicy([registry], workerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }
    const contract = contractFor({ ref: registry, attestations: [matchingAttestation(policyResult)] });
    const resolved = contract.resolveCredential(registry, workerScope);
    expect(resolved).toMatchObject({ ok: true, auditEvent: { type: 'CredentialUseStarted' } });
    if (!resolved.ok) {
      throw new Error('expected resolved credential');
    }
    expect(resolved.redactionSet.state).toBe('materialized');

    const redacted = contract.redact(
      {
        nested: {
          commandLine: `REGISTRY_READ_REF=${placeholderMaterial} npm install`,
          output: { stream: 'stderr', text: `Authorization: Bearer ${placeholderMaterial}` },
          shellQuoted: `export REGISTRY_READ_REF="${placeholderMaterial}"`,
        },
        artifacts: [
          {
            artifactId: 'artifact-1',
            mediaType: 'application/json',
            text: `{"url":"https://registry.npmjs.org?token=${encodedPlaceholder}"}`,
          },
          {
            artifactId: 'artifact-2',
            mediaType: 'application/json',
            text: `{"escaped":"${jsonEscapedPlaceholder}","double":"${doubleEncodedPlaceholder}"}`,
          },
          {
            artifactId: 'artifact-3',
            mediaType: 'text/plain',
            text: `encoded payload ${base64Placeholder}`,
          },
        ],
        [`key-${placeholderMaterial}`]: `value-${placeholderMaterial}`,
        [`encoded-key-${encodedPlaceholder}`]: `double-${doubleEncodedPlaceholder}`,
        [`base64-key-${base64Placeholder}`]: `json-${jsonEscapedPlaceholder}`,
      },
      resolved.redactionSet,
    );

    expect(redacted).toMatchObject({ ok: true, auditEvent: { type: 'RedactionApplied' } });
    if (!redacted.ok) {
      throw new Error('expected redacted value');
    }
    const output = JSON.stringify(redacted.value);
    expect(output).not.toContain(placeholderMaterial);
    expect(output).not.toContain(encodedPlaceholder);
    expect(output).not.toContain(doubleEncodedPlaceholder);
    expect(output).not.toContain(base64Placeholder);
    expect(output).not.toContain(jsonEscapedPlaceholder);
    expect(output).toContain('[REDACTED:credential:registry-read]');
    expect(redacted.replacementCount).toBeGreaterThanOrEqual(11);
    expect(contract.redact(null, resolved.redactionSet)).toMatchObject({ ok: true, value: null, replacementCount: 0 });
  });

  it('property-tests that no raw or encoded secret survives nested key and value redaction', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/[A-Z0-9]{8,24}/).map((token) => `SECRET_${token}_VALUE/"\\two words`),
        redactedInputArbitrary,
        (secret, generatedValue) => {
          const registry = registryRef();
          const workerScope = scope({
            party: 'worker',
            phase: 'install',
            operationId: `operation-redact-${secret.length}`,
            hosts: ['registry.npmjs.org'],
          });
          const policyResult = contractFor({ ref: registry, secretMaterial: secret }).issueEgressPolicy(
            [registry],
            workerScope,
          );
          if ('ok' in policyResult) {
            throw new Error('expected egress policy');
          }
          const contract = contractFor({
            ref: registry,
            attestations: [matchingAttestation(policyResult)],
            secretMaterial: secret,
          });
          const resolved = contract.resolveCredential(registry, workerScope);
          if (!resolved.ok) {
            throw new Error('expected resolved credential');
          }

          const redacted = contract.redact(embeddedSecretVariants(secret, generatedValue), resolved.redactionSet);
          if (!redacted.ok) {
            throw new Error('expected redacted value');
          }
          const serialized = JSON.stringify(redacted.value);

          for (const survivor of variantSurvivorsFor(secret)) {
            expect(serialized).not.toContain(survivor);
          }
        },
      ),
      { seed: 20_260_619, numRuns: 75 },
    );
  });

  it('redacts unencoded materials without adding URL variants', () => {
    const registry = registryRef();
    const workerScope = scope({
      party: 'worker',
      phase: 'install',
      operationId: 'operation-redact-unencoded',
      hosts: ['registry.npmjs.org'],
    });
    const policyResult = contractFor({ ref: registry }).issueEgressPolicy([registry], workerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }
    const contract = contractFor({
      ref: registry,
      attestations: [matchingAttestation(policyResult)],
      secretResolver: {
        resolve: (ref) => ({ ok: true, value: { materialHandle: `handle:${ref.id}`, material: 'plainTOKEN' } }),
      },
    });
    const resolved = contract.resolveCredential(registry, workerScope);
    expect(resolved).toMatchObject({ ok: true });
    if (!resolved.ok) {
      throw new Error('expected resolved credential');
    }

    expect(contract.redact('plainTOKEN', resolved.redactionSet)).toMatchObject({
      ok: true,
      value: '[REDACTED:credential:registry-read]',
    });
  });

  it('records tamper-evident audit start, deny, finish, and destroy invariants without material leakage', () => {
    const auditEvents: CredentialAuditEvent[] = [];
    const forge = sourceRef();
    const runnerScope = scope({ operationId: 'operation-audit' });
    const policyResult = contractFor({ ref: forge }).issueEgressPolicy([forge], runnerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }
    const contract = contractFor({
      ref: forge,
      attestations: [matchingAttestation(policyResult)],
      auditEvents,
    });

    const denied = contract.planInjection([forge], scope({ party: 'worker', operationId: 'operation-denied' }));
    expect(denied).toMatchObject({ ok: false, auditEvent: { type: 'CredentialUseDenied' } });

    const resolved = contract.resolveCredential(forge, runnerScope);
    expect(resolved).toMatchObject({ ok: true, auditEvent: { type: 'CredentialUseStarted' } });
    const finished = contract.finishCredentialUse('operation-audit', { result: 'success', providerStatus: 'ok' });
    const destroyed = contract.destroy('operation-audit');

    expect(finished).toMatchObject({ type: 'CredentialUseFinished', destroyed: false });
    expect(destroyed).toMatchObject({
      type: 'CredentialMaterialDestroyed',
      tempFilesRemoved: true,
      memoryHandlesDropped: true,
    });
    expect(auditEvents.map((event) => event.type)).toEqual([
      'CredentialUseDenied',
      'CredentialUseStarted',
      'CredentialUseFinished',
      'CredentialMaterialDestroyed',
    ]);

    for (const [index, event] of auditEvents.entries()) {
      expect(event.eventHash).toBe(credentialAuditEventHash(event));
      if (index > 0) {
        expect(event.prevEventHash).toBe(auditEvents[index - 1]?.eventHash);
      }
    }

    const serialized = JSON.stringify({ auditEvents, resolved, finished, destroyed });
    expect(serialized).not.toContain(placeholderMaterial);
    expect(serialized).not.toContain(encodedPlaceholder);
  });

  it('does not report file injection cleanup success without a remover boundary', () => {
    const registry = registryRef();
    const workerScope = scope({
      party: 'worker',
      phase: 'install',
      operationId: 'operation-file-cleanup',
      hosts: ['registry.npmjs.org'],
    });
    const policyResult = contractFor({ ref: registry }).issueEgressPolicy([registry], workerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }
    const contract = contractFor({
      ref: registry,
      attestations: [matchingAttestation(policyResult)],
      injectionModeFor: () => 'file',
    });

    const resolved = contract.resolveCredential(registry, workerScope);
    expect(resolved).toMatchObject({ ok: true });
    const destroyed = contract.destroy('operation-file-cleanup');

    expect(destroyed).toMatchObject({
      type: 'CredentialMaterialDestroyed',
      tempFilesRemoved: false,
      memoryHandlesDropped: true,
    });
  });

  it('reports destroy failures from resolver and temp-file boundaries', () => {
    const registry = registryRef();
    const workerScope = scope({
      party: 'worker',
      phase: 'install',
      operationId: 'operation-destroy-fail',
      hosts: ['registry.npmjs.org'],
    });
    const policyResult = contractFor({ ref: registry }).issueEgressPolicy([registry], workerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }
    const contract = contractFor({
      ref: registry,
      attestations: [matchingAttestation(policyResult)],
      injectionModeFor: () => 'file',
      secretResolver: {
        resolve: (ref) => ({ ok: true, value: { materialHandle: `handle:${ref.id}`, material: placeholderMaterial } }),
        destroy: () => ({ ok: false, error: 'credential-destroy-unconfirmed' }),
      },
      tempFileRemover: {
        remove: () => ({ ok: false, error: 'credential-destroy-unconfirmed' }),
      },
    });
    expect(contract.resolveCredential(registry, workerScope)).toMatchObject({ ok: true });

    expect(contract.destroy('operation-destroy-fail')).toMatchObject({
      type: 'CredentialMaterialDestroyed',
      tempFilesRemoved: false,
      memoryHandlesDropped: false,
    });
  });

  it('denies empty refs, invalid expiry, missing hosts, disallowed phases, and runner forge phase policy', () => {
    const forge = sourceRef();
    const contract = contractFor({ ref: forge, runnerForgePhases: ['push'] });

    expect(contract.planInjection([], scope())).toMatchObject({ ok: false, reason: 'credential-scope-denied' });
    expect(contract.planInjection([forge], scope({ expiresAt: 'not-a-date' }))).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
    expect(contract.planInjection([forge], scope({ hosts: undefined }))).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
    expect(contract.planInjection([forge], scope({ phase: 'install' }))).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
    expect(contract.planInjection([forge], scope({ phase: 'merge' }))).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
  });

  it('reports unresolved credentials without leaking material', () => {
    const forge = sourceRef();
    const runnerScope = scope({ operationId: 'operation-unresolved' });
    const policyResult = contractFor({ ref: forge }).issueEgressPolicy([forge], runnerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }

    const contract = contractFor({
      ref: forge,
      attestations: [matchingAttestation(policyResult)],
      secretResolver: { resolve: () => ({ ok: false, error: 'credential-ref-unresolved' }) },
    });

    const resolved = contract.resolveCredential(forge, runnerScope);
    expect(resolved).toMatchObject({ ok: false, reason: 'credential-ref-unresolved' });
    expect(JSON.stringify(resolved)).not.toContain(placeholderMaterial);
  });

  it('fails closed when audit writes are unavailable on issue, plan, resolve, redact, destroy, and finish', () => {
    const registry = registryRef();
    const workerScope = scope({
      party: 'worker',
      phase: 'install',
      operationId: 'operation-audit-fail',
      hosts: ['registry.npmjs.org'],
    });
    const policyResult = contractFor({ ref: registry }).issueEgressPolicy([registry], workerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }
    const auditWriter = { append: () => ({ ok: false as const, error: 'audit-write-unavailable' as const }) };
    const contract = contractFor({
      ref: registry,
      attestations: [matchingAttestation(policyResult)],
      auditWriter,
    });

    expect(contract.issueEgressPolicy([registry], workerScope)).toMatchObject({
      ok: false,
      reason: 'audit-write-unavailable',
    });
    const plan = contract.planInjection([registry], workerScope);
    expect(plan).toMatchObject({ ok: false, reason: 'audit-write-unavailable' });
    const resolved = contract.resolveCredential(registry, workerScope);
    expect(resolved).toMatchObject({ ok: false, reason: 'audit-write-unavailable' });
    const unavailableRedaction = contract.redact('secret', {
      id: 'missing',
      state: 'materialized',
      credentialRefIds: [registry.id],
      labels: {},
      fingerprintIds: [],
      expiresAt: later,
    });
    expect(unavailableRedaction).toMatchObject({ ok: false, reason: 'audit-write-unavailable' });

    expect(contract.destroy('unknown-operation')).toMatchObject({
      type: 'CredentialMaterialDestroyed',
      memoryHandlesDropped: false,
    });
    expect(contract.finishCredentialUse('unknown-operation', { result: 'failure', exitCode: 1 })).toMatchObject({
      type: 'CredentialUseFinished',
      result: 'failure',
      exitCode: 1,
      destroyed: true,
    });
  });

  it('tracks merged operation context across plan and resolve before file cleanup succeeds', () => {
    const registry = registryRef();
    const workerScope = scope({
      party: 'worker',
      phase: 'install',
      operationId: 'operation-merged-cleanup',
      hosts: ['registry.npmjs.org'],
    });
    const policyResult = contractFor({ ref: registry }).issueEgressPolicy([registry], workerScope);
    if ('ok' in policyResult) {
      throw new Error('expected egress policy');
    }
    const removedPaths: string[][] = [];
    const contract = contractFor({
      ref: registry,
      attestations: [matchingAttestation(policyResult)],
      injectionModeFor: () => 'file',
      tempFileRemover: {
        remove: (paths) => {
          removedPaths.push([...paths]);
          return { ok: true, value: undefined };
        },
      },
    });

    expect(contract.planInjection([registry], workerScope)).toMatchObject({ ok: true });
    expect(contract.resolveCredential(registry, workerScope)).toMatchObject({ ok: true });
    const destroyed = contract.destroy('operation-merged-cleanup');

    expect(destroyed).toMatchObject({
      type: 'CredentialMaterialDestroyed',
      tempFilesRemoved: true,
      memoryHandlesDropped: true,
    });
    expect(removedPaths.flat()).toContain(
      `/tmp/kit-vnext-credentials/${encodeURIComponent(workerScope.operationId)}/${encodeURIComponent(registry.id)}`,
    );
  });
});
