import { describe, expect, it } from 'vitest';

import { reduceRunLifecycle } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { makeEventEnvelope, makeLifecycleEnvelope, makeReference, makeTransitionPayload } from './fixtures.js';

describe('core-01-s3 lifecycle reducer totality', () => {
  it('ignores unknown future event types without throwing', () => {
    const stream = [
      makeLifecycleEnvelope(
        1,
        makeTransitionPayload({
          from: null,
          to: 'created',
          sourceEventIds: [makeReference('RunCreated', 'created')],
        }),
      ),
      makeEventEnvelope('FutureLifecycleTelemetry', 2, { experimental: true }),
      makeLifecycleEnvelope(
        3,
        makeTransitionPayload({
          from: 'created',
          to: 'configured',
          sourceEventIds: [makeReference('RunPolicyBound', 'configured')],
        }),
      ),
    ];

    expect(() => reduceRunLifecycle(stream)).not.toThrow();
    expect(reduceRunLifecycle(stream).lifecycle).toBe('configured');
  });
});
