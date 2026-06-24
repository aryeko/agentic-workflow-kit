import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import { makeEnvelope, makeLifecyclePayload, makeReplay, makeReplayDependency, runId } from './test-support.js';

describe('core-01-s5 reducer totality', () => {
  it('preserves unknown well-formed events in summary without failing projection', () => {
    const unknownEvent = makeEnvelope(
      2,
      'sibling-domain.SomeUnknownEvent',
      { knownShape: true, nested: { ok: true } },
      { domain: 'sibling-domain' },
    );
    const result = project(
      runId,
      makeReplayDependency({
        ok: true,
        value: makeReplay([
          makeEnvelope(
            1,
            'RunLifecycleTransitioned',
            makeLifecyclePayload({ from: null, to: 'created', sourceEventIds: ['evt-1'] }),
          ),
          unknownEvent,
        ]),
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.summary.unknownEvents).toEqual([unknownEvent]);
  });
});
