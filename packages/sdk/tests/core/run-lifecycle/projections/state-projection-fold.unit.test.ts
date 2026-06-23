import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import {
  makeEnvelope,
  makeLifecyclePayload,
  makePolicyPayload,
  makeReplay,
  makeReplayDependency,
  makeTaskSnapshotPayload,
  runId,
} from './test-support.js';

describe('core-01-s5 state projection', () => {
  it('uses the terminal lifecycle fold values and replay health', () => {
    const transition = makeEnvelope(
      4,
      'RunLifecycleTransitioned',
      makeLifecyclePayload({
        from: 'configured',
        to: 'running',
        authority: 'system',
        sourceEventIds: ['evt-3'],
      }),
      { writerEpoch: 12 },
    );
    const result = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay(
          [
            makeEnvelope(1, 'RunCreated', { requestedBy: 'operator', idempotencyKey: 'idem-1' }),
            makeEnvelope(
              2,
              'RunLifecycleTransitioned',
              makeLifecyclePayload({ from: null, to: 'created', sourceEventIds: ['evt-1'] }),
            ),
            makeEnvelope(3, 'RunPolicyBound', makePolicyPayload()),
            transition,
          ],
          'tail-repaired',
        ),
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        state: {
          lifecycle: 'running',
          currentSequence: 4,
          writerEpoch: 12,
          degradedHealth: 'tail-repaired',
        },
      }),
    });
  });

  it('ignores non-lifecycle events when folding lifecycle state', () => {
    const result = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(1, 'RunCreated', { requestedBy: 'operator', idempotencyKey: 'idem-1' }),
          makeEnvelope(2, 'RunPolicyBound', makePolicyPayload()),
          makeEnvelope(3, 'TaskSnapshotRecorded', makeTaskSnapshotPayload()),
          makeEnvelope(4, 'sibling-domain.SomeUnknownEvent', { acknowledged: true }, { domain: 'sibling-domain' }),
          makeEnvelope(
            5,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({ from: null, to: 'created', sourceEventIds: ['evt-1'] }),
          ),
        ]),
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        state: expect.objectContaining({
          lifecycle: 'created',
          currentSequence: 5,
        }),
      }),
    });
  });
});
