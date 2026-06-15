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
          failedToolCalls: 1,
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
    expect(snapshot.aggregate.failedToolCalls).toBe(1);
    expect(snapshot.aggregate.subagentCounts.reviewer).toBe(1);
    expect(snapshot.aggregate.tokenTotals?.totalTokens).toBe(120);
    expect(snapshot.children.A001.availability).toMatchObject({
      toolCounts: { status: 'available', unavailableReason: null },
      failedToolCalls: { status: 'available', unavailableReason: null },
      sessionLog: { status: 'unavailable', unavailableReason: 'child session log path is unavailable' },
    });
  });

  it('merges partial child metrics without guessing missing token totals', () => {
    const aggregate = mergeChildMetrics([
      {
        storyId: 'A001',
        toolCounts: { read: 1 },
        failedToolCalls: 0,
        subagentCounts: {},
        tokenTotals: null,
        latestProgress: null,
        sessionLogPath: null,
      },
      {
        storyId: 'A002',
        toolCounts: { read: 2 },
        failedToolCalls: 2,
        subagentCounts: {},
        tokenTotals: null,
        latestProgress: null,
        sessionLogPath: null,
      },
    ]);

    expect(aggregate.tokenTotals).toBeNull();
    expect(aggregate.failedToolCalls).toBe(2);
  });

  it('records explicit unavailable reasons for missing live telemetry', () => {
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
          toolCounts: {},
          failedToolCalls: null,
          subagentCounts: {},
          tokenTotals: null,
          latestProgress: null,
          sessionLogPath: null,
        },
      },
    });

    expect(snapshot.children.A001.availability).toEqual({
      toolCounts: { status: 'unavailable', unavailableReason: 'session log metrics are unavailable' },
      failedToolCalls: { status: 'unavailable', unavailableReason: 'failed tool-call telemetry is unavailable' },
      subagentCounts: { status: 'unavailable', unavailableReason: 'session log metrics are unavailable' },
      tokenTotals: { status: 'unavailable', unavailableReason: 'session log token telemetry is unavailable' },
      sessionLog: { status: 'unavailable', unavailableReason: 'child session log path is unavailable' },
    });
  });
});
