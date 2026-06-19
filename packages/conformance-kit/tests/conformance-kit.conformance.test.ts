import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ATTESTATION_FAILURE_TOKENS,
  capabilityAttestationSchema,
  createAdversarialCapabilityMock,
  createCapabilityAttestationCase,
  createConformantCapabilityMock,
  evaluateCapabilityFreshness,
  evaluateCapabilityGate,
  registerRealSmokeSlot,
  runConformanceSuite,
  runSchemaProbe,
  toJsonSchema,
  type CapabilityAttestation,
  type CapabilityProbeDriver,
} from '../src/index.js';

const requiredFields = [
  'capability',
  'probeMethod',
  'result',
  'evidenceRef',
  'scope',
  'expiry',
  'driverVersion',
  'platform',
  'freshnessKey',
  'at',
] as const;

const evidenceRef = {
  id: 'artifact-1',
  digest: 'a'.repeat(64),
  size: 42,
  mediaType: 'application/json',
  retentionClass: 'short-lived',
  classification: 'internal',
  redactionState: 'redacted' as const,
};

const validAttestation = (): CapabilityAttestation => ({
  capability: 'execution-host.canKill',
  probeMethod: 'mock-schema-probe',
  result: 'positive',
  evidenceRef,
  scope: {
    workspace: 'demo',
    driver: 'mock',
  },
  expiry: '2026-06-19T11:00:00.000Z',
  driverVersion: 'mock-driver@1.0.0',
  platform: 'darwin-arm64',
  freshnessKey: 'execution-host.canKill:mock-driver@1.0.0',
  at: '2026-06-19T10:00:00.000Z',
});

const omitField = <T extends Record<string, unknown>>(value: T, field: keyof T): Omit<T, keyof T> => {
  const { [field]: _omitted, ...rest } = value;
  return rest;
};

const fixedClock = {
  nowEpochMs: () => Date.parse('2026-06-19T10:30:00.000Z'),
};

const conformanceCase = () =>
  createCapabilityAttestationCase({
    id: 'requires-fresh-positive-can-kill',
    capability: 'execution-host.canKill',
    maxProbeMs: 25,
    resolveEvidence: (ref) => ref.id === evidenceRef.id,
  });

const runMockConformance = (driver: CapabilityProbeDriver) =>
  runConformanceSuite({
    lane: 'conformance-mock',
    driver,
    cases: [conformanceCase()],
    clock: fixedClock,
  });

describe('CapabilityAttestation schema', () => {
  it('AC-1 accepts a complete value and rejects each missing required field', () => {
    expect(capabilityAttestationSchema.parse(validAttestation())).toEqual(validAttestation());

    for (const field of requiredFields) {
      const result = capabilityAttestationSchema.safeParse(omitField(validAttestation(), field));

      expect(result.success, `${field} should be required`).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
      }
    }
  });

  it('AC-2 accepts only positive or negative result literals', () => {
    expect(capabilityAttestationSchema.safeParse({ ...validAttestation(), result: 'positive' }).success).toBe(true);
    expect(capabilityAttestationSchema.safeParse({ ...validAttestation(), result: 'negative' }).success).toBe(true);
    expect(capabilityAttestationSchema.safeParse({ ...validAttestation(), result: 'maybe' }).success).toBe(false);
  });

  it('AC-3 keeps details optional and round-trips known detail fields', () => {
    const withoutDetails = capabilityAttestationSchema.parse(validAttestation());
    expect(withoutDetails.details).toBeUndefined();

    const details = {
      containmentStrength: 'workspace-process',
      negativeProbeResults: [
        {
          probe: 'blocked-egress',
          result: 'blocked',
        },
      ],
      egressPolicyDigest: 'sha256:egress-policy',
    };

    expect(capabilityAttestationSchema.parse({ ...validAttestation(), details }).details).toEqual(details);
  });
});

