import type { ChildMetricAvailability, ChildMetricsSnapshot, MetricAvailability } from '../types.js';

export const UNAVAILABLE_REASONS = {
  sessionLog: 'child session log path is unavailable',
  sessionLogMetrics: 'session log metrics are unavailable',
  failedToolCalls: 'failed tool-call telemetry is unavailable',
  tokenTelemetry: 'session log token telemetry is unavailable',
} as const;

export function available(): MetricAvailability {
  return { status: 'available', unavailableReason: null };
}

export function unavailable(unavailableReason: string): MetricAvailability {
  return { status: 'unavailable', unavailableReason };
}

export function normalizeChildMetricsSnapshot(snapshot: ChildMetricsSnapshot): ChildMetricsSnapshot {
  return {
    ...snapshot,
    availability: normalizeChildMetricAvailability(snapshot),
  };
}

export function normalizeChildMetricAvailability(snapshot: ChildMetricsSnapshot): ChildMetricAvailability {
  return {
    toolCounts:
      snapshot.availability?.toolCounts ??
      (Object.keys(snapshot.toolCounts).length > 0 ? available() : unavailable(UNAVAILABLE_REASONS.sessionLogMetrics)),
    failedToolCalls:
      snapshot.availability?.failedToolCalls ??
      (typeof snapshot.failedToolCalls === 'number' ? available() : unavailable(UNAVAILABLE_REASONS.failedToolCalls)),
    subagentCounts:
      snapshot.availability?.subagentCounts ??
      (Object.keys(snapshot.subagentCounts).length > 0
        ? available()
        : unavailable(UNAVAILABLE_REASONS.sessionLogMetrics)),
    tokenTotals:
      snapshot.availability?.tokenTotals ??
      (snapshot.tokenTotals ? available() : unavailable(UNAVAILABLE_REASONS.tokenTelemetry)),
    sessionLog:
      snapshot.availability?.sessionLog ??
      (snapshot.sessionLogPath ? available() : unavailable(UNAVAILABLE_REASONS.sessionLog)),
  };
}

export function nullableMetric<T>(
  value: T | null,
  availability: MetricAvailability | undefined,
  fallbackReason: string,
): { value: T | null; unavailableReason: string | null } {
  if (value !== null) return { value, unavailableReason: null };
  return { value: null, unavailableReason: availability?.unavailableReason ?? fallbackReason };
}
