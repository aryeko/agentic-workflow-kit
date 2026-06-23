import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import { makeEnvelope, makeLifecyclePayload, makeReplay, makeReplayDependency, runId } from './test-support.js';

describe('core-01-s5 metrics parked duration', () => {
  it('sums complete parked intervals and ignores open intervals', () => {
    const completeInterval = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(
            1,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({ from: 'running', to: 'parked', sourceEventIds: ['evt-1'] }),
            { occurredAt: '2026-06-23T12:00:00.000Z' },
          ),
          makeEnvelope(
            2,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({ from: 'parked', to: 'running', sourceEventIds: ['evt-2'] }),
            { occurredAt: '2026-06-23T12:00:01.000Z' },
          ),
        ]),
      }),
    );
    const openInterval = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(
            1,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({ from: 'running', to: 'parked', sourceEventIds: ['evt-1'] }),
            { occurredAt: '2026-06-23T12:00:00.000Z' },
          ),
        ]),
      }),
    );

    expect(completeInterval).toEqual({
      ok: true,
      value: expect.objectContaining({
        metrics: expect.objectContaining({
          parkedMs: 1000,
        }),
      }),
    });
    expect(openInterval).toEqual({
      ok: true,
      value: expect.objectContaining({
        metrics: expect.objectContaining({
          parkedMs: 0,
        }),
      }),
    });
  });
});
