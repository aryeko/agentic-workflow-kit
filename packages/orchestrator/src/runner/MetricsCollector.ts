import { normalizeChildMetricAvailability } from '../metrics/availability.js';
import type { ChildMetricsSnapshot, ChildRunMetric, Clock, RunMetrics, RunStatus } from '../types.js';

interface ChildTiming {
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface BuildRunMetricsInput {
  startedAt: string;
  completedAt?: string;
  completedCount: number;
  status: RunStatus;
  blockedReason: string | null;
}

export class MetricsCollector {
  private readonly childMetrics = new Map<string, ChildTiming>();
  private readonly observedMetrics: Record<string, ChildMetricsSnapshot> = {};

  constructor(private readonly clock: Clock) {}

  start(storyId: string): string {
    const startedAt = this.clock.now();
    this.childMetrics.set(storyId, { startedAt });
    return startedAt;
  }

  complete(storyId: string): string {
    const completedAt = this.clock.now();
    const existing = this.childMetrics.get(storyId);
    if (existing) {
      this.childMetrics.set(storyId, {
        ...existing,
        completedAt,
        durationMs: Date.parse(completedAt) - Date.parse(existing.startedAt),
      });
    }
    return completedAt;
  }

  updateChildMetric(storyId: string, metrics: ChildMetricsSnapshot): void {
    this.observedMetrics[storyId] = mergeChildMetricSnapshots(this.observedMetrics[storyId], metrics);
  }

  observeChildProgress(
    storyId: string,
    fields: { latestProgress?: string | null; sessionLogPath?: string | null },
  ): void {
    const existing = this.observedMetrics[storyId];
    const updated = {
      storyId,
      toolCounts: existing?.toolCounts ?? {},
      subagentCounts: existing?.subagentCounts ?? {},
      tokenTotals: existing?.tokenTotals ?? null,
      latestProgress: fields.latestProgress ?? existing?.latestProgress ?? null,
      sessionLogPath: fields.sessionLogPath ?? existing?.sessionLogPath ?? null,
    };
    this.observedMetrics[storyId] = {
      ...updated,
      availability: normalizeChildMetricAvailability({ ...updated, availability: existing?.availability }),
    };
  }

  childTiming(storyId: string): ChildTiming | undefined {
    return this.childMetrics.get(storyId);
  }

  observedChildMetrics(): Record<string, ChildMetricsSnapshot> {
    return this.observedMetrics;
  }

  buildRunMetrics(input: BuildRunMetricsInput): RunMetrics {
    const completedChildren: ChildRunMetric[] = [...this.childMetrics.entries()]
      .flatMap(([storyId, metric]) =>
        metric.completedAt && metric.durationMs !== undefined
          ? [{ storyId, startedAt: metric.startedAt, completedAt: metric.completedAt, durationMs: metric.durationMs }]
          : [],
      )
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));

    return {
      elapsedMs: input.completedAt ? Date.parse(input.completedAt) - Date.parse(input.startedAt) : 0,
      launchedCount: this.childMetrics.size,
      completedCount: input.completedCount,
      blockedCount: input.status === 'blocked' ? 1 : 0,
      blockedReason: input.blockedReason,
      criticalPath: completedChildren,
    };
  }
}

function mergeChildMetricSnapshots(
  existing: ChildMetricsSnapshot | undefined,
  next: ChildMetricsSnapshot,
): ChildMetricsSnapshot {
  if (!existing) return next;
  const merged = {
    storyId: next.storyId,
    toolCounts: maxCounts(existing.toolCounts, next.toolCounts),
    subagentCounts: maxCounts(existing.subagentCounts, next.subagentCounts),
    tokenTotals: next.tokenTotals ?? existing.tokenTotals,
    latestProgress: next.latestProgress ?? existing.latestProgress,
    sessionLogPath: next.sessionLogPath ?? existing.sessionLogPath,
  };
  return {
    ...merged,
    availability: normalizeChildMetricAvailability({
      ...merged,
      availability: next.availability ?? existing.availability,
    }),
  };
}

function maxCounts(left: Record<string, number>, right: Record<string, number>): Record<string, number> {
  const result = { ...left };
  for (const [key, value] of Object.entries(right)) {
    result[key] = Math.max(result[key] ?? 0, value);
  }
  return result;
}
