import { describe, expect, it } from 'vitest';

import {
  deferredCapabilityName,
  validatePolicyLayerPatch,
  validatePolicyLayer,
} from '../../../../src/foundation/configuration-policy/schema/index.js';

const expectFailureToken = (
  result: ReturnType<typeof validatePolicyLayerPatch>,
  token: 'config-invalid' | 'unsupported-deferred-capability',
) => {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.token).toBe(token);
  }
};

describe('fnd-01-s1-config-schema validation branches', () => {
  it.each([
    ['run mode', { run: { mode: 'manualish' } }],
    ['run maxConcurrentRuns', { run: { maxConcurrentRuns: -1 } }],
    ['run requireCleanWorkspace', { run: { requireCleanWorkspace: 'yes' } }],
    ['run maxConcurrentRuns non-integer', { run: { maxConcurrentRuns: 1.5 } }],
    ['provisioning ownershipClass', { provisioning: { ownershipClass: 'shared' } }],
    ['provisioning containmentRequired', { provisioning: { containmentRequired: 'sometimes' } }],
    ['provisioning dependencyInstall type', { provisioning: { dependencyInstall: 'installer' } }],
    ['dependencyInstall defaultGrant', { provisioning: { dependencyInstall: { defaultGrant: 'broad' } } }],
    ['dependencyInstall allowedPrefixes', { provisioning: { dependencyInstall: { allowedPrefixes: [1, 2, 3] } } }],
    ['approval mode', { approval: { mode: 'orchestrator-decide' } }, 'unsupported-deferred-capability'],
    ['approval parkOnHumanLatency', { approval: { parkOnHumanLatency: 'sometimes' } }],
    ['approval requireRecordedDecision', { approval: { requireRecordedDecision: 'always' } }],
    ['approval decisionWindowMs', { approval: { decisionWindowMs: -5 } }],
    ['escalation allowedGrantScopes', { escalationPolicy: { allowedGrantScopes: ['per-command', 'invalid'] } }],
    ['escalation maxGrantScope', { escalationPolicy: { maxGrantScope: 'session-x' } }],
    ['escalation denyByDefault', { escalationPolicy: { denyByDefault: 'yes' } }],
    ['escalation grantRules type', { escalationPolicy: { grantRules: 'not-an-array' } }],
    ['escalation grantRules reason', { escalationPolicy: { grantRules: [{ reason: 'oops' }] } }],
    ['escalation grantRules scope', { escalationPolicy: { grantRules: [{ scope: 'per-session' }] } }],
    ['escalation grantRules prefixes', { escalationPolicy: { grantRules: [{ prefixes: [1] }] } }],
    ['escalation grantRules requiresOperator', { escalationPolicy: { grantRules: [{ requiresOperator: 'yes' }] } }],
    ['changePolicy allowedChangePaths', { changePolicy: { allowedChangePaths: [1] } }],
    ['capabilities desired', { capabilities: { 'auto-merge': { desired: 'yes' } } }],
    ['capabilities requireFreshAttestation', { capabilities: { 'auto-merge': { requireFreshAttestation: false } } }],
    ['credentialRefs type', { credentialRefs: { refs: 'not-an-array' } }],
    [
      'credentialRefs id',
      {
        credentialRefs: {
          refs: [
            {
              id: 1,
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs purpose',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 1,
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs secret type',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: 'env',
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs secret key',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 1 },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs secret key missing',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env' },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs secret source missing',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { key: 'REGISTRY_TOKEN' },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs secret version',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN', version: 1 },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs allowedPhases',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedParties: ['worker'],
              allowedPhases: [1],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs allowedHosts',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: [1],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs kind',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'unknown',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs secret source',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'vault', key: 'REGISTRY_TOKEN' },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs allowedParties missing',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs allowedParties type',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedParties: 'worker',
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs allowedPhases missing',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedParties: ['worker'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs allowedHosts missing',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs ttlSeconds missing',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
            },
          ],
        },
      },
    ],
    [
      'credentialRefs allowedParties',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedParties: ['runner', 'owner'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 60,
            },
          ],
        },
      },
    ],
    [
      'credentialRefs ttlSeconds',
      {
        credentialRefs: {
          refs: [
            {
              id: 'registry',
              kind: 'registry-read',
              purpose: 'read registry',
              secret: { source: 'env', key: 'REGISTRY_TOKEN' },
              allowedParties: ['worker'],
              allowedPhases: ['build'],
              allowedHosts: ['registry.example.com'],
              ttlSeconds: 0,
            },
          ],
        },
      },
    ],
    ['egress defaultAction', { egress: { defaultAction: 'allow' } }],
    ['egress rules type', { egress: { rules: 'not-an-array' } }],
    [
      'egress rule credentialRefIds',
      {
        egress: {
          rules: [
            {
              credentialRefIds: 'registry',
              protocols: ['https'],
              hosts: ['example.com'],
              phase: 'build',
              purpose: 'download',
            },
          ],
        },
      },
    ],
    [
      'egress rule hosts',
      {
        egress: {
          rules: [
            { credentialRefIds: ['registry'], protocols: ['https'], hosts: [1], phase: 'build', purpose: 'download' },
          ],
        },
      },
    ],
    [
      'egress rule phase',
      {
        egress: {
          rules: [
            {
              credentialRefIds: ['registry'],
              protocols: ['https'],
              hosts: ['example.com'],
              phase: 1,
              purpose: 'download',
            },
          ],
        },
      },
    ],
    [
      'egress rule purpose',
      {
        egress: {
          rules: [
            {
              credentialRefIds: ['registry'],
              protocols: ['https'],
              hosts: ['example.com'],
              phase: 'build',
              purpose: 1,
            },
          ],
        },
      },
    ],
    [
      'egress rule protocol',
      {
        egress: {
          rules: [
            {
              credentialRefIds: ['registry'],
              protocols: ['ftp'],
              hosts: ['example.com'],
              phase: 'build',
              purpose: 'download',
            },
          ],
        },
      },
    ],
    [
      'egress rule ports',
      {
        egress: {
          rules: [
            {
              credentialRefIds: ['registry'],
              protocols: ['https'],
              hosts: ['example.com'],
              ports: [-1],
              phase: 'build',
              purpose: 'download',
            },
          ],
        },
      },
    ],
    [
      'egress negative probe host',
      { egress: { negativeProbes: [{ host: 1, protocol: 'https', expected: 'blocked', reason: 'probe' }] } },
    ],
    ['egress negative probe type', { egress: { negativeProbes: ['bad' as unknown as Record<string, unknown>] } }],
    [
      'egress negative probe protocol missing',
      { egress: { negativeProbes: [{ host: 'example.com', expected: 'blocked', reason: 'probe' }] } },
    ],
    [
      'egress negative probe protocol',
      { egress: { negativeProbes: [{ host: 'example.com', protocol: 'ftp', expected: 'blocked', reason: 'probe' }] } },
    ],
    [
      'egress negative probe expected missing',
      { egress: { negativeProbes: [{ host: 'example.com', protocol: 'https', reason: 'probe' }] } },
    ],
    [
      'egress negative probe reason',
      { egress: { negativeProbes: [{ host: 'example.com', protocol: 'https', expected: 'blocked', reason: 1 }] } },
    ],
    [
      'egress negative probe reason missing',
      { egress: { negativeProbes: [{ host: 'example.com', protocol: 'https', expected: 'blocked' }] } },
    ],
    [
      'egress negative probe expected',
      {
        egress: { negativeProbes: [{ host: 'example.com', protocol: 'https', expected: 'allowed', reason: 'probe' }] },
      },
    ],
    ['egress required attesters type', { egress: { requiredAttesters: 'runner' } }],
    [
      'egress required attester type',
      { egress: { requiredAttesters: ['runner' as unknown as Record<string, unknown>] } },
    ],
    [
      'egress required attester unknown field',
      {
        egress: {
          requiredAttesters: [
            { point: 'execution-host', capability: 'egress-confinement', driverId: 'local', extra: true },
          ],
        },
      },
    ],
    [
      'egress required attester point',
      { egress: { requiredAttesters: [{ point: 'runner', capability: 'egress-confinement', driverId: 'local' }] } },
    ],
    [
      'egress required attester point missing',
      { egress: { requiredAttesters: [{ capability: 'egress-confinement', driverId: 'local' }] } },
    ],
    [
      'egress required attester capability',
      { egress: { requiredAttesters: [{ point: 'execution-host', capability: 'network', driverId: 'local' }] } },
    ],
    [
      'egress required attester capability missing',
      { egress: { requiredAttesters: [{ point: 'execution-host', driverId: 'local' }] } },
    ],
    [
      'egress required attester driverId missing',
      { egress: { requiredAttesters: [{ point: 'execution-host', capability: 'egress-confinement' }] } },
    ],
    [
      'egress required attester driverId',
      { egress: { requiredAttesters: [{ point: 'execution-host', capability: 'egress-confinement', driverId: 1 }] } },
    ],
    ['merge runnerMayPush', { merge: { runnerMayPush: 'sometimes' } }],
    ['merge runnerMayOpenPr', { merge: { runnerMayOpenPr: 'sometimes' } }],
    ['merge runnerMayMerge', { merge: { runnerMayMerge: 'sometimes' } }],
    ['merge requiredEvidence type', { merge: { requiredEvidence: 'verification' } }],
    ['merge requiredEvidence', { merge: { requiredEvidence: ['verification', 'bogus'] } }],
    ['merge unknown field', { merge: { extra: true } }],
    ['merge mergeMethod', { merge: { mergeMethod: 'fast-forward' } }],
  ])('rejects %s', (_label, candidate, token = 'config-invalid') => {
    expectFailureToken(
      validatePolicyLayerPatch(candidate),
      token as 'config-invalid' | 'unsupported-deferred-capability',
    );
  });

  it('rejects deferred capability in a full policy layer', () => {
    const result = validatePolicyLayer({
      approval: {
        mode: deferredCapabilityName,
      },
    } as unknown as Record<string, unknown>);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.token).toBe('unsupported-deferred-capability');
    }
  });
});
