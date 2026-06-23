import { describe, expect, it } from 'vitest';

import { capabilityPostureCatalog } from '../../../../src/index.js';

import { expectedUnattendedRunAttestations } from './shared.js';

describe('core-02-s1 unattended-run posture', () => {
  it('requires the exact work source, execution host, and agent attestations', () => {
    expect(capabilityPostureCatalog['unattended-run'].requiredAttestations).toEqual(expectedUnattendedRunAttestations);
  });
});
