import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import { makeEnvelope, makeLifecyclePayload, makeReplay, makeReplayDependency, runId } from './test-support.js';

describe('core-01-s5 metrics retry count', () => {
  it('counts only recovery-authority lifecycle re-entry transitions', () => {
    const result = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(
            1,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({
              from: 'runner-verifying',
              to: 'running',
              authority: 'recovery',
              sourceEventIds: ['retry:1'],
            }),
          ),
          makeEnvelope(
            2,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({
              from: 'forge-waiting',
              to: 'runner-verifying',
              authority: 'recovery',
              sourceEventIds: ['retry:2'],
            }),
          ),
          makeEnvelope(
            3,
            'sibling.RetryAttempted',
            { authority: 'recovery', from: 'merge-waiting', to: 'forge-waiting' },
            { domain: 'sibling' },
          ),
        ]),
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        metrics: expect.objectContaining({
          retryCount: 2,
        }),
      }),
    });
  });
});
