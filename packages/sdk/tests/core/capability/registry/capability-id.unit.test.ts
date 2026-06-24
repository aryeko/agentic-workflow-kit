import { describe, expect, it } from 'vitest';

import type { CapabilityId } from '../../../../src/index.js';

import { assertNever, expectedCapabilityIds } from './shared.js';

const describeCapability = (value: CapabilityId): string => {
  switch (value) {
    case 'auto-merge':
    case 'auto-recover':
    case 'unattended-run':
    case 'escalation-auto-grant':
    case 'orchestrator-decide':
      return value;
    default:
      return assertNever(value);
  }
};

describe('core-02-s1 capability id registry', () => {
  it('defines the exact capability members', () => {
    expect(expectedCapabilityIds.map(describeCapability)).toEqual(expectedCapabilityIds);
  });
});
