import { describe, expect, it } from 'vitest';

import { capabilityPostureCatalog } from '../../../../src/index.js';

import { expectedEscalationAttestations } from './shared.js';

describe('core-02-s1 escalation posture', () => {
  it('requires the exact approval relay and egress attestations', () => {
    expect(capabilityPostureCatalog['escalation-auto-grant'].requiredAttestations).toEqual(
      expectedEscalationAttestations,
    );
  });
});
