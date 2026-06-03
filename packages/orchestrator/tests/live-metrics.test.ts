import { describe, expect, it } from 'vitest';
import { buildLiveMetricsSnapshot, mergeChildMetrics } from '../src/metrics/liveMetrics';

describe('live metrics', () => {
  it('builds parent timing metrics and best-effort child aggregates', () => {
    const snapshot = buildLiveMetricsSnapshot({
      runId: 'run-1',
      status: 'running',
      startedAt: '2026-06-02T00:00:00.000Z',
      now: '2026-06-02T00:00:10.000Z',
      maxParallel: 2,
      active: ['A001'],
      completed: [],
      blockedStoryId: null,
      blockedReason: null,
      childMetrics: {
        A001: {
          storyId: 'A001',
          toolCounts: { exec_command: 2 },
          subagentCounts: { reviewer: 1 },
          tokenTotals: {
            inputTokens: 100,
            cachedInputTokens: 80,
            outputTokens: 20,
            reasoningOutputTokens: 5,
            totalTokens: 120,
          },
          latestProgress: 'running tests',
          sessionLogPath: null,
        },
      },
    });

    expect(snapshot.elapsedMs).toBe(10000);
    expect(snapshot.active).toEqual(['A001']);
    expect(snapshot.aggregate.toolCounts.exec_command).toBe(2);
    expect(snapshot.aggregate.subagentCounts.reviewer).toBe(1);
    expect(snapshot.aggregate.tokenTotals?.totalTokens).toBe(120);
  });

  it('merges partial child metrics without guessing missing token totals', () => {
    expect(
      mergeChildMetrics([
        {
          storyId: 'A001',
          toolCounts: { read: 1 },
          subagentCounts: {},
          tokenTotals: null,
          latestProgress: null,
          sessionLogPath: null,
        },
        {
          storyId: 'A002',
          toolCounts: { read: 2 },
          subagentCounts: {},
          tokenTotals: null,
          latestProgress: null,
          sessionLogPath: null,
        },
      ]).tokenTotals,
    ).toBeNull();
  });
});
