import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StoryRunner, StoryRunRequest, StoryRunResult } from '../src/drivers/StoryRunner';
import type { GitInspector, StoryCommitEvidence } from '../src/git/GitInspector';
import { WorkflowRunner } from '../src/runner/WorkflowRunner';
import { discoverMarkdownTracks } from '../src/tracks/markdownTracker';
import type {
  ArtifactStore,
  Clock,
  Logger,
  ResolvedWorkflowConfig,
  RunEvent,
  StorySource,
  WorkflowStory,
} from '../src/types';

function config(): ResolvedWorkflowConfig {
  return {
    version: 1,
    configPath: '/repo/.workflow/config.yaml',
    workspace: { rootAbs: '/repo' },
    paths: {
      tracksDir: 'docs/tracks',
      tracksDirAbs: '/repo/docs/tracks',
      archiveDir: 'docs/tracks/archive',
      archiveDirAbs: '/repo/docs/tracks/archive',
    },
    artifacts: {
      rootDir: '.codex/agentic-workflow-kit',
      rootDirAbs: '/repo/.codex/agentic-workflow-kit',
      runsDirAbs: '/repo/.codex/agentic-workflow-kit/runs',
    },
    statuses: { eligible: ['specced'], inProgress: 'implementing', complete: ['done', 'verified'] },
    tracker: { idPattern: '^[A-Z]+[0-9]+$' },
    git: { strategy: 'worktree', branchPattern: '{track}/{id-lc}-{slug}', baseBranch: 'main', commitOnBase: 'forbid' },
    pr: {
      create: true,
      ci: { wait: false, command: null },
      review: { wait: 'none', bot: 'none', triageComments: false, maxLoops: 3, waitTimeoutMinutes: 30 },
      merge: { auto: false, method: 'squash', deleteBranch: true },
    },
    implement: {
      review: {
        prePr: { enabled: true, mode: 'inline', maxLoops: 2 },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
    },
    orchestrator: { driver: 'codex-mcp', maxParallel: 2, stopLaunchingOnBlocked: true, childTimeoutMs: 1_800_000 },
    codex: { childSession: { cwdAbs: '/repo' } },
  };
}

function configForWorkspace(workspaceRoot: string): ResolvedWorkflowConfig {
  return {
    ...config(),
    configPath: path.join(workspaceRoot, '.workflow/config.yaml'),
    workspace: { rootAbs: workspaceRoot },
    paths: {
      tracksDir: 'docs/tracks',
      tracksDirAbs: path.join(workspaceRoot, 'docs/tracks'),
      archiveDir: 'docs/tracks/archive',
      archiveDirAbs: path.join(workspaceRoot, 'docs/tracks/archive'),
    },
    artifacts: {
      rootDir: '.codex/agentic-workflow-kit',
      rootDirAbs: path.join(workspaceRoot, '.codex/agentic-workflow-kit'),
      runsDirAbs: path.join(workspaceRoot, '.codex/agentic-workflow-kit/runs'),
    },
    codex: { childSession: { cwdAbs: workspaceRoot } },
  };
}

function story(id: string, status = 'specced', eligible = true): WorkflowStory {
  return {
    id,
    title: id,
    status,
    owner: null,
    dependencies: [],
    eligible,
    blockedReason: eligible ? null : 'blocked',
    metadata: { trackId: 't', trackTitle: 'T', trackerPath: 'docs/tracks/t/README.md', order: 1 },
  };
}

class MutableStorySource implements StorySource {
  constructor(private snapshots: WorkflowStory[][]) {}
  async listStories(): Promise<WorkflowStory[]> {
    return this.snapshots.shift() ?? [];
  }
}

class FakeRunner implements StoryRunner {
  requests: StoryRunRequest[] = [];
  constructor(private result: StoryRunResult | Error) {}
  async runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    this.requests.push(request);
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
  async checkTools(): Promise<{ ok: boolean; tools: string[] }> {
    return { ok: true, tools: ['codex'] };
  }
}

class SyncRunner implements StoryRunner {
  requests: StoryRunRequest[] = [];
  runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    this.requests.push(request);
    return Promise.resolve({
      storyId: request.story.id,
      sessionId: `thread-${request.story.id.toLowerCase()}`,
      content: 'ok',
      rawResult: {},
      invocation: {},
    });
  }
  async checkTools(): Promise<{ ok: boolean; tools: string[] }> {
    return { ok: true, tools: ['codex'] };
  }
}

