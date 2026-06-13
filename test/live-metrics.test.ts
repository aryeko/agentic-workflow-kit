import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { enrichLiveMetricsFromSessionLogs } from '../packages/orchestrator/src/metrics/liveMetrics.js';
import type { LiveMetricsSnapshot } from '../packages/orchestrator/src/types.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('live metrics enrichment', () => {
  it('fills active child metrics from a linked session log', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-live-metrics-'));
    tempRoots.push(root);
    const sessionLogPath = path.join(root, 'session.jsonl');
    await writeFile(
      sessionLogPath,
      [
        JSON.stringify({ type: 'response_item', payload: { type: 'function_call', name: 'exec_command' } }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'spawn_agent',
            arguments: JSON.stringify({ agent_type: 'reviewer' }),
          },
        }),
        JSON.stringify({
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: {
                input_tokens: 10,
                cached_input_tokens: 4,
                output_tokens: 3,
                reasoning_output_tokens: 2,
                total_tokens: 15,
              },
            },
          },
        }),
      ].join('\n'),
    );
    const snapshot: LiveMetricsSnapshot = {
      runId: 'run-1',
      status: 'running',
      elapsedMs: 1000,
      maxParallel: 2,
      active: ['DLD07'],
      completedCount: 0,
      blockedStoryId: null,
      blockedReason: null,
      children: {
        DLD07: {
          storyId: 'DLD07',
          toolCounts: {},
          subagentCounts: {},
          tokenTotals: null,
          latestProgress: 'session linked',
          sessionLogPath,
        },
      },
      aggregate: { toolCounts: {}, subagentCounts: {}, tokenTotals: null },
    };

    const enriched = await enrichLiveMetricsFromSessionLogs(snapshot);

    expect(enriched.children.DLD07.toolCounts).toEqual({ exec_command: 1, spawn_agent: 1 });
    expect(enriched.children.DLD07.subagentCounts).toEqual({ reviewer: 1 });
    expect(enriched.children.DLD07.tokenTotals?.totalTokens).toBe(15);
    expect(enriched.children.DLD07.availability).toMatchObject({
      toolCounts: { status: 'available', unavailableReason: null },
      subagentCounts: { status: 'available', unavailableReason: null },
      tokenTotals: { status: 'available', unavailableReason: null },
      sessionLog: { status: 'available', unavailableReason: null },
    });
    expect(enriched.aggregate.toolCounts).toEqual({ exec_command: 1, spawn_agent: 1 });
  });
});
