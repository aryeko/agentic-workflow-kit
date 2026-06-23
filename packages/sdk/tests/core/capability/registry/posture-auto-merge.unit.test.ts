import { describe, expect, it } from 'vitest';

import { capabilityPostureCatalog } from '../../../../src/index.js';

import { expectedAutoMergeAttestations, expectedAutoMergeConditionalAttestations } from './shared.js';

describe('core-02-s1 auto-merge posture', () => {
  it('requires exact base and conditional forge/work source attestations', () => {
    expect(capabilityPostureCatalog['auto-merge'].requiredAttestations).toEqual(expectedAutoMergeAttestations);
    expect(capabilityPostureCatalog['auto-merge'].conditionalAttestations).toEqual(
      expectedAutoMergeConditionalAttestations,
    );
  });
});
