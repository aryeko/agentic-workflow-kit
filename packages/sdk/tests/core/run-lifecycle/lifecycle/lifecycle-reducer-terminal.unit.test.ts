import { describe, expect, it } from 'vitest';

import { reduceRunLifecycle } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { makeLifecycleEnvelope, makeReference, makeTransitionPayload } from './fixtures.js';

describe('core-01-s3 lifecycle reducer terminal reason', () => {
  it('sets terminalReason from a terminal lifecycle payload', () => {
    const reduced = reduceRunLifecycle([
      makeLifecycleEnvelope(
        1,
        makeTransitionPayload({
          from: null,
          to: 'created',
          sourceEventIds: [makeReference('RunCreated', 'created')],
        }),
      ),
      makeLifecycleEnvelope(
        2,
        makeTransitionPayload({
          from: 'created',
          to: 'failed',
          reason: 'driver-crash',
          sourceEventIds: [makeReference('Evidence', 'failed')],
        }),
      ),
    ]);

    expect(reduced.lifecycle).toBe('failed');
    expect(reduced.terminalReason).toBe('driver-crash');
  });
});
