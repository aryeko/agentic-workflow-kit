import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { manualModeFixture } from './fixtures/manual-mode.fixture.js';
import { orchestratorDecideFixture } from './fixtures/orchestrator-decide.fixture.js';
import { policyDeniesFixture } from './fixtures/policy-denies.fixture.js';

describe('core-02-s2 deny pre-evidence gates', () => {
  it('denies manual mode', () => {
    const payload = evaluateCapabilityGate(
      manualModeFixture.request,
      manualModeFixture.replay,
      manualModeFixture.projections,
    );

    expect(payload.failureReason).toBe('mode-disallows-capability');
    expect(payload.attestationRefs).toEqual([]);
  });

  it('denies policy disallow decisions', () => {
    const payload = evaluateCapabilityGate(
      policyDeniesFixture.request,
      policyDeniesFixture.replay,
      policyDeniesFixture.projections,
    );

    expect(payload.failureReason).toBe('policy-disallows-capability');
    expect(payload.attestationRefs).toEqual([]);
  });

  it('denies deferred orchestrator-decide', () => {
    const payload = evaluateCapabilityGate(
      orchestratorDecideFixture.request,
      orchestratorDecideFixture.replay,
      orchestratorDecideFixture.projections,
    );

    expect(payload.failureReason).toBe('capability-deferred');
    expect(payload.attestationRefs).toEqual([]);
  });
});
