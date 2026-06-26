import type { Result, RunReplayFailure, WaitRunEventsResult } from '../../run-lifecycle/contracts/index.js';

import type { SupervisionWaitRequest } from '../contracts/index.js';

export interface SupervisionWaitRunner {
  waitRunEvents(request: SupervisionWaitRequest): Promise<Result<WaitRunEventsResult, RunReplayFailure>>;
}

export interface WrapWaitRunEventsFailure {
  readonly reason: 'event-cursor-unavailable';
  readonly message: string;
  readonly waitFailure?: RunReplayFailure;
}

export type WrapWaitRunEventsResult = Promise<Result<WaitRunEventsResult, WrapWaitRunEventsFailure>>;
