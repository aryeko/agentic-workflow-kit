import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import { makeEnvelope, makeLifecyclePayload, makeReplay, makeReplayDependency, runId } from './test-support.js';

describe('core-01-s5 metrics projection', () => {
  it('counts all events and captures first and last recordedAt timestamps', () => {
    const result = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(
            1,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({ from: null, to: 'created', sourceEventIds: ['evt-1'] }),
            { recordedAt: '2026-06-23T12:00:01.000Z' },
          ),
          makeEnvelope(
            2,
            'RunCreated',
            { requestedBy: 'operator', idempotencyKey: 'idem-1' },
            { recordedAt: '2026-06-23T12:00:02.000Z' },
          ),
          makeEnvelope(
            3,
            'RunPolicyBound',
            { policyDigest: 'sha256:policy', provenanceRef: 'prov:1' },
            { recordedAt: '2026-06-23T12:00:03.000Z' },
          ),
          makeEnvelope(
            4,
            'TaskSnapshotRecorded',
            { taskId: 'task-1', sourceRef: 'src:1', snapshotDigest: 'sha256:snapshot' },
            { recordedAt: '2026-06-23T12:00:04.000Z' },
          ),
          makeEnvelope(
            5,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({ from: 'created', to: 'running', sourceEventIds: ['evt-4'] }),
            { recordedAt: '2026-06-23T12:00:05.000Z' },
          ),
        ]),
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        metrics: {
          eventCount: 5,
          retryCount: 0,
          parkedMs: 0,
          firstRecordedAt: '2026-06-23T12:00:01.000Z',
          lastRecordedAt: '2026-06-23T12:00:05.000Z',
        },
      }),
    });
  });
});