describe('Attestation freshness and gates', () => {
  it('AC-4 returns attestation-stale and treats stale attestations as absent capability', () => {
    const expiryMs = Date.parse(validAttestation().expiry);

    expect(evaluateCapabilityFreshness(validAttestation(), { nowEpochMs: () => expiryMs - 1 })).toEqual({
      status: 'fresh',
      capabilityPresent: true,
    });
    expect(evaluateCapabilityFreshness(validAttestation(), { nowEpochMs: () => expiryMs })).toEqual({
      status: 'fresh',
      capabilityPresent: true,
    });
    expect(evaluateCapabilityFreshness(validAttestation(), { nowEpochMs: () => expiryMs + 1 })).toEqual({
      status: 'stale',
      token: 'attestation-stale',
      capabilityPresent: false,
    });
  });

  it('AC-5 gates absent and negative attestations off with typed tokens', () => {
    expect(evaluateCapabilityGate([], 'execution-host.canKill', fixedClock)).toEqual({
      allowed: false,
      token: 'attestation-absent',
    });

    expect(
      evaluateCapabilityGate([{ ...validAttestation(), result: 'negative' }], 'execution-host.canKill', fixedClock),
    ).toEqual({
      allowed: false,
      token: 'attestation-negative',
    });
  });

  it('AC-5 gates stale attestations off and allows the latest fresh positive attestation', () => {
    expect(
      evaluateCapabilityGate([validAttestation()], 'execution-host.canKill', {
        nowEpochMs: () => Date.parse('2026-06-19T11:00:00.001Z'),
      }),
    ).toEqual({
      allowed: false,
      token: 'attestation-stale',
    });

    const olderNegative = {
      ...validAttestation(),
      result: 'negative' as const,
      at: '2026-06-19T09:00:00.000Z',
    };
    const newerPositive = {
      ...validAttestation(),
      at: '2026-06-19T10:00:00.000Z',
    };

    expect(evaluateCapabilityGate([olderNegative, newerPositive], 'execution-host.canKill', fixedClock)).toEqual({
      allowed: true,
      attestation: newerPositive,
    });
    expect(evaluateCapabilityGate([newerPositive, olderNegative], 'execution-host.canKill', fixedClock)).toEqual({
      allowed: true,
      attestation: newerPositive,
    });
  });

  it('failure tokens expose only the cross-cutting attestation vocabulary', () => {
    expect(ATTESTATION_FAILURE_TOKENS).toEqual([
      'attestation-stale',
      'attestation-absent',
      'attestation-negative',
      'evidence-missing',
    ]);
  });

  it('AC-11 freshness is pure over attestation plus injected clock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_700_000_000_000, max: 1_900_000_000_000 }),
        fc.integer({ min: -10_000_000, max: 10_000_000 }),
        (baseMs, offsetMs) => {
          const attestation = {
            ...validAttestation(),
            expiry: new Date(baseMs).toISOString(),
          };
          const clock = { nowEpochMs: () => baseMs + offsetMs };

          expect(evaluateCapabilityFreshness(attestation, clock)).toEqual(
            evaluateCapabilityFreshness(attestation, clock),
          );
        },
      ),
      { numRuns: 100, seed: 20260619 },
    );
  });
});

