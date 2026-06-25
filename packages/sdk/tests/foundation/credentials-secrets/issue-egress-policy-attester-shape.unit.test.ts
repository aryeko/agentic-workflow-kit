import { describe, expect, it } from 'vitest';

import { issueEgressPolicy, type EgressPolicySource } from '../../../src/index.js';
import { egressSource, hashText, ref, scope } from './injection/resolve-credential.test-helpers.js';

/**
 * fnd-04-r1 finding #7 — `resolveRequiredAttesters` must emit only the five
 * design-shape keys and must never fabricate `platform`/`driverVersion` (nor the
 * `'runtime-metadata-missing'` sentinel that the delivered code used as a fallback).
 */

const planDependencies = {
  hashText,
  at: '2026-06-22T10:00:30.000Z',
  prevEventHash: 'digest:previous',
};

describe('fnd-04-r1 issueEgressPolicy required-attester shape', () => {
  it('emits exactly the five design-shape keys for each required attester', () => {
    const policy = issueEgressPolicy(
      {
        refs: [ref],
        scope,
        egressSource,
      },
      planDependencies,
    );

    expect(policy.ok).toBe(true);
    if (!policy.ok) {
      return;
    }

    expect(policy.value.requiredAttesters.length).toBeGreaterThan(0);
    for (const requiredAttester of policy.value.requiredAttesters) {
      expect(Object.keys(requiredAttester)).toEqual([
        'point',
        'capability',
        'driverId',
        'scopeDigest',
        'egressPolicyDigest',
      ]);
    }
  });

  it('never emits the runtime-metadata-missing fabrication', () => {
    const policy = issueEgressPolicy(
      {
        refs: [ref],
        scope,
        egressSource,
      },
      planDependencies,
    );

    expect(policy.ok).toBe(true);
    if (!policy.ok) {
      return;
    }

    const serialized = JSON.stringify(policy.value.requiredAttesters);
    expect(serialized).not.toContain('runtime-metadata-missing');
    expect(serialized).not.toContain('platform');
    expect(serialized).not.toContain('driverVersion');
    expect(serialized).not.toContain('runtimeMetadataAvailable');
  });

  it('produces the design shape regardless of declared egress-source attesters', () => {
    const source: EgressPolicySource = {
      ...egressSource,
      requiredAttesters: [
        { point: 'execution-host', capability: 'egress-confinement', driverId: 'driver-a' },
        { point: 'execution-host', capability: 'egress-confinement', driverId: 'driver-b' },
      ],
    };

    const policy = issueEgressPolicy({ refs: [ref], scope, egressSource: source }, planDependencies);

    expect(policy.ok).toBe(true);
    if (!policy.ok) {
      return;
    }

    expect(policy.value.requiredAttesters.map((attester) => attester.driverId)).toEqual(['driver-a', 'driver-b']);
    for (const requiredAttester of policy.value.requiredAttesters) {
      expect(Object.keys(requiredAttester)).toEqual([
        'point',
        'capability',
        'driverId',
        'scopeDigest',
        'egressPolicyDigest',
      ]);
    }
  });
});
