import { describe, expect, it } from 'vitest';

import { capabilityPostureCatalog } from '../../../../src/index.js';

import { expectedAutoRecoverAttestations } from './shared.js';

describe('core-02-s1 auto-recover posture', () => {
  it('requires the exact execution host and agent attestations', () => {
    expect(capabilityPostureCatalog['auto-recover'].requiredAttestations).toEqual(expectedAutoRecoverAttestations);
  });
});