describe('Schema probes', () => {
  it('AC-6 returns typed schema failures naming missing non-evidence fields', async () => {
    const result = await runSchemaProbe(capabilityAttestationSchema, omitField(validAttestation(), 'driverVersion'));

    expect(result).toMatchObject({
      status: 'fail',
      failure: {
        token: 'schema-invalid',
        field: 'driverVersion',
      },
    });
  });

  it('AC-6 maps absent or unresolvable evidenceRef to evidence-missing without throwing', async () => {
    await expect(
      runSchemaProbe(capabilityAttestationSchema, omitField(validAttestation(), 'evidenceRef')),
    ).resolves.toMatchObject({
      status: 'fail',
      failure: {
        token: 'evidence-missing',
        field: 'evidenceRef',
      },
    });

    await expect(
      runSchemaProbe(capabilityAttestationSchema, validAttestation(), {
        resolveEvidence: () => false,
      }),
    ).resolves.toMatchObject({
      status: 'fail',
      failure: {
        token: 'evidence-missing',
        field: 'evidenceRef',
      },
    });

    await expect(
      runSchemaProbe(capabilityAttestationSchema, validAttestation(), {
        resolveEvidence: () => {
          throw new Error('resolver failed');
        },
      }),
    ).resolves.toMatchObject({
      status: 'fail',
      failure: {
        token: 'evidence-missing',
        field: 'evidenceRef',
      },
    });
  });

  it('AC-10 emits a structurally valid JSON-Schema representation from the Zod schema', () => {
    const jsonSchema = toJsonSchema(capabilityAttestationSchema, 'CapabilityAttestation');

    expect(jsonSchema).toMatchObject({
      type: 'object',
      properties: {
        result: {
          enum: ['positive', 'negative'],
        },
      },
    });
    expect(jsonSchema.required).toEqual(expect.arrayContaining([...requiredFields]));
  });

  it('schema probes never throw when JSON-Schema conversion is unavailable', async () => {
    await expect(
      runSchemaProbe(
        z.string().transform((value) => value.length),
        'abc',
      ),
    ).resolves.toMatchObject({
      status: 'pass',
      value: 3,
      jsonSchema: {
        type: 'object',
      },
    });
  });

  it('schema probes pass payloads without evidenceRef when no evidence field is declared', async () => {
    await expect(
      runSchemaProbe(z.string(), 'abc', {
        resolveEvidence: () => {
          throw new Error('should not resolve evidence for schemas without evidenceRef');
        },
      }),
    ).resolves.toMatchObject({
      status: 'pass',
      value: 'abc',
    });
  });
});

