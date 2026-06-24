import type { LeaseCapability } from '../../../foundation/storage/index.js';
import type {
  CreateRunInput,
  Result,
  RunAppendFailure,
  RunEventLog,
  RunProjections,
  RunReplay,
  RunReplayFailure,
  RunWriter,
  WaitRunEventsRequest,
  WaitRunEventsResult,
} from '../contracts/index.js';

import { waitRunEvents } from '../cursor-wait/index.js';
import { project } from '../projections/index.js';
import { replay } from '../replay/index.js';

import { createRunWriter } from './append-writer.js';
import { createRun } from './create-run.js';
import { appendFailure } from './failures.js';
import type { RunEventLogDependencies } from './types.js';

const runWriterLeaseName = (runId: string): string => `run-writer:${runId}`;

export const createRunEventLog = (deps: RunEventLogDependencies): RunEventLog => ({
  createRun(input: CreateRunInput): Result<RunWriter, RunAppendFailure> {
    return createRun(deps, input);
  },

  openWriter(runId: string, lease: LeaseCapability): Result<RunWriter, RunAppendFailure> {
    if (lease.name !== runWriterLeaseName(runId)) {
      return appendFailure('stale-writer-fenced', 'Writer lease is not scoped to the requested run.');
    }

    if (!deps.leaseStore.fence(lease.name, lease.epoch, lease.token)) {
      return appendFailure('stale-writer-fenced', 'Writer lease no longer fences current.');
    }

    return {
      ok: true,
      value: createRunWriter({ deps, runId, lease }),
    };
  },

  replay(runId: string): Result<RunReplay, RunReplayFailure> {
    return replay(runId, deps.eventLogStore, deps.digestPayload);
  },

  waitRunEvents(request: WaitRunEventsRequest): Promise<Result<WaitRunEventsResult, RunReplayFailure>> {
    return waitRunEvents(
      request,
      (runId) => replay(runId, deps.eventLogStore, deps.digestPayload),
      deps.waitClock,
      deps.waitSleep,
    );
  },

  project(runId: string): Result<RunProjections, RunReplayFailure> {
    return project(runId, (requestedRunId) => replay(requestedRunId, deps.eventLogStore, deps.digestPayload));
  },
});
