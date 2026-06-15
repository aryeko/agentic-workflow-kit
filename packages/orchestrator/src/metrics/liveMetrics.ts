import type { ChildMetricsSnapshot, LiveMetricsSnapshot, RunStatus } from '../types.js';
import { mergeChildMetrics } from './aggregate.js';
import { available, normalizeChildMetricAvailability, normalizeChildMetricsSnapshot } from './availability.js';
import { analyzeSessionLogMetrics } from './sessionLogMetrics.js';

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
  const children = Object.fromEntries(
    Object.entries(input.childMetrics).map(([storyId, child]) => [storyId, normalizeChildMetricsSnapshot(child)]),
  );
  return {
    runId: input.runId,
    status: input.status,
    elapsedMs: Date.parse(input.now) - Date.parse(input.startedAt),
    maxParallel: input.maxParallel,
    active: input.active,
    completedCount: input.completed.length,
    blockedStoryId: input.blockedStoryId,
    blockedReason: input.blockedReason,
    children,
    aggregate: mergeChildMetrics(Object.values(children)),
  };
}

export async function enrichLiveMetricsFromSessionLogs(snapshot: LiveMetricsSnapshot): Promise<LiveMetricsSnapshot> {
  const children: Record<string, ChildMetricsSnapshot> = {};
  for (const [storyId, child] of Object.entries(snapshot.children)) {
    children[storyId] = await enrichChildMetric(child);
  }
  return {
    ...snapshot,
    children,
    aggregate: mergeChildMetrics(Object.values(children)),
  };
}

async function enrichChildMetric(child: ChildMetricsSnapshot): Promise<ChildMetricsSnapshot> {
  if (!child.sessionLogPath) return child;
  try {
    const metrics = await analyzeSessionLogMetrics(child.sessionLogPath);
    const availability = normalizeChildMetricAvailability(child);
    return {
      ...child,
      toolCounts: hasCounts(metrics.commandCounts) ? metrics.commandCounts : child.toolCounts,
      failedToolCalls: metrics.failedToolCalls,
      subagentCounts: hasCounts(metrics.subagentCounts) ? metrics.subagentCounts : child.subagentCounts,
      tokenTotals: metrics.tokenTotals ?? child.tokenTotals,
      availability: {
        toolCounts: availability.toolCounts,
        subagentCounts: availability.subagentCounts,
        tokenTotals: availability.tokenTotals,
        ...(hasCounts(metrics.commandCounts) ? { toolCounts: available() } : {}),
        failedToolCalls: available(),
        ...(hasCounts(metrics.subagentCounts) ? { subagentCounts: available() } : {}),
        ...(metrics.tokenTotals || child.tokenTotals ? { tokenTotals: available() } : {}),
        sessionLog: available(),
      },
    };
  } catch {
    return child;
  }
}

function hasCounts(value: Record<string, number>): boolean {
  return Object.keys(value).length > 0;
}

export { mergeChildMetrics } from './aggregate.js';
