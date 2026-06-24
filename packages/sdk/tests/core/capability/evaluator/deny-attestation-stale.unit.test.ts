import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { expiredAttestationFixture } from './fixtures/expired-attestation.fixture.js';
import { futureAttestationFixture } from './fixtures/future-attestation.fixture.js';
import { createAllowAutoMergeScenario } from './shared.js';

describe('core-02-s2 deny attestation stale', () => {
  it('denies expired attestations', () => {
    const payload = evaluateCapabilityGate(
      expiredAttestationFixture.request,
      expiredAttestationFixture.replay,
      expiredAttestationFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-stale');
  });

  it('denies future-dated attestations', () => {
    const payload = evaluateCapabilityGate(
      futureAttestationFixture.request,
      futureAttestationFixture.replay,
      futureAttestationFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-stale');
  });

  it('compares attestation timestamps chronologically across ISO offsets', () => {
    const scenario = createAllowAutoMergeScenario();
    const payload = evaluateCapabilityGate(
      scenario.request,
      {
        ...scenario.replay,
        events: scenario.replay.events.map((event) =>
          event.eventId === 'evt-forge-inspect'
            ? {
                ...event,
                payload: {
                  ...event.payload,
                  at: '2026-06-23T10:00:00+02:00',
                  expiry: '2026-06-23T13:00:00+02:00',
                },
              }
            : event,
        ),
      },
      scenario.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('attestation-stale');
  });
});
