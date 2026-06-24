import { describe, expect, it } from 'vitest';
import type { CapabilityGateRecordPayload, GateDecision } from '../../../../src/core/capability/evaluator/index.js';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { allowAutoMergeFixture } from './fixtures/allow-auto-merge.fixture.js';
import { assertNever } from './shared.js';

const describeDecision = (decision: GateDecision): string => {
  switch (decision) {
    case 'allow':
      return 'allow';
    case 'deny':
      return 'deny';
    default:
      return assertNever(decision);
  }
};

describe('core-02-s2 gate record payload shape', () => {
  it('emits the fixed schema and exact record fields', () => {
    const payload: CapabilityGateRecordPayload = evaluateCapabilityGate(
      allowAutoMergeFixture.request,
      allowAutoMergeFixture.replay,
      allowAutoMergeFixture.projections,
    );

    expect(payload.schema).toBe('kit-vnext.capability-gate-record.v1');
    expect(Object.keys(payload).sort()).toEqual([
      'attestationRefs',
      'capability',
      'decision',
      'evaluatedAt',
      'evaluatedGuarantees',
      'evidenceRefs',
      'gateId',
      'mode',
      'policyRef',
      'requestedAction',
      'requestedByDomain',
      'schema',
      'scope',
    ]);
    expect(describeDecision(payload.decision)).toBe('allow');
  });
});
