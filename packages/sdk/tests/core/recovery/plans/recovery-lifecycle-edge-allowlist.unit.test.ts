import { describe, expect, it } from 'vitest';

import { buildRecoveryLifecycleEdgeRequest, planRecoveryAction } from '../../../../src/core/recovery/plans/index.js';

import { classificationFixture, planInputFixture } from './shared.js';

describe('core-06-s4 recovery-lifecycle-edge-allowlist', () => {
  it('allows only the approved retry and terminal lifecycle recovery edges', () => {
    const retryPlan = planRecoveryAction(
      planInputFixture({
        requestedAction: 'retry-evidence-refresh',
      }),
      {
        state: 'evidence-refresh-retryable',
        recommendedAction: 'retry-evidence-refresh',
        actionSafety: 'auto-safe',
        requiredGate: 'auto-recover',
        reason: 'forge evidence can be retried',
        evidenceRefs: classificationFixture().evidenceRefs,
      },
    );
    const retryEdge = buildRecoveryLifecycleEdgeRequest({
      plan: retryPlan,
      from: 'forge-waiting',
      recoveryEventIds: ['evt-recovery-classified-01', 'evt-recovery-plan-01'],
    });

    expect(retryEdge.ok).toBe(true);
    if (!retryEdge.ok) {
      throw new Error('expected retry edge to be allowed');
    }
    expect(retryEdge.value).toEqual({
      authority: 'recovery',
      from: 'forge-waiting',
      to: 'runner-verifying',
      sourceEventIds: ['evt-recovery-classified-01', 'evt-recovery-plan-01'],
    });

    const failPlan = planRecoveryAction(
      planInputFixture({
        requestedAction: 'fail-run',
      }),
      {
        state: 'terminal-no-recovery',
        recommendedAction: 'fail-run',
        actionSafety: 'forbidden',
        reason: 'the run cannot be recovered safely',
        evidenceRefs: classificationFixture().evidenceRefs,
      },
    );
    const failEdge = buildRecoveryLifecycleEdgeRequest({
      plan: failPlan,
      from: 'running',
      recoveryEventIds: ['evt-recovery-classified-02', 'evt-recovery-plan-02'],
    });

    expect(failEdge.ok).toBe(true);
    if (!failEdge.ok) {
      throw new Error('expected terminal edge to be allowed');
    }
    expect(failEdge.value?.to).toBe('failed');
  });

  it('fails closed for illegal lifecycle requests and records no lifecycle request', () => {
    const retryPlan = planRecoveryAction(
      planInputFixture({
        requestedAction: 'retry-evidence-refresh',
      }),
      {
        state: 'evidence-refresh-retryable',
        recommendedAction: 'retry-evidence-refresh',
        actionSafety: 'auto-safe',
        requiredGate: 'auto-recover',
        reason: 'forge evidence can be retried',
        evidenceRefs: classificationFixture().evidenceRefs,
      },
    );

    const illegal = buildRecoveryLifecycleEdgeRequest({
      plan: retryPlan,
      from: 'running',
      recoveryEventIds: ['evt-recovery-classified-01', 'evt-recovery-plan-01'],
    });

    expect(illegal.ok).toBe(false);
    if (illegal.ok) {
      throw new Error('expected illegal lifecycle request failure');
    }
    expect(illegal.error.reason).toBe('illegal-lifecycle-edge');
  });
});
