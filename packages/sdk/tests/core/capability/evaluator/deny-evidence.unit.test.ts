import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { evidenceAbsentFixture } from './fixtures/evidence-absent.fixture.js';
import { evidenceAmbiguousFixture } from './fixtures/evidence-ambiguous.fixture.js';

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
});
