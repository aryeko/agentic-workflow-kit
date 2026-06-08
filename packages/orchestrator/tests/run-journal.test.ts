import { describe, expect, it } from 'vitest';
import { MetricsCollector } from '../src/runner/MetricsCollector';
import { RunJournal, type SettledStoryRun } from '../src/runner/RunJournal';
import type { ArtifactStore, Clock, RunEvent, RunState } from '../src/types';

class MemoryArtifacts implements ArtifactStore {
  json = new Map<string, unknown>();
  events: RunEvent[] = [];
  async writeJson(relativePath: string, value: unknown): Promise<void> {
    this.json.set(relativePath, value);
  }
  async writeText(): Promise<void> {}
  async appendEvent(event: RunEvent): Promise<void> {
    this.events.push(event);
  }
}

const clock: Clock = { now: () => '2026-06-02T00:00:01.000Z', nowMs: () => 1_000 };

function state(): RunState {
  return {
    runId: 'run-1',
    command: 'run-story',
    workspaceRoot: '/repo',
    artifactDir: '/repo/.codex/agentic-workflow-kit/runs/run-1',
    status: 'running',
    maxParallel: 2,
    startedAt: '2026-06-02T00:00:00.000Z',
    active: [],
    completed: [],
    blockedStoryId: null,
    blockedReason: null,
  };
}

describe('RunJournal', () => {
  it('writes state, live metrics, settled children, raw results, and events with existing paths', async () => {
    const artifacts = new MemoryArtifacts();
    const runState = state();
    const metrics = new MetricsCollector(clock);
    metrics.start('A001');
    metrics.complete('A001');
    const journal = new RunJournal({ artifactStore: artifacts, clock });
    const settled: SettledStoryRun = {
      storyId: 'A001',
      ok: true,
      sessionId: 'thread-a001',
      content: 'ok',
      rawResult: { raw: true },
      invocation: {},
      completedAt: '2026-06-02T00:00:01.000Z',
    };

    await journal.writeState(runState);
    await journal.writeLiveMetrics(runState, metrics.observedChildMetrics());
    const entry = await journal.recordSettledChild(metrics, settled, { status: 'done' }, true);
    await journal.record('child-complete', { storyId: 'A001' });

    expect(artifacts.json.has('state.json')).toBe(true);
    expect(artifacts.json.has('metrics.live.json')).toBe(true);
    expect(artifacts.json.get('children/A001.json')).toMatchObject({
      storyId: 'A001',
      startedAt: '2026-06-02T00:00:01.000Z',
      durationMs: 0,
      returnedStatus: 'done',
      returnedComplete: true,
    });
    expect(artifacts.json.get('children/A001.raw.json')).toEqual({ raw: true });
    expect(entry).toMatchObject({
      storyId: 'A001',
      ok: true,
      returnedStatus: 'done',
      returnedComplete: true,
    });
    expect(artifacts.events[0]).toEqual({
      ts: '2026-06-02T00:00:01.000Z',
      type: 'child-complete',
      storyId: 'A001',
    });
  });

  it('writes launch records before settled child results', async () => {
    const artifacts = new MemoryArtifacts();
    const journal = new RunJournal({ artifactStore: artifacts, clock });

    await journal.recordChildLaunch({
      storyId: 'A001',
      launchId: 'A001-2026-06-08T00-00-00-000Z',
      runId: 'run-1',
      status: 'launched',
      startedAt: '2026-06-02T00:00:01.000Z',
      updatedAt: '2026-06-02T00:00:01.000Z',
      trackerPath: 'docs/tracks/t/README.md',
      expectedBranch: 't/a001-story',
      expectedWorktreePath: '/repo/.worktrees/t/a001-story',
      childCwd: '/repo',
      baseShaAtLaunch: 'base',
      promptHash: 'hash',
      sessionId: null,
      sessionLogPath: null,
      lastHeartbeatAt: null,
    });

    expect(artifacts.json.get('children/A001.launch.json')).toMatchObject({
      storyId: 'A001',
      status: 'launched',
      expectedBranch: 't/a001-story',
    });
  });
});
