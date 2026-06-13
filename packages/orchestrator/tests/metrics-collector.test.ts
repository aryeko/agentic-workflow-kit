import { describe, expect, it } from 'vitest';
import { MetricsCollector } from '../src/runner/MetricsCollector';
import type { Clock } from '../src/types';

class SequenceClock implements Clock {
  constructor(private readonly values: string[]) {}
  now(): string {
    const value = this.values.shift();
    if (!value) throw new Error('clock exhausted');
    return value;
  }
  nowMs(): number {
    return Date.now();
  }
}

describe('MetricsCollector', () => {
  it('tracks child durations and builds run metrics with the existing shape', () => {
    const collector = new MetricsCollector(new SequenceClock(['2026-06-02T00:00:00.000Z', '2026-06-02T00:00:05.000Z']));

    collector.start('A001');
    collector.complete('A001');

    expect(
      collector.buildRunMetrics({
        startedAt: '2026-06-02T00:00:00.000Z',
        completedAt: '2026-06-02T00:00:05.000Z',
        completedCount: 1,
        status: 'complete',
        blockedReason: null,
      }),
    ).toEqual({
      elapsedMs: 5000,
      launchedCount: 1,
      completedCount: 1,
      blockedCount: 0,
      blockedReason: null,
      criticalPath: [
        {
          storyId: 'A001',
          startedAt: '2026-06-02T00:00:00.000Z',
          completedAt: '2026-06-02T00:00:05.000Z',
          durationMs: 5000,
        },
      ],
    });
  });

  it('preserves metric availability while merging child observations', () => {
    const collector = new MetricsCollector(new SequenceClock(['2026-06-02T00:00:00.000Z']));

    collector.observeChildProgress('A001', { latestProgress: 'session linked', sessionLogPath: null });
    collector.updateChildMetric('A001', {
      storyId: 'A001',
      toolCounts: { exec_command: 1 },
      subagentCounts: {},
      tokenTotals: null,
      latestProgress: null,
      sessionLogPath: '/sessions/a001.jsonl',
      availability: {
        toolCounts: { status: 'available', unavailableReason: null },
        subagentCounts: { status: 'unavailable', unavailableReason: 'session log metrics are unavailable' },
        tokenTotals: { status: 'unavailable', unavailableReason: 'session log token telemetry is unavailable' },
        sessionLog: { status: 'available', unavailableReason: null },
      },
    });

    expect(collector.observedChildMetrics().A001).toMatchObject({
      toolCounts: { exec_command: 1 },
      sessionLogPath: '/sessions/a001.jsonl',
      availability: {
        toolCounts: { status: 'available', unavailableReason: null },
        tokenTotals: { status: 'unavailable', unavailableReason: 'session log token telemetry is unavailable' },
        sessionLog: { status: 'available', unavailableReason: null },
      },
    });
  });
});
