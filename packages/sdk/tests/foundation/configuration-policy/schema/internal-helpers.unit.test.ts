import { describe, expect, it } from 'vitest';

import {
  configInvalid,
  findDeferredCapabilityPath,
  isFiniteNumber,
  isPlainObject,
  ok,
  rejectDeferredCapability,
  unsupportedDeferredCapability,
  validateApprovalPolicy,
  validateBoolean,
  validateCapabilityPolicy,
  validateCapabilitySetting,
  validateChangePolicy,
  validateCredentialReferencePolicy,
  validateEgressPolicySource,
  validateEnumValue,
  validateEscalationPolicy,
  validateFullSet,
  validateMergePolicy,
  validateNumber,
  validatePartialSet,
  validatePolicyLayerShape,
  validateProvisioningPolicy,
  validateRunPolicy,
  validateStringArray,
} from '../../../../src/foundation/configuration-policy/schema/validate.js';

describe('fnd-01-s1-config-schema internal validator coverage', () => {
  it('covers primitive validator helpers', () => {
    const issues: string[] = [];

    expect(configInvalid(['x'])).toEqual({ token: 'config-invalid', issues: ['x'] });
    expect(unsupportedDeferredCapability(['y'])).toEqual({
      token: 'unsupported-deferred-capability',
      issues: ['y'],
    });
    expect(ok(1)).toEqual({ ok: true, value: 1 });

    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(null)).toBe(false);
    expect(isFiniteNumber(1)).toBe(true);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);

    expect(validateStringArray('nope', 'path', issues)).toBe(false);
    expect(validateStringArray(['a', 1], 'path', issues)).toBe(false);
    expect(validateStringArray(['a', 'b'], 'path', issues)).toBe(true);

    expect(validateEnumValue('nope', 'path', ['yes'], issues)).toBe(false);
    expect(validateEnumValue('yes', 'path', ['yes'], issues)).toBe(true);

    expect(validateBoolean('nope', 'path', issues)).toBe(false);
    expect(validateBoolean(true, 'path', issues)).toBe(true);

    expect(validateNumber('nope', 'path', issues)).toBe(false);
    expect(validateNumber(3, 'path', issues)).toBe(true);

    expect(validateFullSet({ a: 1, b: 2 }, ['a'], 'path', issues)).toBe(false);
    expect(validateFullSet({ a: 1 }, ['a'], 'path', issues)).toBe(true);
    expect(validatePartialSet({ a: 1 }, ['a'], 'path', issues)).toBe(true);
  });

  it('covers deferred capability search paths', () => {
    expect(findDeferredCapabilityPath([1, 'orchestrator-decide'])).toBe('$[1]');
    expect(findDeferredCapabilityPath([1, { nested: 'orchestrator-decide' }])).toBe('$[1].nested');
    expect(findDeferredCapabilityPath({ nested: { deeper: 'orchestrator-decide' } })).toBe('$.nested.deeper');
    expect(findDeferredCapabilityPath({ 'orchestrator-decide': 1 })).toBe('$.orchestrator-decide');
    expect(findDeferredCapabilityPath({ nope: 1 })).toBeNull();

    expect(rejectDeferredCapability({ approval: { mode: 'orchestrator-decide' } }, [])).toEqual({
      token: 'unsupported-deferred-capability',
      issues: ['deferred capability is not supported at $.approval.mode'],
    });
    expect(rejectDeferredCapability({ approval: { mode: 'assisted' } }, [])).toBeNull();
  });

  it('covers direct policy helper happy and unhappy paths', () => {
    const requiredIssues: string[] = [];
    const optionalIssues: string[] = [];

    expect(validateRunPolicy(undefined, '$.run', requiredIssues, true)).toBe(false);
    expect(validateRunPolicy(undefined, '$.run', optionalIssues, false)).toBe(true);
    expect(validateRunPolicy('nope', '$.run', [], true)).toBe(false);
    expect(
      validateRunPolicy({ mode: 'manual', maxConcurrentRuns: 0, requireCleanWorkspace: true }, '$.run', [], true),
    ).toBe(true);

    expect(validateProvisioningPolicy(undefined, '$.provisioning', [], true)).toBe(false);
    expect(validateProvisioningPolicy(undefined, '$.provisioning', [], false)).toBe(true);
    expect(validateProvisioningPolicy('nope', '$.provisioning', [], true)).toBe(false);
    expect(
      validateProvisioningPolicy(
        {
          ownershipClass: 'owned',
          containmentRequired: true,
          dependencyInstall: { defaultGrant: 'narrow', allowedPrefixes: ['pnpm add '] },
        },
        '$.provisioning',
        [],
        true,
      ),
    ).toBe(true);

    expect(validateApprovalPolicy(undefined, '$.approval', [], true)).toBe(false);
    expect(validateApprovalPolicy(undefined, '$.approval', [], false)).toBe(true);
    expect(validateApprovalPolicy('nope', '$.approval', [], true)).toBe(false);
    expect(
      validateApprovalPolicy(
        {
          mode: 'assisted',
          parkOnHumanLatency: true,
          requireRecordedDecision: true,
          decisionWindowMs: 900_000,
        },
        '$.approval',
        [],
        true,
      ),
    ).toBe(true);

    expect(validateEscalationPolicy(undefined, '$.escalationPolicy', [], true)).toBe(false);
    expect(validateEscalationPolicy(undefined, '$.escalationPolicy', [], false)).toBe(true);
    expect(validateEscalationPolicy('nope', '$.escalationPolicy', [], true)).toBe(false);
    expect(
      validateEscalationPolicy(
        {
          allowedGrantScopes: ['per-command', 'per-command-prefix'],
          maxGrantScope: 'per-command-prefix',
          denyByDefault: true,
          grantRules: [{ reason: 'dependency-install', scope: 'per-command-prefix', prefixes: ['pnpm install '] }],
        },
        '$.escalationPolicy',
        [],
        true,
      ),
    ).toBe(true);

    expect(validateChangePolicy(undefined, '$.changePolicy', [], true)).toBe(false);
    expect(validateChangePolicy(undefined, '$.changePolicy', [], false)).toBe(true);
    expect(validateChangePolicy('nope', '$.changePolicy', [], true)).toBe(false);
    expect(validateChangePolicy({ allowedChangePaths: [] }, '$.changePolicy', [], true)).toBe(true);

    expect(validateCapabilitySetting(undefined, '$.capabilities.auto-merge', [], true)).toBe(false);
    expect(validateCapabilitySetting(undefined, '$.capabilities.auto-merge', [], false)).toBe(true);
    expect(validateCapabilitySetting('nope', '$.capabilities.auto-merge', [], true)).toBe(false);
    expect(
      validateCapabilitySetting(
        { desired: false, requireFreshAttestation: true },
        '$.capabilities.auto-merge',
        [],
        true,
      ),
    ).toBe(true);

    expect(validateCapabilityPolicy(undefined, '$.capabilities', [], true)).toBe(false);
    expect(validateCapabilityPolicy(undefined, '$.capabilities', [], false)).toBe(true);
    expect(validateCapabilityPolicy('nope', '$.capabilities', [], true)).toBe(false);
    expect(
      validateCapabilityPolicy(
        {
          'auto-merge': { desired: false, requireFreshAttestation: true },
          'auto-recover': { desired: false, requireFreshAttestation: true },
          'unattended-run': { desired: false, requireFreshAttestation: true },
          'escalation-auto-grant': { desired: false, requireFreshAttestation: true },
        },
        '$.capabilities',
        [],
        true,
      ),
    ).toBe(true);

    expect(validateCredentialReferencePolicy(undefined, '$.credentialRefs', [], true)).toBe(false);
    expect(validateCredentialReferencePolicy(undefined, '$.credentialRefs', [], false)).toBe(true);
    expect(validateCredentialReferencePolicy('nope', '$.credentialRefs', [], true)).toBe(false);
    expect(validateCredentialReferencePolicy({ refs: [] }, '$.credentialRefs', [], true)).toBe(true);

    expect(validateEgressPolicySource(undefined, '$.egress', [], true)).toBe(false);
    expect(validateEgressPolicySource(undefined, '$.egress', [], false)).toBe(true);
    expect(validateEgressPolicySource('nope', '$.egress', [], true)).toBe(false);
    expect(
      validateEgressPolicySource(
        {
          defaultAction: 'deny',
          rules: [
            {
              credentialRefIds: ['registry-read'],
              protocols: ['https'],
              hosts: ['registry.example.com'],
              ports: [443],
              phase: 'build',
              purpose: 'fetch packages',
            },
          ],
          negativeProbes: [{ host: 'registry.example.com', protocol: 'https', expected: 'blocked', reason: 'probe' }],
          requiredAttesters: [{ point: 'execution-host', capability: 'egress-confinement', driverId: 'local' }],
        },
        '$.egress',
        [],
        true,
      ),
    ).toBe(true);

    expect(validateMergePolicy(undefined, '$.merge', [], true)).toBe(false);
    expect(validateMergePolicy(undefined, '$.merge', [], false)).toBe(true);
    expect(validateMergePolicy('nope', '$.merge', [], true)).toBe(false);
    expect(
      validateMergePolicy(
        {
          runnerMayPush: true,
          runnerMayOpenPr: true,
          runnerMayMerge: false,
          requiredEvidence: ['verification', 'ci', 'review', 'threads-resolved', 'protection'],
        },
        '$.merge',
        [],
        true,
      ),
    ).toBe(true);
  });

  it('covers policy-layer and config-envelope helpers', () => {
    expect(validatePolicyLayerShape(undefined, '$', [], true)).toBe(false);
    expect(validatePolicyLayerShape(undefined, '$', [], false)).toBe(true);
    expect(validatePolicyLayerShape('nope', '$', [], true)).toBe(false);
    expect(
      validatePolicyLayerShape(
        {
          run: { mode: 'assisted', maxConcurrentRuns: 1, requireCleanWorkspace: true },
          provisioning: {
            ownershipClass: 'owned',
            containmentRequired: true,
            dependencyInstall: { defaultGrant: 'narrow', allowedPrefixes: ['pnpm add '] },
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
            grantRules: [{ reason: 'dependency-install', scope: 'per-command-prefix', prefixes: ['pnpm install '] }],
          },
          changePolicy: { allowedChangePaths: [] },
          capabilities: {
            'auto-merge': { desired: false, requireFreshAttestation: true },
            'auto-recover': { desired: false, requireFreshAttestation: true },
            'unattended-run': { desired: false, requireFreshAttestation: true },
            'escalation-auto-grant': { desired: false, requireFreshAttestation: true },
          },
          credentialRefs: { refs: [] },
          egress: { defaultAction: 'deny', rules: [], negativeProbes: [], requiredAttesters: [] },
          merge: {
            runnerMayPush: true,
            runnerMayOpenPr: true,
            runnerMayMerge: false,
            requiredEvidence: ['verification', 'ci', 'review', 'threads-resolved', 'protection'],
          },
        },
        '$',
        [],
        true,
      ),
    ).toBe(true);
  });
});
