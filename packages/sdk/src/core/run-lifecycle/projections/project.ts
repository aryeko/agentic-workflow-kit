import type { Result, RunProjections, RunReplay, RunReplayFailure } from '../contracts/index.js';

import { projectLaunch } from './launch-projection.js';
import { projectMetrics } from './metrics-projection.js';
import { projectState } from './state-projection.js';
import { projectSummary } from './summary-projection.js';

export type ReplayProjectionSource = (runId: string) => Result<RunReplay, RunReplayFailure>;

export function project(runId: string, replayRun: ReplayProjectionSource): Result<RunProjections, RunReplayFailure> {
  const replayed = replayRun(runId);

  if (!replayed.ok) {
    return replayed;
  }

  const state = projectState(replayed.value);
  const launch = projectLaunch(replayed.value);
  const summary = projectSummary(replayed.value, state, launch);
  const metrics = projectMetrics(replayed.value);

  return {
    ok: true,
    value: {
      state,
      summary,
      metrics,
      launch,
    },
  };
}
