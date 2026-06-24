import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { contradictoryAttestationsFixture } from './fixtures/contradictory-attestations.fixture.js';
import { negativeAttestationFixture } from './fixtures/negative-attestation.fixture.js';
import { createAllowAutoMergeScenario, createAttestationEvent, createEvidenceEvent, createReplay } from './shared.js';

describe('core-02-s2 deny attestation negative and contradictory', () => {
  it('denies fresh in-scope negative attestations', () => {
    const payload = evaluateCapabilityGate(
      negativeAttestationFixture.request,
      negativeAttestationFixture.replay,
      negativeAttestationFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-negative');
  });

  it('denies contradictory fresh in-scope attestations', () => {
    const payload = evaluateCapabilityGate(
      contradictoryAttestationsFixture.request,
      contradictoryAttestationsFixture.replay,
      contradictoryAttestationsFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-contradictory');
  });

  it('allows repeated positive attestations with distinct evidence refs', () => {
    const base = createAllowAutoMergeScenario();
    const events = [
      ...base.replay.events.filter((event) => event.eventId !== 'evt-forge-inspect'),
      createEvidenceEvent('evt-evidence-forge-inspect-refresh', 7, 'evidence:forge-pr-head-refresh', {
        supportKind: 'probe',
        value: 'fresh inspect probe',
      }),
      createAttestationEvent('evt-forge-inspect', 8, 'Forge', 'canInspectProtection', {
        evidenceRef: 'evidence:forge-pr-head',
      }),
      createAttestationEvent('evt-forge-inspect-refresh', 9, 'Forge', 'canInspectProtection', {
        evidenceRef: 'evidence:forge-pr-head-refresh',
      }),
    ];

    const payload = evaluateCapabilityGate(
      base.request,
      createReplay({
        ...base.replay,
        events,
        lastSequence: 9,
      }),
      base.projections,
    );

    expect(payload.decision).toBe('allow');
    expect(payload.failureReason).toBeUndefined();
  });
});
