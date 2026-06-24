import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import {
  makeEnvelope,
  makeLifecyclePayload,
  makePolicyPayload,
  makeReplay,
  makeReplayDependency,
  makeSessionLinkedPayload,
  makeTaskSnapshotPayload,
  runId,
} from './test-support.js';

describe('core-01-s5 launch projection', () => {
  it('extracts policy and task snapshot digests and preserves full link history', () => {
    const result = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(1, 'RunPolicyBound', makePolicyPayload({ policyDigest: 'sha256:policy-a' })),
          makeEnvelope(
            2,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({ from: 'created', to: 'configured', sourceEventIds: ['evt-1'] }),
          ),
          makeEnvelope(3, 'TaskSnapshotRecorded', makeTaskSnapshotPayload({ snapshotDigest: 'sha256:snapshot-a' })),
          makeEnvelope(
            4,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({ from: 'configured', to: 'task-snapshotted', sourceEventIds: ['evt-3'] }),
          ),
          makeEnvelope(5, 'SessionLinked', makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1' })),
          makeEnvelope(
            6,
            'SessionLinked',
            makeSessionLinkedPayload({ linkOrdinal: 2, sessionId: 'session-2', linkRole: 'recovery' }),
          ),
        ]),
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        launch: expect.objectContaining({
          policyDigest: 'sha256:policy-a',
          taskSnapshotDigest: 'sha256:snapshot-a',
          linkHistory: [
            makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1' }),
            makeSessionLinkedPayload({ linkOrdinal: 2, sessionId: 'session-2', linkRole: 'recovery' }),
          ],
        }),
      }),
    });
  });

  it('uses lifecycle-referenced setup facts instead of earlier stray setup facts', () => {
    const result = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(1, 'RunPolicyBound', makePolicyPayload({ policyDigest: 'sha256:policy-stray' }), {
            eventId: 'policy-stray',
          }),
          makeEnvelope(2, 'RunPolicyBound', makePolicyPayload({ policyDigest: 'sha256:policy-authoritative' }), {
            eventId: 'policy-authoritative',
          }),
          makeEnvelope(
            3,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({
              from: 'created',
              to: 'configured',
              sourceEventIds: ['RunPolicyBound:policy-authoritative'],
            }),
          ),
          makeEnvelope(
            4,
            'TaskSnapshotRecorded',
            makeTaskSnapshotPayload({ snapshotDigest: 'sha256:snapshot-stray' }),
            {
              eventId: 'snapshot-stray',
            },
          ),
          makeEnvelope(
            5,
            'TaskSnapshotRecorded',
            makeTaskSnapshotPayload({ snapshotDigest: 'sha256:snapshot-authoritative' }),
            {
              eventId: 'snapshot-authoritative',
            },
          ),
          makeEnvelope(
            6,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({
              from: 'configured',
              to: 'task-snapshotted',
              sourceEventIds: ['TaskSnapshotRecorded:snapshot-authoritative'],
            }),
          ),
        ]),
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        launch: expect.objectContaining({
          policyDigest: 'sha256:policy-authoritative',
          taskSnapshotDigest: 'sha256:snapshot-authoritative',
        }),
      }),
    });
  });
});
