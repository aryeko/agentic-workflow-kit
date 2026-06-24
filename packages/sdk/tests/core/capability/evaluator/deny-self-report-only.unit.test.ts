import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { schemaOnlyLivenessFixture } from './fixtures/schema-only-liveness.fixture.js';
import { selfReportProseFixture } from './fixtures/self-report-prose.fixture.js';
import { createAllowAutoMergeScenario, createEvidenceEvent, defaultEvidenceRefs } from './shared.js';

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

  it('denies when any required evidence ref is self-report-only', () => {
    const scenario = createAllowAutoMergeScenario();
    const replayEvents = [
      createEvidenceEvent('evt-evidence-head-probe', 1, defaultEvidenceRefs[0], {
        supportKind: 'probe',
        value: 'abc123',
      }),
      createEvidenceEvent('evt-evidence-verify-self-report', 2, defaultEvidenceRefs[1], {
        supportKind: 'self-report',
        value: 'worker says verified',
      }),
      ...scenario.replay.events.slice(2),
    ];

    const payload = evaluateCapabilityGate(
      scenario.request,
      {
        ...scenario.replay,
        events: replayEvents,
      },
      scenario.projections,
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

  it('reports self-report-only before missing attestations', () => {
    const scenario = createAllowAutoMergeScenario();
    const replayEvents = [
      createEvidenceEvent('evt-evidence-head-self-report', 1, defaultEvidenceRefs[0], {
        supportKind: 'self-report',
        value: 'worker says head is abc123',
      }),
      createEvidenceEvent('evt-evidence-verify-self-report', 2, defaultEvidenceRefs[1], {
        supportKind: 'self-report',
        value: 'worker says verification passed',
      }),
    ];

    const payload = evaluateCapabilityGate(
      scenario.request,
      {
        ...scenario.replay,
        events: replayEvents,
        lastSequence: 2,
      },
      scenario.projections,
    );

    const evidenceGuarantee = payload.evaluatedGuarantees.find(
      (guarantee) => guarantee.guaranteeId === 'recorded-evidence-unambiguous-not-self-report',
    );
    const attestationGuarantee = payload.evaluatedGuarantees.find(
      (guarantee) => guarantee.guaranteeId === 'attestations-fresh-positive-in-scope-non-contradictory-replayable',
    );

    expect(payload.failureReason).toBe('self-report-only');
    expect(evidenceGuarantee).toMatchObject({
      passed: false,
      failureReason: 'self-report-only',
    });
    expect(attestationGuarantee).toMatchObject({
      passed: false,
      failureReason: 'attestation-absent',
    });
  });
});
