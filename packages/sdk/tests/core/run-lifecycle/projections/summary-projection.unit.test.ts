import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import {
  makeEnvelope,
  makeLifecyclePayload,
  makeReplay,
  makeReplayDependency,
  makeSessionLinkedPayload,
  makeSupersededPayload,
  makeTaskSnapshotPayload,
  runId,
} from './test-support.js';

describe('core-01-s5 summary projection', () => {
  it('derives task, owner, lifecycle status, and artifact refs', () => {
    const result = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(
            1,
            'RunCreated',
            { requestedBy: 'operator', idempotencyKey: 'idem-1' },
            { artifactRefs: ['artifact://one'] },
          ),
          makeEnvelope(2, 'TaskSnapshotRecorded', makeTaskSnapshotPayload({ taskId: 'task-77' }), {
            artifactRefs: ['artifact://two'],
          }),
          makeEnvelope(3, 'SessionLinked', makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1' }), {
            artifactRefs: ['artifact://two', 'artifact://three'],
          }),
          makeEnvelope(
            4,
            'SessionLinked',
            makeSessionLinkedPayload({ linkOrdinal: 2, sessionId: 'session-2', supersedesOrdinal: 1 }),
          ),
          makeEnvelope(5, 'SessionLinkSuperseded', makeSupersededPayload()),
          makeEnvelope(
            6,
            'SessionLinked',
            makeSessionLinkedPayload({ linkOrdinal: 3, sessionId: 'session-observer', linkRole: 'observer' }),
          ),
          makeEnvelope(
            7,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({ from: null, to: 'running', sourceEventIds: ['evt-4'] }),
          ),
        ]),
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        summary: {
          runId,
          taskId: 'task-77',
          status: 'running',
          ownerSessionId: 'session-2',
          artifactRefs: ['artifact://one', 'artifact://two', 'artifact://three'],
          unknownEvents: [],
        },
      }),
    });
  });
});
