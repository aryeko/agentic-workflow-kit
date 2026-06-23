import type { DurabilityClass } from '../../../foundation/storage/index.js';

export type { Result } from '../../../foundation/storage/index.js';

export type RunDurabilityClass = Exclude<DurabilityClass, 'buffered'>;

export type RunLifecycleState =
  | 'created'
  | 'configured'
  | 'task-snapshotted'
  | 'workspace-ready'
  | 'worker-starting'
  | 'running'
  | 'parked'
  | 'runner-verifying'
  | 'forge-waiting'
  | 'merge-waiting'
  | 'settling'
  | 'completed'
  | 'blocked'
  | 'failed'
  | 'canceled';

export type RunDegradedHealth = 'ok' | 'tail-repaired' | 'interior-corrupt' | 'event-log-unavailable';
