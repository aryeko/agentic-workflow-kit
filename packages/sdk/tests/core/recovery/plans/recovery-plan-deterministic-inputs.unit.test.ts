import { describe, expect, it } from 'vitest';

import { planRecoveryAction } from '../../../../src/core/recovery/plans/index.js';

import { classificationFixture, planInputFixture } from './shared.js';

describe('core-06-s4 recovery-plan-deterministic-inputs', () => {
  it('mints a stable plan id from only the allowed deterministic fields', () => {
    const classification = classificationFixture();
    const left = planRecoveryAction(planInputFixture(), classification);
    const right = planRecoveryAction(
      planInputFixture({
        plannedAt: '2026-06-27T14:00:00.000Z',
      }),
      {
        ...classification,
        reason: 'same state and action with a different explanation string',
      },
    );

    expect(left.planId).toBe(right.planId);
    expect(left.planId).toMatch(/^recovery-plan:/);
    expect(left.selectedAction).toBe('restart-from-cleared-state');
    expect(left.providerControl).toBe('work-source-release');
    expect(left.requiresGate?.capability).toBe('auto-recover');
  });

  it('parks auto-safe actions in manual mode instead of selecting an autonomous action', () => {
    const plan = planRecoveryAction(
      planInputFixture({
        mode: 'manual',
      }),
      classificationFixture(),
    );

    expect(plan.selectedAction).toBe('park-for-operator');
    expect(plan.requiresGate).toBeUndefined();
    expect(plan.providerControl).toBeUndefined();
    expect(plan.lifecycleTarget).toBeUndefined();
  });
});
