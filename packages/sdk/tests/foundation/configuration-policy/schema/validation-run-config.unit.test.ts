import { describe, expect, it } from 'vitest';

import {
  configurationSchemaMarker,
  deferredCapabilityName,
  validateKitConfig,
  validatePolicyLayerPatch,
  validateRunConfigInput,
} from '../../../../src/foundation/configuration-policy/schema/index.js';

const expectFailureToken = (
  result:
    | ReturnType<typeof validatePolicyLayerPatch>
    | ReturnType<typeof validateKitConfig>
    | ReturnType<typeof validateRunConfigInput>,
  token: 'config-invalid' | 'unsupported-deferred-capability',
) => {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.token).toBe(token);
  }
};

const validKitConfig = {
  schema: configurationSchemaMarker,
  project: {
    id: 'workflow-kit',
    rootPolicy: 'single-repo',
    tracks: ['epic-1', 'epic-2'],
  },
  profiles: {
    focused: {
      run: {
        mode: 'assisted',
        maxConcurrentRuns: 2,
        requireCleanWorkspace: true,
      },
      provisioning: {
        ownershipClass: 'owned',
        containmentRequired: true,
        dependencyInstall: {
          defaultGrant: 'narrow',
          allowedPrefixes: ['pnpm install ', 'pnpm add '],
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
        grantRules: [
          {
            reason: 'dependency-install',
            scope: 'per-command-prefix',
            prefixes: ['pnpm install ', 'pnpm add '],
            requiresOperator: false,
          },
        ],
      },
      changePolicy: {
        allowedChangePaths: ['packages/sdk/src/foundation/configuration-policy/**'],
      },
      capabilities: {
        'auto-merge': { desired: false, requireFreshAttestation: true },
        'auto-recover': { desired: false, requireFreshAttestation: true },
        'unattended-run': { desired: false, requireFreshAttestation: true },
        'escalation-auto-grant': { desired: false, requireFreshAttestation: true },
      },
      credentialRefs: { refs: [] },
      egress: {
        defaultAction: 'deny',
        rules: [],
        negativeProbes: [],
        requiredAttesters: [],
      },
      merge: {
        runnerMayPush: false,
        runnerMayOpenPr: true,
        runnerMayMerge: false,
        requiredEvidence: ['verification', 'ci', 'review', 'threads-resolved', 'protection'],
        mergeMethod: 'merge',
      },
    },
  },
} as const;

describe('fnd-01-s1-config-schema run and kit envelopes', () => {
  it('rejects orchestrator-decide in run input overrides', () => {
    expectFailureToken(
      validateRunConfigInput({
        overrides: {
          approval: {
            mode: deferredCapabilityName,
          },
        },
      }),
      'unsupported-deferred-capability',
    );
  });

  it('rejects orchestrator-decide in config profiles', () => {
    expectFailureToken(
      validateKitConfig({
        schema: configurationSchemaMarker,
        project: {
          id: 'workflow-kit',
          rootPolicy: 'single-repo',
        },
        profiles: {
          deferred: {
            approval: {
              mode: 'orchestrator-decide',
            },
          },
        },
      }),
      'unsupported-deferred-capability',
    );
  });

  it('rejects non-object config envelopes and unknown run fields', () => {
    expectFailureToken(validateKitConfig('nope'), 'config-invalid');
    expectFailureToken(
      validateRunConfigInput({
        run: {
          taskId: 'task-123',
          trackId: 'track-1',
          dryRun: false,
          extra: true,
        } as unknown as Record<string, unknown>,
      }),
      'config-invalid',
    );
    expectFailureToken(
      validateKitConfig({
        schema: configurationSchemaMarker,
        project: {
          id: 'workflow-kit',
          rootPolicy: 'single-repo',
        },
        profiles: {
          deferred: 'orchestrator-decide' as unknown as never,
        },
      }),
      'unsupported-deferred-capability',
    );
  });

  it('rejects invalid kit config project and profiles shapes', () => {
    expectFailureToken(
      validateKitConfig({
        schema: configurationSchemaMarker,
        project: {
          id: 'workflow-kit',
          rootPolicy: 'single-repo',
          tracks: [1],
        },
      }),
      'config-invalid',
    );

    expectFailureToken(
      validateKitConfig({
        schema: configurationSchemaMarker,
        project: 'workflow-kit' as unknown as Record<string, unknown>,
      }),
      'config-invalid',
    );

    expectFailureToken(
      validateKitConfig({
        schema: configurationSchemaMarker,
        project: {
          id: 'workflow-kit',
          rootPolicy: 'single-repo',
        },
        profiles: 'focused' as unknown as Record<string, unknown>,
      }),
      'config-invalid',
    );

    expectFailureToken(
      validateKitConfig({
        schema: configurationSchemaMarker,
        project: {
          id: 'workflow-kit',
          rootPolicy: 'single-repo',
        },
        profiles: {
          focused: { extra: true } as unknown as Record<string, unknown>,
        },
      }),
      'config-invalid',
    );

    expectFailureToken(
      validateKitConfig({
        schema: configurationSchemaMarker,
        project: {
          id: 1 as unknown as string,
          rootPolicy: 'wrong',
        },
      }),
      'config-invalid',
    );
  });

  it('rejects non-object run config input', () => {
    expectFailureToken(validateRunConfigInput('nope'), 'config-invalid');
  });

  it('rejects unknown run fields and invalid overrides', () => {
    expectFailureToken(validateRunConfigInput({ extra: true } as unknown as Record<string, unknown>), 'config-invalid');
    expectFailureToken(
      validateRunConfigInput({
        run: {
          taskId: 'task-123',
          trackId: 'track-1',
          dryRun: false,
          extra: true,
        } as unknown as Record<string, unknown>,
      }),
      'config-invalid',
    );
    expectFailureToken(
      validateRunConfigInput({
        run: {
          taskId: 'task-123',
          trackId: 'track-1',
          dryRun: 'nope',
        } as unknown as Record<string, unknown>,
      }),
      'config-invalid',
    );
    expectFailureToken(
      validateRunConfigInput({
        overrides: {
          run: {
            mode: 'assisted',
            maxConcurrentRuns: 1,
            requireCleanWorkspace: true,
            extra: true,
          } as unknown as Record<string, unknown>,
        },
      }),
      'config-invalid',
    );
  });

  it('accepts valid run and config envelopes', () => {
    expect(validateRunConfigInput(undefined)).toEqual({
      ok: true,
      value: {},
    });

    expect(validatePolicyLayerPatch({})).toEqual({
      ok: true,
      value: {},
    });

    expect(
      validateRunConfigInput({
        profile: 'focused',
        overrides: {
          run: {
            mode: 'assisted',
            maxConcurrentRuns: 2,
            requireCleanWorkspace: true,
          },
        },
        run: {
          taskId: 'task-123',
          trackId: 'track-1',
          dryRun: false,
        },
      }),
    ).toEqual({
      ok: true,
      value: {
        profile: 'focused',
        overrides: {
          run: {
            mode: 'assisted',
            maxConcurrentRuns: 2,
            requireCleanWorkspace: true,
          },
        },
        run: {
          taskId: 'task-123',
          trackId: 'track-1',
          dryRun: false,
        },
      },
    });

    expect(validateKitConfig(validKitConfig)).toEqual({
      ok: true,
      value: validKitConfig,
    });
  });
});
