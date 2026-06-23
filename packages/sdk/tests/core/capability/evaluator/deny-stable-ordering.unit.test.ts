import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { degradedAndStaleFixture } from './fixtures/degraded-and-stale.fixture.js';
import { manualAndAbsentFixture } from './fixtures/manual-and-absent.fixture.js';

describe('core-02-s2 stable failure ordering', () => {
  it('prefers run-log-degraded over stale attestation failures', () => {
    const payload = evaluateCapabilityGate(
      degradedAndStaleFixture.request,
      degradedAndStaleFixture.replay,
      degradedAndStaleFixture.projections,
    );

    expect(payload.failureReason).toBe('run-log-degraded');
  });

  it('prefers mode-disallows-capability over attestation-absent', () => {
    const payload = evaluateCapabilityGate(
      manualAndAbsentFixture.request,
      manualAndAbsentFixture.replay,
      manualAndAbsentFixture.projections,
    );

    expect(payload.failureReason).toBe('mode-disallows-capability');
  });
});
