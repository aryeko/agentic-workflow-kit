import { describe, expect, it } from 'vitest';
import { resolveCwdOnlyConfig } from '../src/config/configLoader';
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
      recordedAt: '2026-06-02T00:00:01.000Z',
      eventAt: '2026-06-02T00:00:01.000Z',
      type: 'child-complete',
      storyId: 'A001',
    });
  });

  it('writes normalized summary, rows, budget, and transcript artifacts', async () => {
    const artifacts = new MemoryArtifacts();
    const runState = {
      ...state(),
      active: ['A001'],
    };
    const metrics = new MetricsCollector(clock);
    metrics.observeChildProgress('A001', {
      latestProgress: 'running tests',
      sessionLogPath: '/sessions/a001.jsonl',
    });
    const journal = new RunJournal({ artifactStore: artifacts, clock });

    const live = await journal.writeLiveMetrics(runState, metrics.observedChildMetrics());
    await journal.writeRuntimeArtifacts(runState, resolveCwdOnlyConfig('/repo'), live);

    expect(artifacts.json.get('summary.json')).toMatchObject({
      schemaVersion: 1,
      runId: 'run-1',
      artifactPaths: {
        summary: 'summary.json',
        rows: 'rows.json',
        budgets: 'budgets.json',
        transcripts: 'transcripts.json',
        analysis: 'analysis.json',
        report: 'report.md',
      },
    });
    expect(artifacts.json.get('rows.json')).toMatchObject({
      schemaVersion: 1,
      rows: [
        {
          storyId: 'A001',
          status: 'active',
          sessionLogPath: '/sessions/a001.jsonl',
          tokens: {
            value: null,
            unavailableReason: 'session log token telemetry is unavailable',
          },
        },
      ],
    });
    expect(artifacts.json.get('budgets.json')).toMatchObject({
      schemaVersion: 1,
      runId: 'run-1',
      evaluations: expect.arrayContaining([
        expect.objectContaining({
          profileName: 'storyImplementer',
          dimension: 'toolCalls',
          status: 'unavailable',
          unavailableReason: 'session log metrics are unavailable',
        }),
        expect.objectContaining({
          profileName: 'storyImplementer',
          dimension: 'failedToolCalls',
          status: 'unavailable',
          unavailableReason: 'failed tool-call telemetry is unavailable',
        }),
        expect.objectContaining({
          profileName: 'storyImplementer',
          dimension: 'tokens',
          status: 'unavailable',
          unavailableReason: 'session log token telemetry is unavailable',
        }),
      ]),
    });
    expect(artifacts.json.get('transcripts.json')).toMatchObject({
      schemaVersion: 1,
      transcripts: [
        {
          storyId: 'A001',
          sessionLogPath: '/sessions/a001.jsonl',
          status: 'linked',
        },
      ],
    });
  });

  it('distinguishes observed zero tool calls from unavailable tool-call telemetry', async () => {
    const artifacts = new MemoryArtifacts();
    const runState = { ...state(), active: ['A001'] };
    const journal = new RunJournal({ artifactStore: artifacts, clock });

    const live = await journal.writeLiveMetrics(runState, {
      A001: {
        storyId: 'A001',
        toolCounts: {},
        subagentCounts: {},
        tokenTotals: null,
        latestProgress: 'no tools needed',
        sessionLogPath: '/sessions/a001.jsonl',
        availability: {
          toolCounts: { status: 'available', unavailableReason: null },
          subagentCounts: { status: 'available', unavailableReason: null },
          tokenTotals: { status: 'unavailable', unavailableReason: 'session log token telemetry is unavailable' },
          sessionLog: { status: 'available', unavailableReason: null },
        },
      },
    });
    await journal.writeRuntimeArtifacts(runState, resolveCwdOnlyConfig('/repo'), live);

    expect(artifacts.json.get('budgets.json')).toMatchObject({
      evaluations: expect.arrayContaining([
        expect.objectContaining({
          profileName: 'storyImplementer',
          dimension: 'toolCalls',
          observed: 0,
          status: 'not-configured',
          unavailableReason: null,
        }),
      ]),
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
      lastSupervisorPollAt: null,
      lastObservedChildProgressAt: null,
      progressSource: null,
      lastHeartbeatAt: null,
    });

    expect(artifacts.json.get('children/A001.launch.json')).toMatchObject({
      storyId: 'A001',
      status: 'launched',
      expectedBranch: 't/a001-story',
    });
  });
});
