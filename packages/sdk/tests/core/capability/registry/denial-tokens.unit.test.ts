import { describe, expect, it } from 'vitest';

import type { CapabilityRegistryDenialToken } from '../../../../src/index.js';

import { assertNever, expectedDenialTokens } from './shared.js';

const describeDenialToken = (value: CapabilityRegistryDenialToken): string => {
  switch (value) {
    case 'mode-disallows-capability':
    case 'policy-disallows-capability':
    case 'capability-deferred':
      return value;
    default:
      return assertNever(value);
  }
};

describe('core-02-s1 denial token registry', () => {
  it('defines the exact registry denial tokens', () => {
    expect(expectedDenialTokens.map(describeDenialToken)).toEqual(expectedDenialTokens);
  });
});
