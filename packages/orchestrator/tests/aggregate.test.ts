import { describe, expect, it } from 'vitest';
import { emptyTokenTotals, mergeChildMetrics } from '../src/metrics/aggregate';

describe('metrics aggregate helpers', () => {
  it('returns all-zero empty token totals', () => {
    expect(emptyTokenTotals()).toEqual({
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
      totalTokens: 0,
    });
  });

  it('sums tools, subagents, and token totals across child snapshots', () => {
    expect(
      mergeChildMetrics([
        {
          storyId: 'A001',
          toolCounts: { exec_command: 2, read_file: 1 },
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
        {
          storyId: 'A002',
          toolCounts: { exec_command: 3 },
          subagentCounts: { reviewer: 2, implementer: 1 },
          tokenTotals: {
            inputTokens: 30,
            cachedInputTokens: 10,
            outputTokens: 15,
            reasoningOutputTokens: 4,
            totalTokens: 45,
          },
          latestProgress: null,
          sessionLogPath: null,
        },
      ]),
    ).toEqual({
      toolCounts: { exec_command: 5, read_file: 1 },
      subagentCounts: { reviewer: 3, implementer: 1 },
      tokenTotals: {
        inputTokens: 130,
        cachedInputTokens: 90,
        outputTokens: 35,
        reasoningOutputTokens: 9,
        totalTokens: 165,
      },
    });
  });
});