describe('Conformance run API', () => {
  it('AC-7 adversarial omit, delay, and lie mocks each fail the conformance run', async () => {
    const variants = [
      createAdversarialCapabilityMock('omit', {
        attestation: validAttestation(),
        omitField: 'driverVersion',
        elapsedMs: 5,
      }),
      createAdversarialCapabilityMock('delay', {
        attestation: validAttestation(),
        elapsedMs: 50,
      }),
      createAdversarialCapabilityMock('lie', {
        attestation: validAttestation(),
        elapsedMs: 5,
      }),
    ];

    for (const driver of variants) {
      const result = await runMockConformance(driver);

      expect(result.status).toBe('fail');
      expect(result.cases).toHaveLength(1);
      expect(result.cases[0]).toMatchObject({ status: 'fail' });
    }
  });

  it('AC-8 conformant mock passes the same conformance run', async () => {
    await expect(
      runMockConformance(
        createConformantCapabilityMock({
          attestation: validAttestation(),
          elapsedMs: 5,
        }),
      ),
    ).resolves.toMatchObject({
      status: 'pass',
      cases: [
        {
          id: 'requires-fresh-positive-can-kill',
          status: 'pass',
        },
      ],
    });
  });

  it('AC-9 real-smoke slots report skip, not fail, in the conformance-mock lane', async () => {
    await expect(
      runConformanceSuite({
        lane: 'conformance-mock',
        driver: createConformantCapabilityMock({
          attestation: validAttestation(),
          elapsedMs: 5,
        }),
        cases: [registerRealSmokeSlot({ id: 'real-driver-capability-smoke' })],
        clock: fixedClock,
      }),
    ).resolves.toMatchObject({
      status: 'pass',
      cases: [
        {
          id: 'real-driver-capability-smoke',
          status: 'skip',
        },
      ],
    });
  });

  it('conformance runner reports throwing probes and throwing cases as typed failures', async () => {
    await expect(
      runConformanceSuite({
        lane: 'conformance-mock',
        driver: {
          probeCapability: () => {
            throw new Error('probe failed');
          },
        },
        cases: [conformanceCase()],
        clock: fixedClock,
      }),
    ).resolves.toMatchObject({
      status: 'fail',
      cases: [
        {
          status: 'fail',
          failure: {
            token: 'probe-threw',
          },
        },
      ],
    });

    await expect(
      runConformanceSuite({
        lane: 'conformance-mock',
        driver: createConformantCapabilityMock({
          attestation: validAttestation(),
          elapsedMs: 5,
        }),
        cases: [
          {
            kind: 'case',
            id: 'throwing-case',
            run: () => {
              throw new Error('case failed');
            },
          },
        ],
        clock: fixedClock,
      }),
    ).resolves.toMatchObject({
      status: 'fail',
      cases: [
        {
          id: 'throwing-case',
          status: 'fail',
          failure: {
            token: 'probe-threw',
          },
        },
      ],
    });
  });

  it('conformance runner skips smoke-real slots that have no registered runner', async () => {
    await expect(
      runConformanceSuite({
        lane: 'smoke-real',
        driver: createConformantCapabilityMock({
          attestation: validAttestation(),
          elapsedMs: 5,
        }),
        cases: [registerRealSmokeSlot({ id: 'unwired-real-smoke' })],
        clock: fixedClock,
      }),
    ).resolves.toMatchObject({
      status: 'pass',
      cases: [
        {
          id: 'unwired-real-smoke',
          status: 'skip',
        },
      ],
    });
  });

  it('conformance runner executes registered smoke-real slots outside conformance-mock', async () => {
    await expect(
      runConformanceSuite({
        lane: 'smoke-real',
        driver: createConformantCapabilityMock({
          attestation: validAttestation(),
          elapsedMs: 5,
        }),
        cases: [
          registerRealSmokeSlot({
            id: 'wired-real-smoke',
            run: () => ({
              id: 'wired-real-smoke',
              status: 'pass',
            }),
          }),
        ],
        clock: fixedClock,
      }),
    ).resolves.toMatchObject({
      status: 'pass',
      cases: [
        {
          id: 'wired-real-smoke',
          status: 'pass',
        },
      ],
    });
  });

  it('conformance runner fails capability mismatches explicitly', async () => {
    await expect(
      runConformanceSuite({
        lane: 'conformance-mock',
        driver: {
          probeCapability: () => ({
            payload: {
              ...validAttestation(),
              capability: 'forge.supportsMergeQueue',
            },
            elapsedMs: 5,
          }),
        },
        cases: [conformanceCase()],
        clock: fixedClock,
      }),
    ).resolves.toMatchObject({
      status: 'fail',
      cases: [
        {
          status: 'fail',
          failure: {
            token: 'capability-mismatch',
            field: 'capability',
          },
        },
      ],
    });
  });

  it('mock drivers return no payload for a different requested capability', () => {
    const mock = createConformantCapabilityMock({
      attestation: validAttestation(),
      elapsedMs: 5,
    });
    const adversarialMock = createAdversarialCapabilityMock('delay', {
      attestation: validAttestation(),
      elapsedMs: 50,
    });

    expect(mock.probeCapability('forge.supportsMergeQueue')).toEqual({
      payload: undefined,
      elapsedMs: 5,
    });
    expect(adversarialMock.probeCapability('forge.supportsMergeQueue')).toEqual({
      payload: undefined,
      elapsedMs: 50,
    });
  });

  it('adversarial omit mock defaults to omitting evidenceRef', () => {
    const mock = createAdversarialCapabilityMock('omit', {
      attestation: validAttestation(),
      elapsedMs: 5,
    });

    expect(mock.probeCapability('execution-host.canKill')).toEqual({
      payload: omitField(validAttestation(), 'evidenceRef'),
      elapsedMs: 5,
    });
  });
});

describe('Dependency boundary self-check', () => {
  it('AC-12 package declares only foundation plus allowed schema/property-test dependencies', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as Record<
      string,
      Record<string, string>
    >;

    expect(Object.keys(packageJson.dependencies ?? {}).sort()).toEqual(['@kit-vnext/foundation-fnd-02', 'zod']);
    expect(Object.keys(packageJson.devDependencies ?? {}).sort()).toEqual(['fast-check']);
  });
});
