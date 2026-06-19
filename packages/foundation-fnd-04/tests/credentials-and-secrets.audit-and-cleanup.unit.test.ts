import type { PolicyLayer } from '@kit-vnext/foundation-fnd-01';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type AuditWriter,
  type CredentialAuditEvent,
  type CredentialClock,
  type CredentialRef,
  type CredentialScope,
  createCredentialsAndSecrets,
  credentialAuditEventHash,
  credentialRefFromSource,
  type EgressCapabilityAttestation,
  type EgressPolicy,
  type IdGenerator,
  type RedactedInput,
  type SecretResolver,
} from '../src/index.js';

const occurredAt = '2026-06-19T09:00:00.000Z';
const later = '2026-06-19T09:05:00.000Z';
const _expired = '2026-06-19T08:59:00.000Z';
const placeholderMaterial = 'placeholder-material-alpha/"one\\two two';
const encodedPlaceholder = encodeURIComponent(placeholderMaterial);
const _doubleEncodedPlaceholder = encodeURIComponent(encodedPlaceholder);
const _base64Placeholder = Buffer.from(placeholderMaterial, 'utf8').toString('base64');
const _jsonEscapedPlaceholder = JSON.stringify(placeholderMaterial).slice(1, -1);

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

const _githubWorkerRef = (): CredentialRef =>
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

const _variantSurvivorsFor = (secret: string, key = 'REGISTRY_READ_REF'): readonly string[] => {
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

const _embeddedSecretVariants = (secret: string, value: RedactedInput): RedactedInput => {
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

const _redactedInputArbitrary: fc.Arbitrary<RedactedInput> = fc.letrec((tie) => ({
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
