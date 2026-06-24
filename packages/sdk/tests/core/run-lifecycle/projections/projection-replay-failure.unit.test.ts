import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import { makeReplayDependency, makeReplayFailure, runId } from './test-support.js';

describe('core-01-s5 replay failure propagation', () => {
  it.each([
    'malformed-envelope',
    'interior-corrupt',
    'event-log-unavailable',
    'malformed-declared-payload',
  ] as const)('propagates %s failures unchanged', (code) => {
    const error = makeReplayFailure(code);

    expect(project(runId, makeReplayDependency({ ok: false, error }))).toEqual({
      ok: false,
      error,
    });
  });
});
