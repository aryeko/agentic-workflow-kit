import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { evidenceAbsentFixture } from './fixtures/evidence-absent.fixture.js';
import { evidenceAmbiguousFixture } from './fixtures/evidence-ambiguous.fixture.js';
import { createAllowAutoMergeScenario, createEvidenceEvent, defaultEvidenceRefs } from './shared.js';

describe('core-02-s2 deny required evidence failures', () => {
  it('denies missing recorded evidence refs', () => {
    const payload = evaluateCapabilityGate(
      evidenceAbsentFixture.request,
      evidenceAbsentFixture.replay,
      evidenceAbsentFixture.projections,
    );
    const evidenceGuarantee = payload.evaluatedGuarantees.find(
      (guarantee) => guarantee.guaranteeId === 'recorded-evidence-unambiguous-not-self-report',
    );

    expect(payload.failureReason).toBe('required-evidence-absent');
    expect(evidenceGuarantee).toMatchObject({
      passed: false,
      failureReason: 'required-evidence-absent',
    });
  });

  it('denies empty required evidence refs', () => {
    const scenario = createAllowAutoMergeScenario();
    const payload = evaluateCapabilityGate(
      {
        ...scenario.request,
        evidenceRefs: [],
      },
      scenario.replay,
      scenario.projections,
    );
    const evidenceGuarantee = payload.evaluatedGuarantees.find(
      (guarantee) => guarantee.guaranteeId === 'recorded-evidence-unambiguous-not-self-report',
    );

    expect(payload.failureReason).toBe('required-evidence-absent');
    expect(evidenceGuarantee).toMatchObject({
      passed: false,
      evidenceRefs: [],
      failureReason: 'required-evidence-absent',
    });
  });

  it('denies ambiguous recorded evidence refs', () => {
    const payload = evaluateCapabilityGate(
      evidenceAmbiguousFixture.request,
      evidenceAmbiguousFixture.replay,
      evidenceAmbiguousFixture.projections,
    );
    const evidenceGuarantee = payload.evaluatedGuarantees.find(
      (guarantee) => guarantee.guaranteeId === 'recorded-evidence-unambiguous-not-self-report',
    );

    expect(payload.failureReason).toBe('required-evidence-ambiguous');
    expect(evidenceGuarantee).toMatchObject({
      passed: false,
      failureReason: 'required-evidence-ambiguous',
    });
  });

  it('denies evidence recorded after the gate time', () => {
    const scenario = createAllowAutoMergeScenario();
    const futureEvidenceEvents = [
      createEvidenceEvent('evt-evidence-head-future', 7, defaultEvidenceRefs[0], {
        value: 'abc123',
      }),
      createEvidenceEvent('evt-evidence-verify-future', 8, defaultEvidenceRefs[1], {
        value: 'verified',
      }),
    ].map((event) => ({
      ...event,
      occurredAt: '2026-06-23T12:00:01.000Z',
      recordedAt: '2026-06-23T12:00:01.000Z',
    }));
    const payload = evaluateCapabilityGate(
      scenario.request,
      {
        ...scenario.replay,
        events: [...futureEvidenceEvents, ...scenario.replay.events.slice(2)],
      },
      scenario.projections,
    );

    expect(payload.failureReason).toBe('required-evidence-absent');
  });
});
