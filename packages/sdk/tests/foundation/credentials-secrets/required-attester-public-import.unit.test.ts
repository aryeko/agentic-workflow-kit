import type { EnforcementPoint, RequiredAttester } from 'sdk';
import { describe, expect, it } from 'vitest';

/**
 * fnd-04-r1 finding #7 — `RequiredAttester` must be importable from the public
 * `sdk` entrypoint with the narrowed 5-member shape. The type-level construction
 * is enforced at compile time by the `type:fixtures` lane (this file is included
 * by the sibling `tsconfig.public.json`); the runtime assertions below pin the
 * exact key set so the structural contract is also exercised by the unit lane.
 */

describe('fnd-04-r1 RequiredAttester public import', () => {
  it('constructs the narrowed RequiredAttester shape from the sdk entrypoint', () => {
    const point: EnforcementPoint = 'execution-host';
    const requiredAttester: RequiredAttester = {
      point,
      capability: 'egress-confinement',
      driverId: 'local-host',
      scopeDigest: 'digest:scope',
      egressPolicyDigest: 'digest:egress-policy',
    };

    expect(Object.keys(requiredAttester).sort()).toEqual(
      ['capability', 'driverId', 'egressPolicyDigest', 'point', 'scopeDigest'].sort(),
    );
    expect(requiredAttester.capability).toBe('egress-confinement');
  });
});
