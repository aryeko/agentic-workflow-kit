import type { LeaseCapability } from '../../../foundation/storage/index.js';

import type { AppendIntent, CreateRunInput, RunAppendReceipt } from './envelope.js';
import type { RunAppendFailure, RunReplayFailure } from './failures.js';
import type { RunProjections } from './projections.js';
import type { RunReplay, WaitRunEventsRequest, WaitRunEventsResult } from './replay.js';
import type { Result } from './result.js';

export interface RunEventLog {
  createRun(input: CreateRunInput): Result<RunWriter, RunAppendFailure>;
  openWriter(runId: string, lease: LeaseCapability): Result<RunWriter, RunAppendFailure>;
  replay(runId: string): Result<RunReplay, RunReplayFailure>;
  waitRunEvents(request: WaitRunEventsRequest): Promise<Result<WaitRunEventsResult, RunReplayFailure>>;
  project(runId: string): Result<RunProjections, RunReplayFailure>;
}

export interface RunWriter {
  append(batch: AppendIntent[]): Result<RunAppendReceipt, RunAppendFailure>;
  renew(lease: LeaseCapability): Result<RunWriter, RunAppendFailure>;
}
