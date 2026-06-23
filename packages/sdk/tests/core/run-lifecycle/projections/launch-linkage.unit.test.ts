import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import { makeEnvelope, makeReplay, makeReplayDependency, makeSessionLinkedPayload, runId } from './test-support.js';

describe('core-01-s5 launch linkage classification', () => {
  it('reports unknown, known, and ambiguous linkage with ambiguous folded to unknown', () => {
    const noLinks = project(runId, makeReplayDependency({ ok: true, value: makeReplay([]) }));
    const oneLink = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(
            1,
            'SessionLinked',
            makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1', linkRole: 'primary' }),
          ),
        ]),
      }),
    );
    const conflictingLinks = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(
            1,
            'SessionLinked',
            makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1', linkRole: 'primary' }),
          ),
          makeEnvelope(
            2,
            'SessionLinked',
            makeSessionLinkedPayload({ linkOrdinal: 2, sessionId: 'session-2', linkRole: 'primary' }),
          ),
        ]),
      }),
    );

    expect(noLinks).toEqual({
      ok: true,
      value: expect.objectContaining({
        launch: expect.objectContaining({
          linkage: 'unknown',
        }),
      }),
    });
    expect(oneLink).toEqual({
      ok: true,
      value: expect.objectContaining({
        launch: expect.objectContaining({
          linkage: 'known',
        }),
      }),
    });
    expect(conflictingLinks).toEqual({
      ok: true,
      value: expect.objectContaining({
        launch: expect.objectContaining({
          linkage: 'unknown',
        }),
      }),
    });
  });
});
