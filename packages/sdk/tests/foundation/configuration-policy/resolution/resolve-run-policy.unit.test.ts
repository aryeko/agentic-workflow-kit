import { describe, expect, it } from 'vitest';

import { builtInPolicyLayerDefaults } from '../../../../src/foundation/configuration-policy/defaults/index.js';
import {
  createConfigurationPolicy,
  resolvedPolicySchemaMarker,
  stableCanonicalStringify,
  type ConfigSource,
  type ConfigurationPolicyAppendIntent,
  type PolicyLayerPatch,
  type ResolutionContext,
} from '../../../../src/foundation/configuration-policy/resolution/index.js';
import {
  configurationSchemaMarker,
  deferredCapabilityName,
} from '../../../../src/foundation/configuration-policy/schema/index.js';
import type {
  ConfigurationPolicy as RootConfigurationPolicy,
  ConfigurationPolicyAppendIntent as RootConfigurationPolicyAppendIntent,
  FieldProvenance as RootFieldProvenance,
  PolicyResolutionFailure as RootPolicyResolutionFailure,
  ResolvedPolicy as RootResolvedPolicy,
  ResolvedPolicyResult as RootResolvedPolicyResult,
} from '../../../../src/index.js';

const defaultHashText = (value: string): string => `hash:${value}`;

type RootResolutionExports = {
  readonly policy: RootConfigurationPolicy;
  readonly resolved: RootResolvedPolicy;
  readonly result: RootResolvedPolicyResult;
  readonly intent: RootConfigurationPolicyAppendIntent;
  readonly provenance: RootFieldProvenance;
  readonly failure: RootPolicyResolutionFailure;
};

const createPolicy = () =>
  createConfigurationPolicy({
    hashText: defaultHashText,
  });

it('exposes resolution contracts from the root SDK barrel', () => {
  const rootExports: Partial<RootResolutionExports> = {};

  expect(rootExports).toEqual({});
});

const baseConfig = {
  schema: configurationSchemaMarker,
  project: {
    id: 'workflow-kit',
    rootPolicy: 'single-repo',
  },
  profiles: {
    focused: {},
  },
} as const;

const configSource = (config: unknown = baseConfig): ConfigSource => ({
  path: '/workspace/.kit/config.json',
  content: JSON.stringify(config),
});

const baseContext = (overrides: Partial<ResolutionContext> = {}): ResolutionContext => ({
  runId: 'run-123',
  occurredAt: '2026-06-22T09:00:00.000Z',
  correlationId: 'corr-123',
  ...overrides,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const leafPathsOf = (value: unknown, path = ''): string[] => {
  if (Array.isArray(value) || !isPlainObject(value)) {
    return path === '' ? [] : [path];
  }

  return Object.keys(value)
    .sort()
    .flatMap((key) => leafPathsOf(value[key], path === '' ? key : `${path}.${key}`));
};

const getAtPath = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((current, segment) => {
    if (!isPlainObject(current)) {
      throw new Error(`path ${path} does not resolve`);
    }

    return current[segment];
  }, value);

const withPatchAtPath = (path: string, nextValue: unknown): PolicyLayerPatch =>
  path
    .split('.')
    .reverse()
    .reduce<unknown>((current, segment) => ({ [segment]: current }), nextValue) as PolicyLayerPatch;

const alternateLeafValue = (path: string, currentValue: unknown): unknown => {
  if (Array.isArray(currentValue)) {
    const arrayAlternates: Record<string, unknown> = {
      'changePolicy.allowedChangePaths': ['packages/sdk/src/foundation/configuration-policy/resolution/**'],
      'credentialRefs.refs': [
        {
          id: 'forge-read',
          kind: 'forge',
          purpose: 'Fetch review state',
          secret: {
            source: 'env',
            key: 'FORGE_TOKEN',
          },
          allowedParties: ['runner'],
          allowedPhases: ['verification'],
          allowedHosts: ['api.github.com'],
          ttlSeconds: 600,
        },
      ],
      'egress.negativeProbes': [
        {
          host: 'blocked.example.test',
          protocol: 'https',
          expected: 'blocked',
          reason: 'default deny evidence',
        },
      ],
      'egress.requiredAttesters': [
        {
          point: 'execution-host',
          capability: 'egress-confinement',
          driverId: 'local-host',
        },
      ],
      'egress.rules': [
        {
          credentialRefIds: ['forge-read'],
          protocols: ['https'],
          hosts: ['api.github.com'],
          ports: [443],
          phase: 'verification',
          purpose: 'GitHub API verification',
        },
      ],
      'escalationPolicy.allowedGrantScopes': ['per-command'],
      'escalationPolicy.grantRules': [
        {
          reason: 'verification',
          scope: 'per-command-prefix',
          prefixes: ['pnpm test '],
          requiresOperator: true,
        },
      ],
      'merge.requiredEvidence': ['verification', 'review'],
      'provisioning.dependencyInstall.allowedPrefixes': ['pnpm test '],
    };

    return arrayAlternates[path];
  }

  if (typeof currentValue === 'boolean') {
    const fixedTruePaths = new Set([
      'capabilities.auto-merge.requireFreshAttestation',
      'capabilities.auto-recover.requireFreshAttestation',
      'capabilities.escalation-auto-grant.requireFreshAttestation',
      'capabilities.unattended-run.requireFreshAttestation',
      'egress.defaultAction',
    ]);

    return fixedTruePaths.has(path) ? currentValue : !currentValue;
  }

  if (typeof currentValue === 'number') {
    return currentValue + 1;
  }

  if (typeof currentValue === 'string') {
    const stringAlternates: Record<string, string> = {
      'approval.mode': 'manual',
      'escalationPolicy.maxGrantScope': 'per-command',
      'provisioning.dependencyInstall.defaultGrant': 'none',
      'provisioning.ownershipClass': 'owned-remote',
      'run.mode': 'manual',
    };

    return stringAlternates[path] ?? currentValue;
  }

  throw new Error(`missing alternate value for ${path}`);
};

const expectSuccess = (result: ReturnType<ReturnType<typeof createPolicy>['resolveRunPolicy']>) => {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`expected success, got ${result.error.reason}`);
  }

  return result.value;
};

