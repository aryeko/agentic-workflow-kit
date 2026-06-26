import type { Result, WaitRunEventsResult } from '../../run-lifecycle/contracts/index.js';

import type { SupervisionWaitRequest } from '../contracts/index.js';

import type { SupervisionWaitRunner, WrapWaitRunEventsFailure, WrapWaitRunEventsResult } from './types.js';

const cursorMismatch = (): Result<WaitRunEventsResult, WrapWaitRunEventsFailure> => ({
  ok: false,
  error: {
    reason: 'event-cursor-unavailable',
    message: 'wait cursor run id does not match request run id',
  },
});

const delegatedWaitFailed = (
  waitFailure: WrapWaitRunEventsFailure['waitFailure'],
): Result<WaitRunEventsResult, WrapWaitRunEventsFailure> => ({
  ok: false,
  error: {
    reason: 'event-cursor-unavailable',
    message: 'delegated wait failed',
    waitFailure,
  },
});

export const wrapWaitRunEvents = async (
  request: SupervisionWaitRequest,
  runner: SupervisionWaitRunner,
): WrapWaitRunEventsResult => {
  if (request.runId !== request.cursor.runId) {
    return cursorMismatch();
  }

  const delegated = await runner.waitRunEvents(request);
  if (!delegated.ok) {
    return delegatedWaitFailed(delegated.error);
  }

  return delegated;
};
