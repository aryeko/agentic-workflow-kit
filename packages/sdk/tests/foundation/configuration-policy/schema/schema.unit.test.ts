import { describe, expect, it } from 'vitest';

import {
  configurationSchemaMarker,
  deferredCapabilityName,
  validateKitConfig,
  validatePolicyLayer,
  validatePolicyLayerPatch,
  validateRunConfigInput,
} from '../../../../src/foundation/configuration-policy/schema/index.js';
import { builtInPolicyLayerDefaults } from '../../../../src/foundation/configuration-policy/defaults/index.js';

describe('fnd-01-s1-config-schema schema validation', () => {
  it('accepts the vNext marker and valid policy patches', () => {
    const validConfig = {
      schema: configurationSchemaMarker,
      project: {
        id: 'workflow-kit',
        rootPolicy: 'single-repo' as const,
        tracks: ['epic-1'],
      },
      profiles: {
        focused: {
          approval: {
            mode: 'assisted' as const,
            decisionWindowMs: 900_000,
          },
          capabilities: {
            'auto-recover': {
              desired: false,
            },
          },
        },
      },
    };

    const result = validateKitConfig(validConfig);

    expect(result).toEqual({
      ok: true,
      value: validConfig,
    });
  });

  it.each([
    ['missing schema marker', { project: { id: 'workflow-kit', rootPolicy: 'single-repo' } }],
    [
      'unknown schema marker',
      { schema: 'kit-vnext.config.v2', project: { id: 'workflow-kit', rootPolicy: 'single-repo' } },
    ],
    [
      'legacy schema marker',
      { schema: 'kit-v1.config.v1', project: { id: 'workflow-kit', rootPolicy: 'single-repo' } },
    ],
  ])('rejects %s with config-invalid', (_label, candidate) => {
    const result = validateKitConfig(candidate);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.token).toBe('config-invalid');
    }
  });

  it.each([
    [
      'root field',
      { schema: configurationSchemaMarker, project: { id: 'workflow-kit', rootPolicy: 'single-repo' }, extra: true },
    ],
    [
      'project field',
      { schema: configurationSchemaMarker, project: { id: 'workflow-kit', rootPolicy: 'single-repo', extra: true } },
    ],
    [
      'profile field',
      {
        schema: configurationSchemaMarker,
        project: { id: 'workflow-kit', rootPolicy: 'single-repo' },
        profiles: { focused: { approval: { mode: 'assisted' as const }, extra: true } },
      },
    ],
    [
      'nested policy field',
      {
        schema: configurationSchemaMarker,
        project: { id: 'workflow-kit', rootPolicy: 'single-repo' },
        profiles: { focused: { approval: { mode: 'assisted' as const, extra: true } } },
      },
    ],
  ])('rejects unknown %s with config-invalid', (_label, candidate) => {
    const result = validateKitConfig(candidate);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.token).toBe('config-invalid');
    }
  });

  it('rejects orchestrator-decide when used as a deferred policy mode', () => {
    const configResult = validateKitConfig({
      schema: configurationSchemaMarker,
      project: { id: 'workflow-kit', rootPolicy: 'single-repo' },
      profiles: {
        deferred: {
          approval: {
            mode: deferredCapabilityName,
          },
        },
      },
    });

    const patchResult = validatePolicyLayerPatch({
      approval: {
        mode: deferredCapabilityName,
      },
    });

    const runInputResult = validateRunConfigInput({
      overrides: {
        approval: {
          mode: deferredCapabilityName,
        },
      },
    });

    for (const result of [configResult, patchResult, runInputResult]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.token).toBe('unsupported-deferred-capability');
      }
    }
  });

  it('accepts orchestrator-decide as ordinary policy metadata text', () => {
    const result = validatePolicyLayerPatch({
      egress: {
        rules: [
          {
            credentialRefIds: [],
            protocols: ['https'],
            hosts: ['example.test'],
            phase: 'planning',
            purpose: 'document orchestrator-decide migration notes',
          },
        ],
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        egress: {
          rules: [
            {
              credentialRefIds: [],
              protocols: ['https'],
              hosts: ['example.test'],
              phase: 'planning',
              purpose: 'document orchestrator-decide migration notes',
            },
          ],
        },
      },
    });
  });

  it('validates the complete built-in policy layer without mutation', () => {
    const result = validatePolicyLayer(builtInPolicyLayerDefaults);

    expect(result).toEqual({
      ok: true,
      value: builtInPolicyLayerDefaults,
    });
  });
});
