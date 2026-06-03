import type { ChildMetricsSnapshot, LiveMetricsSnapshot, RunStatus } from '../types.js';
import { mergeChildMetrics } from './aggregate.js';

export interface BuildLiveMetricsInput {
  runId: string;
  status: RunStatus;
  startedAt: string;
  now: string;
  maxParallel: number;
  active: string[];
  completed: unknown[];
  blockedStoryId: string | null;
  blockedReason: string | null;
  childMetrics: Record<string, ChildMetricsSnapshot>;
}

export function buildLiveMetricsSnapshot(input: BuildLiveMetricsInput): LiveMetricsSnapshot {
  return {
    runId: input.runId,
    status: input.status,
    elapsedMs: Date.parse(input.now) - Date.parse(input.startedAt),
    maxParallel: input.maxParallel,
    active: input.active,
    completedCount: input.completed.length,
    blockedStoryId: input.blockedStoryId,
    blockedReason: input.blockedReason,
    children: input.childMetrics,
    aggregate: mergeChildMetrics(Object.values(input.childMetrics)),
  };
}

export { mergeChildMetrics } from './aggregate.js';
