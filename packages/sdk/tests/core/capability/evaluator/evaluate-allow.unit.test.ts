import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';
import { guaranteeRequirementCatalog } from '../../../../src/index.js';

import { allowAutoMergeFixture } from './fixtures/allow-auto-merge.fixture.js';

describe('core-02-s2 allow path', () => {
  it('allows a fully satisfied assisted auto-merge gate', () => {
    const payload = evaluateCapabilityGate(
      allowAutoMergeFixture.request,
      allowAutoMergeFixture.replay,
      allowAutoMergeFixture.projections,
    );

    expect(payload.decision).toBe('allow');
    expect(payload.failureReason).toBeUndefined();
    expect(payload.evaluatedGuarantees).toHaveLength(guaranteeRequirementCatalog.length);
    expect(payload.evaluatedGuarantees.every((guarantee) => guarantee.passed)).toBe(true);
    expect(payload.attestationRefs.map((ref) => ref.eventId)).toEqual([
      'evt-forge-inspect',
      'evt-forge-rulesets',
      'evt-forge-merge-queue',
      'evt-work-source-status',
    ]);
  });
});
