import { RECOVERY_STATES } from '../../../../src/core/recovery/contracts/index.js';
import { classifyActionSafety } from '../../../../src/core/recovery/classifier/index.js';
import { describe, expect, it } from 'vitest';

describe('core-06-s2 recovery-action-safety-matrix', () => {
  it('maps every recovery state to the exact action-safety row', () => {
    const expected = {
      'clean-terminal': ['forbidden', 'none', undefined],
      'owned-session-resumable': ['auto-safe', 'resume-owned-session', 'auto-recover'],
      'evidence-refresh-retryable': ['auto-safe', 'retry-evidence-refresh', 'auto-recover'],
      'owned-worker-stale-terminable': ['auto-safe', 'request-termination', 'auto-recover'],
      'safe-empty-restartable': ['auto-safe', 'restart-from-cleared-state', 'auto-recover'],
      'stale-launch-clearable': ['auto-safe', 'clear-stale-launch', 'auto-recover'],
      'operator-approval-needed': ['operator-required', 'park-for-operator', undefined],
      'lease-unavailable': ['operator-required', 'block-run', undefined],
      'log-unwritable': ['operator-required', 'block-run', undefined],
      'log-corrupt': ['forbidden', 'fail-run', undefined],
      'launch-duplicate-active': ['forbidden', 'block-run', undefined],
      'owner-ambiguous': ['forbidden', 'block-run', undefined],
      'termination-ambiguous': ['forbidden', 'block-run', undefined],
      'supervision-stale-ambiguous': ['operator-required', 'park-for-operator', undefined],
      'merge-outcome-ambiguous': ['operator-required', 'park-for-operator', undefined],
      'provider-evidence-gap': ['operator-required', 'park-for-operator', undefined],
      'manual-edits-forbidden': ['forbidden', 'fail-run', undefined],
      'terminal-no-recovery': ['forbidden', 'fail-run', undefined],
    } as const;

    expect(RECOVERY_STATES).toHaveLength(Object.keys(expected).length);

    for (const state of RECOVERY_STATES) {
      const result = classifyActionSafety(state);
      expect([result.actionSafety, result.recommendedAction, result.requiredGate]).toEqual(expected[state]);
    }
  });
});
