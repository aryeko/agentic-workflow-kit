import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { schemaOnlyLivenessFixture } from './fixtures/schema-only-liveness.fixture.js';
import { selfReportProseFixture } from './fixtures/self-report-prose.fixture.js';

describe('core-02-s2 deny self-report-only evidence', () => {
  it('denies worker prose and guardian text as the only support', () => {
    const payload = evaluateCapabilityGate(
      selfReportProseFixture.request,
      selfReportProseFixture.replay,
      selfReportProseFixture.projections,
    );
    const evidenceGuarantee = payload.evaluatedGuarantees.find(
      (guarantee) => guarantee.guaranteeId === 'recorded-evidence-unambiguous-not-self-report',
    );

    expect(payload.failureReason).toBe('self-report-only');
    expect(evidenceGuarantee).toMatchObject({
      passed: false,
      failureReason: 'self-report-only',
    });
  });

  it('denies schema-only behavioral evidence as the only support', () => {
    const payload = evaluateCapabilityGate(
      schemaOnlyLivenessFixture.request,
      schemaOnlyLivenessFixture.replay,
      schemaOnlyLivenessFixture.projections,
    );
    const evidenceGuarantee = payload.evaluatedGuarantees.find(
      (guarantee) => guarantee.guaranteeId === 'recorded-evidence-unambiguous-not-self-report',
    );

    expect(payload.failureReason).toBe('self-report-only');
    expect(evidenceGuarantee).toMatchObject({
      passed: false,
      failureReason: 'self-report-only',
    });
  });
});
