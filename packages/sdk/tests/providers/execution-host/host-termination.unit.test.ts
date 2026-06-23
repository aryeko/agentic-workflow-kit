import { describe, expect, it } from 'vitest';

import { terminationUnprovenObservation, terminationUnprovenResult } from './fixtures/termination-unproven.fixture.js';
import { terminationResultFixture } from './fixtures/shared.js';

describe('prov-04-s1 host termination contracts', () => {
  it('requires proof on every termination result and models unproven termination as degraded proof plus observation failure', () => {
    const proven = terminationResultFixture();

    expect(proven.proof.containmentEmpty).toBe(true);
    expect(terminationUnprovenResult.proof.containmentEmpty).toBe(false);
    expect(terminationUnprovenObservation.type).toBe('host-failure');
    expect(terminationUnprovenObservation.failure.reason).toBe('termination-unproven');
  });
});
