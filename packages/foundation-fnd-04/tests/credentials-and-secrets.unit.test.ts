import type { PolicyLayer } from '@kit-vnext/foundation-fnd-01';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  buildClosedInjectionEnvironment,
  createCredentialsAndSecrets,
  credentialAuditEventHash,
  credentialRefFromSource,
  type CredentialAuditEvent,
  type CredentialClock,
  type CredentialRef,
  type CredentialScope,
  type EgressCapabilityAttestation,
  type EgressPolicy,
  type IdGenerator,
  type SecretResolver,
} from '../src/index.js';

const occurredAt = '2026-06-19T09:00:00.000Z';
const later = '2026-06-19T09:05:00.000Z';
const expired = '2026-06-19T08:59:00.000Z';
const placeholderMaterial = 'placeholder-material-alpha/one two';
const encodedPlaceholder = encodeURIComponent(placeholderMaterial);

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

const secretResolver: SecretResolver = {
  resolve: (ref) => ({
    ok: true,
    value: {
      materialHandle: `handle:${ref.id}`,
      material: placeholderMaterial,
    },
  }),
};

const contractFor = (
  options: {
    readonly ref?: CredentialRef;
    readonly attestations?: readonly EgressCapabilityAttestation[];
    readonly auditEvents?: CredentialAuditEvent[];
    readonly egress?: PolicyLayer['egress'];
    readonly injectionModeFor?: Parameters<typeof createCredentialsAndSecrets>[0]['injectionModeFor'];
  } = {},
) =>
  createCredentialsAndSecrets({
    clock: new FixedClock(),
    idGenerator: new SequenceIds(),
    fingerprintKey: 'test-fingerprint-key',
    secretResolver,
    egress: options.egress ?? egressSource(options.ref ?? sourceRef()),
    attesterMetadata: {
      'local-host': { platform: 'darwin-arm64', driverVersion: '1.0.0' },
    },
    attestations: options.attestations ?? [],
    injectionModeFor: options.injectionModeFor,
    auditWriter: options.auditEvents
      ? {
          append: (event) => {
            options.auditEvents?.push(event);
            return { ok: true, value: undefined };
          },
        }
      : undefined,
  });

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
        },
        artifacts: [
          {
            artifactId: 'artifact-1',
            mediaType: 'application/json',
            text: `{"url":"https://registry.npmjs.org?token=${encodedPlaceholder}"}`,
          },
        ],
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
    expect(output).toContain('[REDACTED:credential:registry-read]');
    expect(redacted.replacementCount).toBeGreaterThanOrEqual(3);
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
});
