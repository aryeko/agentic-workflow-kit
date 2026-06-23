import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import {
  makeEnvelope,
  makeReplay,
  makeReplayDependency,
  makeSessionLinkedPayload,
  makeSupersededPayload,
  runId,
} from './test-support.js';

describe('core-01-s5 launch supersession handling', () => {
  it('drops superseded links from currentSession while keeping them in history', () => {
    const firstLink = makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1' });
    const secondLink = makeSessionLinkedPayload({ linkOrdinal: 2, sessionId: 'session-2', supersedesOrdinal: 1 });
    const result = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(1, 'SessionLinked', firstLink),
          makeEnvelope(2, 'SessionLinked', secondLink),
          makeEnvelope(
            3,
            'SessionLinkSuperseded',
            makeSupersededPayload({ supersededOrdinal: 1, replacementOrdinal: 2 }),
          ),
        ]),
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        launch: expect.objectContaining({
          currentSession: expect.objectContaining({ linkOrdinal: 2 }),
          linkHistory: [firstLink, secondLink],
        }),
      }),
    });
  });
});
