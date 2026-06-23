import { describe, expect, it } from 'vitest';

import { validateLifecycleTransition } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { makeTransitionPayload } from './fixtures.js';

describe('core-01-s3 factual transition references', () => {
  it('rejects configured without any source reference', () => {
    expect(
      validateLifecycleTransition(
        'created',
        makeTransitionPayload({ from: 'created', to: 'configured', sourceEventIds: [] }),
      ),
    ).toEqual({
      ok: false,
      error: 'illegal-lifecycle-transition',
    });
  });

  it('rejects task-snapshotted without any source reference', () => {
    expect(
      validateLifecycleTransition(
        'configured',
        makeTransitionPayload({ from: 'configured', to: 'task-snapshotted', sourceEventIds: [] }),
      ),
    ).toEqual({
      ok: false,
      error: 'illegal-lifecycle-transition',
    });
  });
});
