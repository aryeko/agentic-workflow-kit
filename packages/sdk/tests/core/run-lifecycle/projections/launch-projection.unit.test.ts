import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import {
  makeEnvelope,
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
          makeEnvelope(2, 'TaskSnapshotRecorded', makeTaskSnapshotPayload({ snapshotDigest: 'sha256:snapshot-a' })),
          makeEnvelope(3, 'SessionLinked', makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1' })),
          makeEnvelope(
            4,
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
});
