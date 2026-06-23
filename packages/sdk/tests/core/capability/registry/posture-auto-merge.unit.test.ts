import { describe, expect, it } from 'vitest';

import { capabilityPostureCatalog } from '../../../../src/index.js';

import { expectedAutoMergeAttestations } from './shared.js';

describe('core-02-s1 auto-merge posture', () => {
  it('requires the exact forge and work source attestations', () => {
    expect(capabilityPostureCatalog['auto-merge'].requiredAttestations).toEqual(expectedAutoMergeAttestations);
  });
});
