import type { Result, RunAppendFailure, RunAppendFailureCode, RunReplayFailure } from '../contracts/index.js';

const RETRYABLE_FAILURES = new Set<RunAppendFailureCode>([
  'stale-writer-fenced',
  'sequence-conflict',
  'partial-ack-unknown',
  'event-log-unavailable',
]);

export const appendFailure = (
  code: RunAppendFailureCode,
  message: string,
  rejection?: RunAppendFailure['rejection'],
): Result<never, RunAppendFailure> => ({
  ok: false,
  error: {
    code,
    message,
    retryable: RETRYABLE_FAILURES.has(code),
    rejection,
  },
});

export const replayFailureToAppendFailure = (failure: RunReplayFailure): Result<never, RunAppendFailure> => {
  if (failure.code === 'interior-corrupt' || failure.code === 'event-log-unavailable') {
    return appendFailure(failure.code, failure.message);
  }

  return appendFailure('sequence-conflict', failure.message);
};
