import type { LivenessReason, LivenessState, SupervisionTimerName } from './catalogs.js';

export interface LivenessProjection {
  readonly runId: string;
  readonly state: LivenessState;
  readonly reason?: LivenessReason;
  readonly currentSessionId?: string;
  readonly workerHandleId?: string;
  readonly lastWorkerEventSequence?: number;
  readonly lastProgressSequence?: number;
  readonly staleSince?: string;
  readonly timers: Readonly<
    Record<
      SupervisionTimerName,
      {
        readonly deadline: string;
        readonly exceeded: boolean;
      }
    >
  >;
  readonly terminal: boolean;
}