const expectFailure = (
  result: ReturnType<ReturnType<typeof createPolicy>['resolveRunPolicy']>,
  reason:
    | 'config-invalid'
    | 'profile-unknown'
    | 'override-invalid'
    | 'unsupported-deferred-capability'
    | 'provenance-write-failed',
) => {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.reason).toBe(reason);
    return result.error;
  }

  throw new Error(`expected failure ${reason}`);
};

describe('fnd-01-s2-policy-resolution resolveRunPolicy', () => {
  it('gives operator overrides precedence for every built-in default leaf', () => {
    const policy = createPolicy();
    const leafPaths = leafPathsOf(builtInPolicyLayerDefaults);

    expect(leafPaths.length).toBeGreaterThan(0);

    for (const fieldPath of leafPaths) {
      const defaultValue = getAtPath(builtInPolicyLayerDefaults, fieldPath);
      const profileValue = alternateLeafValue(fieldPath, defaultValue);
      const overrideValue = alternateLeafValue(fieldPath, profileValue);
      const result = expectSuccess(
        policy.resolveRunPolicy(
          configSource({
            ...baseConfig,
            profiles: {
              focused: withPatchAtPath(fieldPath, profileValue),
            },
          }),
          {
            profile: 'focused',
            overrides: withPatchAtPath(fieldPath, overrideValue),
          },
          baseContext(),
        ),
      );

      expect(getAtPath(result.resolvedPolicy.policy, fieldPath)).toEqual(overrideValue);
      expect(result.resolvedPolicy.provenance[fieldPath]).toMatchObject({
        fieldPath,
        sourceLayer: 'operator-override',
        sourceRef: 'run-input.overrides',
      });
    }
  });

  it('uses profile patch values over built-in defaults when no override exists', () => {
    const policy = createPolicy();
    const leafPaths = leafPathsOf(builtInPolicyLayerDefaults);

    for (const fieldPath of leafPaths) {
      const defaultValue = getAtPath(builtInPolicyLayerDefaults, fieldPath);
      const profileValue = alternateLeafValue(fieldPath, defaultValue);
      const result = expectSuccess(
        policy.resolveRunPolicy(
          configSource({
            ...baseConfig,
            profiles: {
              focused: withPatchAtPath(fieldPath, profileValue),
            },
          }),
          {
            profile: 'focused',
          },
          baseContext(),
        ),
      );

      expect(getAtPath(result.resolvedPolicy.policy, fieldPath)).toEqual(profileValue);
      expect(result.resolvedPolicy.provenance[fieldPath]).toMatchObject({
        fieldPath,
        sourceLayer: 'profile',
        profile: 'focused',
        sourceRef: '/workspace/.kit/config.json#profiles.focused',
      });
    }
  });

  it('merges object maps, replaces arrays and scalars atomically, and rejects invalid nulls', () => {
    const policy = createPolicy();

    const merged = expectSuccess(
      policy.resolveRunPolicy(
        configSource({
          ...baseConfig,
          profiles: {
            focused: {
              run: {
                mode: 'manual',
              },
              provisioning: {
                dependencyInstall: {
                  allowedPrefixes: ['pnpm test '],
                },
              },
            },
          },
        }),
        {
          profile: 'focused',
          overrides: {
            run: {
              maxConcurrentRuns: 2,
            },
            provisioning: {
              dependencyInstall: {
                allowedPrefixes: ['pnpm install --frozen-lockfile '],
              },
            },
          },
        },
        baseContext(),
      ),
    );

    expect(merged.resolvedPolicy.policy.run).toEqual({
      mode: 'manual',
      maxConcurrentRuns: 2,
      requireCleanWorkspace: true,
    });
    expect(merged.resolvedPolicy.policy.provisioning.dependencyInstall).toEqual({
      defaultGrant: 'narrow',
      allowedPrefixes: ['pnpm install --frozen-lockfile '],
    });

    expectFailure(
      policy.resolveRunPolicy(
        configSource({
          ...baseConfig,
          profiles: {
            focused: {
              run: {
                mode: null,
              },
            },
          },
        }),
        {
          profile: 'focused',
        },
        baseContext(),
      ),
      'config-invalid',
    );

    expectFailure(
      policy.resolveRunPolicy(
        configSource(),
        {
          overrides: {
            merge: {
              requiredEvidence: null,
            },
          } as unknown as PolicyLayerPatch,
        },
        baseContext(),
      ),
      'override-invalid',
    );
  });

  it('returns lexicographically ordered ConfigFieldResolved intents before ConfigResolved', () => {
    const policy = createPolicy();
    const result = expectSuccess(
      policy.resolveRunPolicy(
        configSource({
          ...baseConfig,
          profiles: {
            focused: {
              run: {
                mode: 'manual',
                maxConcurrentRuns: 2,
              },
              merge: {
                mergeMethod: 'squash',
              },
            },
          },
        }),
        {
          profile: 'focused',
          overrides: {
            changePolicy: {
              allowedChangePaths: ['packages/sdk/src/foundation/configuration-policy/**'],
            },
          },
        },
        baseContext(),
      ),
    );

    const fieldIntents = result.appendIntents.filter(
      (intent): intent is Extract<ConfigurationPolicyAppendIntent, { type: 'ConfigFieldResolved' }> =>
        intent.type === 'ConfigFieldResolved',
    );
    const orderedPaths = fieldIntents.map((intent) => intent.payload.fieldPath);
    const sortedPaths = [...orderedPaths].sort();

    expect(orderedPaths).toEqual(sortedPaths);
    expect(fieldIntents).toHaveLength(Object.keys(result.resolvedPolicy.provenance).length);
    expect(result.appendIntents.at(-1)?.type).toBe('ConfigResolved');
    expect(result.appendIntents.slice(0, -1).every((intent) => intent.type === 'ConfigFieldResolved')).toBe(true);
  });

  it('returns the resolved policy schema, full layer, provenance, and a stable resolved policy hash', () => {
    const policy = createPolicy();
    const first = expectSuccess(
      policy.resolveRunPolicy(
        configSource({
          schema: configurationSchemaMarker,
          project: {
            rootPolicy: 'single-repo',
            id: 'workflow-kit',
          },
          profiles: {
            focused: {
              merge: {
                mergeMethod: 'merge',
              },
              run: {
                maxConcurrentRuns: 3,
                mode: 'manual',
              },
            },
          },
        }),
        {
          profile: 'focused',
        },
        baseContext(),
      ),
    );
    const second = expectSuccess(
      policy.resolveRunPolicy(
        configSource({
          project: {
            id: 'workflow-kit',
            rootPolicy: 'single-repo',
          },
          profiles: {
            focused: {
              run: {
                mode: 'manual',
                maxConcurrentRuns: 3,
              },
              merge: {
                mergeMethod: 'merge',
              },
            },
          },
          schema: configurationSchemaMarker,
        }),
        {
          profile: 'focused',
        },
        baseContext(),
      ),
    );

    expect(first.resolvedPolicy.schema).toBe(resolvedPolicySchemaMarker);
    expect(first.resolvedPolicy.policy).toMatchObject({
      run: {
        mode: 'manual',
        maxConcurrentRuns: 3,
        requireCleanWorkspace: true,
      },
      merge: {
        runnerMayPush: true,
        runnerMayOpenPr: true,
        runnerMayMerge: false,
        requiredEvidence: ['verification', 'ci', 'review', 'threads-resolved', 'protection'],
        mergeMethod: 'merge',
      },
    });
    expect(first.resolvedPolicy.provenance['run.mode']).toMatchObject({
      sourceLayer: 'profile',
      profile: 'focused',
    });
    expect(first.resolvedPolicy.resolvedPolicyHash).toBe(
      defaultHashText(
        stableCanonicalStringify({
          schema: first.resolvedPolicy.schema,
          policy: first.resolvedPolicy.policy,
          provenance: first.resolvedPolicy.provenance,
        }),
      ),
    );
    expect(first.resolvedPolicy.resolvedPolicyHash).toBe(second.resolvedPolicy.resolvedPolicyHash);
    expect(first.appendIntents.at(-1)).toMatchObject({
      type: 'ConfigResolved',
      payload: {
        runId: 'run-123',
        resolvedPolicyHash: first.resolvedPolicy.resolvedPolicyHash,
        fieldCount: Object.keys(first.resolvedPolicy.provenance).length,
        at: '2026-06-22T09:00:00.000Z',
      },
    });
  });

  it('fails closed for unknown profiles, invalid overrides, invalid config, and deferred capability attempts', () => {
    const policy = createPolicy();

    expectFailure(policy.resolveRunPolicy(configSource(), { profile: 'missing' }, baseContext()), 'profile-unknown');

    expectFailure(
      policy.resolveRunPolicy(
        configSource(),
        {
          overrides: {
            merge: {
              mergeMethod: 'ship-it',
            },
          } as unknown as PolicyLayerPatch,
        },
        baseContext(),
      ),
      'override-invalid',
    );

    const invalidConfig = expectFailure(
      policy.resolveRunPolicy(
        {
          path: '/workspace/.kit/config.json',
          content: '{"schema":"kit-vnext.config.v1","project":{"id":1}}',
        },
        {},
        baseContext(),
      ),
      'config-invalid',
    );
    expect(invalidConfig.appendIntents?.[0]).toMatchObject({
      type: 'PolicyResolutionFailed',
      payload: {
        reason: 'config-invalid',
      },
    });

    expectFailure(
      policy.resolveRunPolicy(
        {
          path: '/workspace/.kit/config.json',
          content: '{"schema"',
        },
        {},
        baseContext(),
      ),
      'config-invalid',
    );

    expectFailure(
      policy.resolveRunPolicy(
        configSource({
          ...baseConfig,
          profiles: {
            focused: {
              approval: {
                mode: deferredCapabilityName,
              },
            },
          },
        }),
        {},
        baseContext(),
      ),
      'unsupported-deferred-capability',
    );

    expectFailure(
      policy.resolveRunPolicy(
        configSource(),
        {
          overrides: {
            approval: {
              mode: deferredCapabilityName,
            },
          } as unknown as PolicyLayerPatch,
        },
        baseContext(),
      ),
      'unsupported-deferred-capability',
    );
  });

  it('fails closed with provenance-write-failed when the caller cannot append the returned intents', () => {
    const policy = createPolicy();
    const failure = expectFailure(
      policy.resolveRunPolicy(configSource(), {}, baseContext({ confirmAppendIntents: () => false })),
      'provenance-write-failed',
    );

    expect(failure.appendIntents?.[0]).toMatchObject({
      type: 'PolicyResolutionFailed',
      payload: {
        reason: 'provenance-write-failed',
        blockingState: 'provenance-write-failed',
      },
    });
  });
});
