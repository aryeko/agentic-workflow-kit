import type { EventLogStore, LeaseStore } from '../../../foundation/storage/index.js';

export type RunEventIdInput = {
  runId: string;
  type: string;
  sequence: number;
};

export type RunEventLogDependencies = {
  leaseStore: LeaseStore;
  eventLogStore: EventLogStore;
  now: () => string;
  waitClock: () => number;
  createEventId: (input: RunEventIdInput) => string;
  digestPayload: (payload: unknown) => string;
};