class CompletingTrackerRunner implements StoryRunner {
  requests: StoryRunRequest[] = [];
  constructor(private readonly trackerPath: string) {}
  runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    this.requests.push(request);
    writeFileSync(this.trackerPath, trackerMarkdown('done'));
    return Promise.resolve({
      storyId: request.story.id,
      sessionId: `thread-${request.story.id.toLowerCase()}`,
      content: 'updated tracker',
      rawResult: {},
      invocation: {},
    });
  }
  async checkTools(): Promise<{ ok: boolean; tools: string[] }> {
    return { ok: true, tools: ['codex'] };
  }
}

class DeferredRunner implements StoryRunner {
  requests: StoryRunRequest[] = [];
  private readonly pending = new Map<string, (result: StoryRunResult) => void>();

  async runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    this.requests.push(request);
    return await new Promise<StoryRunResult>((resolve) => {
      this.pending.set(request.story.id, resolve);
    });
  }

  resolve(storyId: string): void {
    const resolve = this.pending.get(storyId);
    if (!resolve) throw new Error(`No pending story ${storyId}`);
    this.pending.delete(storyId);
    resolve({ storyId, sessionId: `thread-${storyId.toLowerCase()}`, content: 'ok', rawResult: {}, invocation: {} });
  }

  async checkTools(): Promise<{ ok: boolean; tools: string[] }> {
    return { ok: true, tools: ['codex'] };
  }
}

class FakeGitInspector implements GitInspector {
  calls: Array<{ storyId: string; cwdAbs: string }> = [];

  constructor(
    private evidence: StoryCommitEvidence = {
      committed: true,
      branch: 't/a001-story',
      isBaseBranch: false,
      headSha: 'head',
      baseSha: 'base',
      uncommittedChanges: false,
    },
  ) {}

  async snapshotBaseSha(): Promise<string | null> {
    return 'base-at-launch';
  }

  setEvidence(evidence: StoryCommitEvidence): void {
    this.evidence = evidence;
  }

  async inspectStory(args: Parameters<GitInspector['inspectStory']>[0]): Promise<StoryCommitEvidence> {
    this.calls.push({ storyId: args.story.id, cwdAbs: args.cwdAbs });
    return this.evidence;
  }
}

class ManualChildTimer {
  private timeoutCallback: (() => void) | null = null;
  private intervalCallback: (() => void) | null = null;

  setTimeout(callback: () => void): unknown {
    this.timeoutCallback = callback;
    return 'timeout';
  }

  clearTimeout(): void {
    this.timeoutCallback = null;
  }

  setInterval(callback: () => void): unknown {
    this.intervalCallback = callback;
    return 'interval';
  }

  clearInterval(): void {
    this.intervalCallback = null;
  }

  fireTimeout(): void {
    this.timeoutCallback?.();
  }

  fireInterval(): void {
    this.intervalCallback?.();
  }
}

class MemoryArtifacts implements ArtifactStore {
  json = new Map<string, unknown>();
  jsonWrites: { relativePath: string; value: unknown }[] = [];
  text = new Map<string, string>();
  events: RunEvent[] = [];
  async writeJson(relativePath: string, value: unknown): Promise<void> {
    const snapshot = structuredClone(value);
    this.json.set(relativePath, snapshot);
    this.jsonWrites.push({ relativePath, value: snapshot });
  }
  async writeText(relativePath: string, value: string): Promise<void> {
    this.text.set(relativePath, value);
  }
  async appendEvent(event: RunEvent): Promise<void> {
    this.events.push(event);
  }
}

const logger: Logger = { info() {}, warn() {}, error() {} };
let fakeMs = 1_000;
const clock: Clock = { now: () => '2026-06-02T00:00:00.000Z', nowMs: () => fakeMs };

function trackerMarkdown(status: string): string {
  return `---
title: Sample tracker
status: approved
owner: —
---

## Status matrix

| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WK001 | Wire parser to runner | — | 1 | ${status} | [spec](../../specs/WK001.md) | — | — | — |
`;
}

async function waitFor(assertion: () => void): Promise<void> {
  const started = Date.now();
  for (;;) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - started > 1000) throw error;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

