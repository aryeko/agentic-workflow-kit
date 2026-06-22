import { describe, expect, it } from 'vitest';

import { consumerPolicyShapes } from '../../../../src/foundation/configuration-policy/policy-shapes/index.js';

describe('fnd-01-s1-config-schema consumer policy shapes', () => {
  it('expose desired powers and policy source data only', () => {
    expect(consumerPolicyShapes).toEqual({
      run: {
        exposure: 'desired-powers',
        fields: ['mode', 'maxConcurrentRuns', 'requireCleanWorkspace'],
      },
      provisioning: {
        exposure: 'desired-powers',
        fields: ['ownershipClass', 'containmentRequired', 'dependencyInstall'],
      },
      approval: {
        exposure: 'desired-powers',
        fields: ['mode', 'parkOnHumanLatency', 'requireRecordedDecision', 'decisionWindowMs'],
      },
      escalationPolicy: {
        exposure: 'desired-powers',
        fields: ['allowedGrantScopes', 'maxGrantScope', 'denyByDefault', 'grantRules'],
      },
      changePolicy: {
        exposure: 'desired-powers',
        fields: ['allowedChangePaths'],
      },
      capabilities: {
        exposure: 'desired-powers',
        fields: ['auto-merge', 'auto-recover', 'unattended-run', 'escalation-auto-grant'],
      },
      credentialRefs: {
        exposure: 'policy-source-data',
        fields: ['refs'],
      },
      egress: {
        exposure: 'policy-source-data',
        fields: ['defaultAction', 'rules', 'negativeProbes', 'requiredAttesters'],
      },
      merge: {
        exposure: 'desired-powers',
        fields: ['runnerMayPush', 'runnerMayOpenPr', 'runnerMayMerge', 'requiredEvidence', 'mergeMethod'],
      },
    });

    for (const shape of Object.values(consumerPolicyShapes)) {
      expect(Object.keys(shape).sort()).toEqual(['exposure', 'fields']);
      expect(shape).not.toHaveProperty('apply');
      expect(shape).not.toHaveProperty('resolve');
      expect(shape).not.toHaveProperty('secret');
      expect(shape).not.toHaveProperty('credential');
    }
  });
});
