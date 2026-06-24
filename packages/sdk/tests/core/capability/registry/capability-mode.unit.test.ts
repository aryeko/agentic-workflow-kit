import { describe, expect, it } from 'vitest';

import type { CapabilityMode } from '../../../../src/index.js';

import { assertNever, expectedCapabilityModes } from './shared.js';

const describeMode = (value: CapabilityMode): string => {
  switch (value) {
    case 'manual':
    case 'assisted':
      return value;
    default:
      return assertNever(value);
  }
};

describe('core-02-s1 capability modes', () => {
  it('defines the exact mode members', () => {
    expect(expectedCapabilityModes.map(describeMode)).toEqual(expectedCapabilityModes);
  });
});