describe('WorkflowRunner', () => {
  it('runs one story and completes only after tracker reread shows complete status', async () => {
    const artifacts = new MemoryArtifacts();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: config(),
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: new FakeRunner({
        storyId: 'A001',
        sessionId: 'thread-a001',
        content: 'ok',
        rawResult: {},
        invocation: {},
      }),
      gitInspector: new FakeGitInspector(),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('complete');
    expect(state.completed[0]).toMatchObject({ storyId: 'A001', returnedStatus: 'done', returnedComplete: true });
    expect(artifacts.events.map((event) => event.type)).toContain('child-complete');
    expect(artifacts.json.has('metrics.live.json')).toBe(true);
  });

  it('blocks when child returns but tracker row is not complete', async () => {
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: config(),
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'specced')]]),
      storyRunner: new FakeRunner({
        storyId: 'A001',
        sessionId: 'thread-a001',
        content: 'ok',
        rawResult: {},
        invocation: {},
      }),
      gitInspector: new FakeGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toBe('A001 returned but status is specced');
  });

  it('blocks when child driver throws', async () => {
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: config(),
      storySource: new MutableStorySource([[story('A001')]]),
      storyRunner: new FakeRunner(new Error('driver failed')),
      gitInspector: new FakeGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toBe('driver failed');
  });

  it('dry-runs eligible stories without launching children', async () => {
    const fake = new FakeRunner({
      storyId: 'A001',
      sessionId: 'thread-a001',
      content: 'ok',
      rawResult: {},
      invocation: {},
    });
    const runner = new WorkflowRunner({
      command: 'run-eligible',
      config: config(),
      storySource: new MutableStorySource([[story('A001'), story('A002')]]),
      storyRunner: fake,
      gitInspector: new FakeGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.dryRunEligible();

    expect(state.status).toBe('dry-run');
    expect(state.dryRunDispatch).toEqual(['A001', 'A002']);
    expect(fake.requests).toEqual([]);
  });

  it('dry-runs one story without launching a child', async () => {
    const fake = new FakeRunner({
      storyId: 'A001',
      sessionId: 'thread-a001',
      content: 'ok',
      rawResult: {},
      invocation: {},
    });
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: config(),
      storySource: new MutableStorySource([[story('A001'), story('A002')]]),
      storyRunner: fake,
      gitInspector: new FakeGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.dryRunStory('A001');

    expect(state.status).toBe('dry-run');
    expect(state.dryRunDispatch).toEqual(['A001']);
    expect(fake.requests).toEqual([]);
  });

  it('keeps maxParallel slots active and launches newly eligible stories after tracker rereads', async () => {
    const deferred = new DeferredRunner();
    const runner = new WorkflowRunner({
      command: 'run-eligible',
      config: config(),
      storySource: new MutableStorySource([
        [story('A001'), story('A002'), story('A003', 'blocked', false)],
        [story('A001', 'done', false), story('A002'), story('A003')],
        [story('A001', 'done', false), story('A002', 'done', false), story('A003')],
        [story('A001', 'done', false), story('A002', 'done', false), story('A003', 'done', false)],
      ]),
      storyRunner: deferred,
      gitInspector: new FakeGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const run = runner.runEligible();
    await waitFor(() => expect(deferred.requests.map((request) => request.story.id)).toEqual(['A001', 'A002']));

    deferred.resolve('A001');
    await waitFor(() => expect(deferred.requests.map((request) => request.story.id)).toEqual(['A001', 'A002', 'A003']));

    deferred.resolve('A002');
    deferred.resolve('A003');
    const state = await run;

    expect(state.status).toBe('complete');
    expect(state.completed.map((entry) => entry.storyId)).toEqual(['A001', 'A002', 'A003']);
  });

  it('records synchronous child launches in source order under the p-limit pool', async () => {
    const artifacts = new MemoryArtifacts();
    const sync = new SyncRunner();
    const runner = new WorkflowRunner({
      command: 'run-eligible',
      config: config(),
      storySource: new MutableStorySource([
        [story('A001'), story('A002')],
        [story('A001', 'done', false), story('A002', 'done', false)],
        [story('A001', 'done', false), story('A002', 'done', false)],
      ]),
      storyRunner: sync,
      gitInspector: new FakeGitInspector(),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runEligible();

    expect(sync.requests.map((request) => request.story.id)).toEqual(['A001', 'A002']);
    expect(artifacts.events.filter((event) => event.type === 'child-launched').map((event) => event.storyId)).toEqual([
      'A001',
      'A002',
    ]);
    expect(
      artifacts.jsonWrites
        .filter((write) => write.relativePath === 'state.json')
        .map((write) => (write.value as { active: string[] }).active)
        .filter((active) => active.length > 0),
    ).toEqual([['A001'], ['A001', 'A002']]);
    expect(state.status).toBe('complete');
  });

  it('blocks a child that exceeds childTimeoutMs and writes a failure record', async () => {
    const artifacts = new MemoryArtifacts();
    const deferred = new DeferredRunner();
    const timer = new ManualChildTimer();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: { ...config(), orchestrator: { ...config().orchestrator, childTimeoutMs: 25 } },
      storySource: new MutableStorySource([[story('A001')]]),
      storyRunner: deferred,
      gitInspector: new FakeGitInspector(),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
      childTimer: timer,
    });

    const run = runner.runStory('A001');
    await waitFor(() => expect(deferred.requests).toHaveLength(1));
    timer.fireTimeout();
    const state = await run;

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toContain('child-timeout');
    expect(artifacts.json.get('children/A001.json')).toMatchObject({
      storyId: 'A001',
      ok: false,
      error: 'child-timeout',
    });
  });

  it('emits child-heartbeat events while a child is in flight', async () => {
    const artifacts = new MemoryArtifacts();
    const deferred = new DeferredRunner();
    const timer = new ManualChildTimer();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: { ...config(), orchestrator: { ...config().orchestrator, childTimeoutMs: 100 } },
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: deferred,
      gitInspector: new FakeGitInspector(),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
      childTimer: timer,
    });

    fakeMs = 1_000;
    const run = runner.runStory('A001');
    await waitFor(() => expect(deferred.requests).toHaveLength(1));
    fakeMs = 2_500;
    timer.fireInterval();
    await waitFor(() => expect(artifacts.events.map((event) => event.type)).toContain('child-heartbeat'));
    deferred.resolve('A001');
    await run;

    const heartbeat = artifacts.events.find((event) => event.type === 'child-heartbeat');
    expect(heartbeat).toMatchObject({ storyId: 'A001', elapsedMs: 1_500 });
  });

  it('accepts complete only when a commit exists on a story branch', async () => {
    const gitInspector = new FakeGitInspector({
      committed: true,
      branch: 't/a001-story',
      isBaseBranch: false,
      headSha: 'head',
      baseSha: 'base',
      uncommittedChanges: false,
    });
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: config(),
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: new FakeRunner({
        storyId: 'A001',
        sessionId: 'thread-a001',
        content: 'ok',
        rawResult: {},
        invocation: {},
      }),
      gitInspector,
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('complete');
    expect(gitInspector.calls).toEqual([{ storyId: 'A001', cwdAbs: '/repo' }]);
  });

  it('inspects the child invocation cwd when it differs from the workspace root', async () => {
    const gitInspector = new FakeGitInspector();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: config(),
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: new FakeRunner({
        storyId: 'A001',
        sessionId: 'thread-a001',
        content: 'ok',
        rawResult: {},
        invocation: { cwd: '/repo/.worktrees/story-a001' },
      }),
      gitInspector,
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('complete');
    expect(gitInspector.calls).toEqual([{ storyId: 'A001', cwdAbs: '/repo/.worktrees/story-a001' }]);
  });

  it('blocks complete-but-uncommitted when tracker says done but no commit exists', async () => {
    const artifacts = new MemoryArtifacts();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: config(),
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: new FakeRunner({
        storyId: 'A001',
        sessionId: 'thread-a001',
        content: 'ok',
        rawResult: {},
        invocation: {},
      }),
      gitInspector: new FakeGitInspector({
        committed: false,
        branch: null,
        isBaseBranch: false,
        headSha: null,
        baseSha: 'base',
        uncommittedChanges: true,
      }),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toContain('complete-but-uncommitted');
    expect(artifacts.json.get('children/A001.json')).toMatchObject({
      returnedComplete: false,
      commitEvidence: { committed: false, uncommittedChanges: true },
    });
  });

  it('blocks complete-on-forbidden-base when commit is on base and commitOnBase is forbid', async () => {
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: config(),
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: new FakeRunner({
        storyId: 'A001',
        sessionId: 'thread-a001',
        content: 'ok',
        rawResult: {},
        invocation: {},
      }),
      gitInspector: new FakeGitInspector({
        committed: true,
        branch: 'main',
        isBaseBranch: true,
        headSha: 'head',
        baseSha: 'base',
        uncommittedChanges: false,
      }),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toContain('complete-on-forbidden-base');
  });

  it('allows base commit when commitOnBase is allow', async () => {
    const runnerConfig = { ...config(), git: { ...config().git, commitOnBase: 'allow' as const } };
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: runnerConfig,
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: new FakeRunner({
        storyId: 'A001',
        sessionId: 'thread-a001',
        content: 'ok',
        rawResult: {},
        invocation: {},
      }),
      gitInspector: new FakeGitInspector({
        committed: true,
        branch: 'main',
        isBaseBranch: true,
        headSha: 'head',
        baseSha: 'base',
        uncommittedChanges: false,
      }),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('complete');
  });

  it('blocks with inspect-failed reason when gitInspector.inspectStory throws', async () => {
    class ThrowingGitInspector implements GitInspector {
      async snapshotBaseSha(): Promise<string | null> {
        return 'base-sha';
      }
      async inspectStory(): Promise<StoryCommitEvidence> {
        throw new Error('git: not a repository');
      }
    }
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: config(),
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: new FakeRunner({
        storyId: 'A001',
        sessionId: 'thread-a001',
        content: 'ok',
        rawResult: {},
        invocation: {},
      }),
      gitInspector: new ThrowingGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toMatch(/inspect-failed:/);
    expect(state.blockedReason).toContain('git: not a repository');
  });

  it('completes in worktree strategy when committed but root has uncommitted changes', async () => {
    const runnerConfig = { ...config(), git: { ...config().git, strategy: 'worktree' as const } };
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: runnerConfig,
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: new FakeRunner({
        storyId: 'A001',
        sessionId: 'thread-a001',
        content: 'ok',
        rawResult: {},
        invocation: {},
      }),
      gitInspector: new FakeGitInspector({
        committed: true,
        branch: 't/a001-story',
        isBaseBranch: false,
        headSha: 'head',
        baseSha: 'base',
        uncommittedChanges: true,
      }),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('complete');
  });

  it('blocks complete-but-uncommitted in branch strategy even when committed', async () => {
    const runnerConfig = { ...config(), git: { ...config().git, strategy: 'branch' as const } };
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: runnerConfig,
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: new FakeRunner({
        storyId: 'A001',
        sessionId: 'thread-a001',
        content: 'ok',
        rawResult: {},
        invocation: {},
      }),
      gitInspector: new FakeGitInspector({
        committed: true,
        branch: 't/a001-story',
        isBaseBranch: false,
        headSha: 'head',
        baseSha: 'base',
        uncommittedChanges: true,
      }),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toContain('complete-but-uncommitted');
  });

  it('runs stories discovered from a real temp markdown tracker', async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'wk-runner-integration-'));
    const trackerPath = path.join(workspaceRoot, 'docs/tracks/sample/README.md');
    mkdirSync(path.dirname(trackerPath), { recursive: true });
    writeFileSync(trackerPath, trackerMarkdown('specced'));

    const resolvedConfig = configForWorkspace(workspaceRoot);
    const storySource: StorySource = {
      async listStories() {
        const tracks = await discoverMarkdownTracks({
          workspaceRoot,
          tracksDir: resolvedConfig.paths.tracksDir,
          archiveDir: resolvedConfig.paths.archiveDir,
          completeStatuses: resolvedConfig.statuses.complete,
          eligibleStatuses: resolvedConfig.statuses.eligible,
          idPattern: resolvedConfig.tracker.idPattern,
        });
        return tracks.flatMap((track) => track.stories);
      },
    };
    const storyRunner = new CompletingTrackerRunner(trackerPath);
    const runner = new WorkflowRunner({
      command: 'run-eligible',
      config: resolvedConfig,
      storySource,
      storyRunner,
      gitInspector: new FakeGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runEligible();

    expect(storyRunner.requests.map((request) => request.story.id)).toEqual(['WK001']);
    expect(state.status).toBe('complete');
    expect(state.completed[0]).toMatchObject({ storyId: 'WK001', returnedStatus: 'done', returnedComplete: true });
  });
});
