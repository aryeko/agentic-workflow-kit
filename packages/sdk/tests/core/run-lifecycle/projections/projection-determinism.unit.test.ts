import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import {
  makeEnvelope,
  makeLifecyclePayload,
  makeReplay,
  makeReplayDependency,
  makeSessionLinkedPayload,
  runId,
} from './test-support.js';

describe('core-01-s5 projection determinism', () => {
  it('returns identical projections for identical replay input', () => {
    const replay = makeReplay([
      makeEnvelope(1, 'RunCreated', { requestedBy: 'operator', idempotencyKey: 'idem-1' }),
      makeEnvelope(
        2,
        'RunLifecycleTransitioned',
        makeLifecyclePayload({ from: null, to: 'created', sourceEventIds: ['RunCreated:1'] }),
      ),
      makeEnvelope(
        3,
        'SessionLinked',
        makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1', linkRole: 'primary' }),
      ),
      makeEnvelope(
        4,
        'RunLifecycleTransitioned',
        makeLifecyclePayload({
          from: 'created',
          to: 'running',
          authority: 'system',
          sourceEventIds: ['SessionLinked:1'],
        }),
      ),
    ]);
    const replayRun = makeReplayDependency({ ok: true, value: replay });

    const first = project(runId, replayRun);
    const second = project(runId, replayRun);

    expect(first).toEqual(second);
  });
});
