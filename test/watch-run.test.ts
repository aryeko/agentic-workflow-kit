import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  pollWatchRunHandler,
  startWatchRunHandler,
  stopWatchRunHandler,
  watchRunHandler,
} from '../packages/orchestrator/src/commands/handlers.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('watch run handler', () => {
  it('returns immediately by default for running state', async () => {
    const runPath = await writeRun({
      state: { runId: 'run-1', status: 'running', active: ['DLD07'], activeChildren: [], completed: [] },
      metrics: { runId: 'run-1', status: 'running', children: {}, aggregate: {} },
    });

    const started = Date.now();
    const snapshot = await watchRunHandler(runPath, {});

    expect(Date.now() - started).toBeLessThan(1000);
    expect(snapshot.wait).toBeUndefined();
    expect(snapshot.summary).toMatchObject({ runId: 'run-1', status: 'running', active: ['DLD07'] });
  });

  it('summarizes per-story launch and metric state', async () => {
    const runPath = await writeRun({
      state: {
        runId: 'run-1',
        status: 'running',
        active: ['DLD07'],
        completed: [],
        blockedStoryId: null,
        blockedReason: null,
        activeChildren: [
          {
            storyId: 'DLD07',
            launchId: 'DLD07-1',
            expectedBranch: 'story/dld07',
            expectedWorktreePath: '/repo/.worktrees/DLD07',
            startedAt: '2026-06-13T12:00:00.000Z',
            lastSupervisorPollAt: '2026-06-13T12:01:00.000Z',
            lastObservedChildProgressAt: '2026-06-13T12:02:00.000Z',
            progressSource: 'codex-event',
            lastHeartbeatAt: '2026-06-13T12:02:00.000Z',
          },
        ],
      },
      metrics: {
        runId: 'run-1',
        status: 'running',
        elapsedMs: 120000,
        active: ['DLD07'],
        children: {
          DLD07: {
            storyId: 'DLD07',
            toolCounts: { exec_command: 2 },
            subagentCounts: { reviewer: 1 },
            tokenTotals: {
              inputTokens: 10,
              cachedInputTokens: 5,
              outputTokens: 3,
              reasoningOutputTokens: 1,
              totalTokens: 14,
            },
            latestProgress: 'task complete',
            sessionLogPath: '/sessions/dld07.jsonl',
          },
        },
        aggregate: {
          toolCounts: { exec_command: 2 },
          subagentCounts: { reviewer: 1 },
          tokenTotals: {
            inputTokens: 10,
            cachedInputTokens: 5,
            outputTokens: 3,
            reasoningOutputTokens: 1,
            totalTokens: 14,
          },
        },
      },
    });

    const snapshot = await watchRunHandler(runPath, {});

    expect(snapshot.summary?.stories).toEqual([
      expect.objectContaining({
        storyId: 'DLD07',
        status: 'active',
        sessionLogPath: '/sessions/dld07.jsonl',
        expectedBranch: 'story/dld07',
        toolCounts: { exec_command: 2 },
        subagentCounts: { reviewer: 1 },
      }),
    ]);
  });

  it('starts, polls, and stops a watch cursor without holding a long request open', async () => {
    const runPath = await writeRun({
      state: { runId: 'run-1', status: 'running', active: ['DLD07'], completed: [] },
      metrics: { runId: 'run-1', status: 'running', children: {}, aggregate: {} },
    });

    const started = await startWatchRunHandler(runPath, {});
    expect(started.watchId).toMatch(/^watch_/);
    expect(started.cursor).toEqual({ eventOffset: 0 });

    const polled = await pollWatchRunHandler({ runPath, cursor: started.cursor }, {});
    expect(polled.summary?.runId).toBe('run-1');
    expect(polled.cursor.eventOffset).toBe(0);

    const stopped = await stopWatchRunHandler(started.watchId);
    expect(stopped.stopped).toBe(true);
  });
});

async function writeRun(input: { state: unknown; metrics: unknown }): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'awk-watch-'));
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'state.json'), JSON.stringify(input.state, null, 2));
  await writeFile(path.join(root, 'metrics.live.json'), JSON.stringify(input.metrics, null, 2));
  return root;
}
