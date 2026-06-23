import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { ambiguousLinkageFixture } from './fixtures/ambiguous-linkage.fixture.js';
import { degradedReplayFixture } from './fixtures/degraded-replay.fixture.js';

describe('core-02-s2 deny run-log-degraded', () => {
  it('denies degraded replays before attestation evaluation', () => {
    const payload = evaluateCapabilityGate(
      degradedReplayFixture.request,
      degradedReplayFixture.replay,
      degradedReplayFixture.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('run-log-degraded');
  });

  it('denies ambiguous linkage as degraded run-log input', () => {
    const payload = evaluateCapabilityGate(
      ambiguousLinkageFixture.request,
      ambiguousLinkageFixture.replay,
      ambiguousLinkageFixture.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('run-log-degraded');
  });

  it('denies missing projections as degraded run-log input', () => {
    const payload = evaluateCapabilityGate(
      degradedReplayFixture.request,
      degradedReplayFixture.replay,
      undefined as never,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('run-log-degraded');
  });
});
