import type { RunAppendFailureCode } from './failure-codes.js';
import type { RunLogHealthRecord } from './health.js';
import type { RunAppendRejectedPayload } from './payloads.js';

export type RunAppendFailure = {
  code: RunAppendFailureCode;
  message: string;
  retryable: boolean;
  rejection?: RunAppendRejectedPayload;
};

export type RunReplayFailure = {
  code: 'malformed-envelope' | 'interior-corrupt' | 'event-log-unavailable' | 'malformed-declared-payload';
  message: string;
  healthRecords: RunLogHealthRecord[];
};
