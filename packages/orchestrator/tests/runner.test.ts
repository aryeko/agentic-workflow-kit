import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
    git: {
      strategy: 'worktree',
      branchPattern: '{track}/{id-lc}-{slug}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    },
    pr: {
      create: true,
      ci: { wait: false, command: null },
      review: {
        wait: 'none',
        bot: 'none',
        triageComments: false,
        maxFixBatches: 1,
        rerequestAfterFix: false,
        waitTimeoutMinutes: 30,
      },
      merge: { auto: false, method: 'squash', deleteBranch: true },
    },
    implement: {
      review: {
        prePr: { enabled: true, mode: 'auto', maxLoops: 2, loopMode: 'incremental' },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
    },
    orchestrator: {
      driver: 'codex-mcp',
      maxParallel: 2,
      stopLaunchingOnBlocked: true,
      childTimeoutMs: 1_800_000,
      childNoProgressTimeoutMs: 1_800_000,
      childStartupTimeoutMs: 60_000,
      childMaxRuntimeMs: 7_200_000,
    },
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
    const pending = new Promise<StoryRunResult>((resolve) => {
      this.pending.set(request.story.id, resolve);
    });
    await request.onLifecycle?.({
      type: 'session-linked',
      sessionId: `thread-${request.story.id.toLowerCase()}`,
      sessionLogPath: `/sessions/${request.story.id.toLowerCase()}.jsonl`,
    });
    return await pending;
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

class UnacknowledgedRunner implements StoryRunner {
  requests: StoryRunRequest[] = [];

  async runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    this.requests.push(request);
    return await new Promise<StoryRunResult>(() => undefined);
  }

  async checkTools(): Promise<{ ok: boolean; tools: string[] }> {
    return { ok: true, tools: ['codex'] };
  }
}

class ManualLifecycleRunner implements StoryRunner {
  requests: StoryRunRequest[] = [];
  private readonly pending = new Map<string, (result: StoryRunResult) => void>();

  async runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    this.requests.push(request);
    return await new Promise<StoryRunResult>((resolve) => {
      this.pending.set(request.story.id, resolve);
    });
  }

  async link(storyId: string): Promise<void> {
    const request = this.requests.find((entry) => entry.story.id === storyId);
    if (!request) throw new Error(`No request started for ${storyId}`);
    await request.onLifecycle?.({
      type: 'session-linked',
      sessionId: `thread-${storyId.toLowerCase()}`,
      sessionLogPath: `/sessions/${storyId.toLowerCase()}.jsonl`,
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

class LifecycleRunner implements StoryRunner {
  requests: StoryRunRequest[] = [];
  private resolveChild: ((result: StoryRunResult) => void) | null = null;

  async runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    this.requests.push(request);
    await request.onLifecycle?.({
      type: 'session-linked',
      sessionId: `thread-${request.story.id.toLowerCase()}`,
      sessionLogPath: `/sessions/${request.story.id.toLowerCase()}.jsonl`,
    });
    return await new Promise<StoryRunResult>((resolve) => {
      this.resolveChild = resolve;
    });
  }

  async emitProgress(message: string): Promise<void> {
    const request = this.requests[0];
    if (!request) throw new Error('No request started');
    await request.onLifecycle?.({ type: 'progress', message });
  }

  resolve(storyId: string): void {
    this.resolveChild?.({
      storyId,
      sessionId: `thread-${storyId.toLowerCase()}`,
      content: 'ok',
      rawResult: {},
      invocation: {},
    });
  }

  async checkTools(): Promise<{ ok: boolean; tools: string[] }> {
    return { ok: true, tools: ['codex'] };
  }
}

class FakeGitInspector implements GitInspector {
  calls: Array<{ storyId: string; cwdAbs: string }> = [];
  filesByRef = new Map<string, string>();

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

  async readFileFromRef(args: { ref: string; filePath: string }): Promise<string | null> {
    return this.filesByRef.get(`${args.ref}:${args.filePath}`) ?? null;
  }
}

class ManualChildTimer {
  private timeoutCallbacks = new Map<unknown, () => void>();
  private intervalCallback: (() => void) | null = null;
  private nextHandle = 1;

  setTimeout(callback: () => void): unknown {
    const handle = `timeout-${this.nextHandle++}`;
    this.timeoutCallbacks.set(handle, callback);
    return handle;
  }

  clearTimeout(handle: unknown): void {
    this.timeoutCallbacks.delete(handle);
  }

  setInterval(callback: () => void): unknown {
    this.intervalCallback = callback;
    return 'interval';
  }

  clearInterval(): void {
    this.intervalCallback = null;
  }

  fireTimeout(handle: unknown): void {
    this.timeoutCallbacks.get(handle)?.();
  }

  latestTimeoutHandle(): unknown {
    return [...this.timeoutCallbacks.keys()].at(-1) ?? null;
  }

  timeoutHandleCount(): number {
    return this.timeoutCallbacks.size;
  }

  hasInterval(): boolean {
    return this.intervalCallback !== null;
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

class DelayedSupervisorPollArtifacts extends MemoryArtifacts {
  private releasePollWrite: (() => void) | null = null;
  private resolvePollWriteStarted: () => void = () => undefined;
  readonly pollWriteStarted = new Promise<void>((resolve) => {
    this.resolvePollWriteStarted = resolve;
  });

  async writeJson(relativePath: string, value: unknown): Promise<void> {
    if (
      relativePath === 'children/A001.launch.json' &&
      typeof value === 'object' &&
      value !== null &&
      (value as { status?: string; lastSupervisorPollAt?: string | null }).status === 'launched' &&
      (value as { lastSupervisorPollAt?: string | null }).lastSupervisorPollAt !== null &&
      this.releasePollWrite === null
    ) {
      this.resolvePollWriteStarted();
      await new Promise<void>((resolve) => {
        this.releasePollWrite = resolve;
      });
    }
    await super.writeJson(relativePath, value);
  }

  release(): void {
    this.releasePollWrite?.();
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
    expect(artifacts.json.get('children/A001.json')).toMatchObject({
      storyId: 'A001',
      completionAuthority: 'tracker-complete-story-branch',
    });
    expect(artifacts.events).toContainEqual(
      expect.objectContaining({
        type: 'completion_authority',
        storyId: 'A001',
        authority: 'tracker-complete-story-branch',
      }),
    );
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

  it('blocks duplicate active launch records before starting a child', async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'wk-runner-duplicate-'));
    const runDir = path.join(workspaceRoot, '.codex/agentic-workflow-kit/runs/older-run/children');
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      path.join(runDir, 'A001.launch.json'),
      JSON.stringify({
        storyId: 'A001',
        launchId: 'existing',
        status: 'launched',
        expectedBranch: 't/a001-story',
        expectedWorktreePath: path.join(workspaceRoot, '.worktrees/t/a001-story'),
        startedAt: '2026-06-01T23:59:30.000Z',
        sessionId: null,
        lastHeartbeatAt: null,
        lastObservedChildProgressAt: null,
      }),
    );
    const artifacts = new MemoryArtifacts();
    const fake = new FakeRunner({
      storyId: 'A001',
      sessionId: 'thread-a001',
      content: 'ok',
      rawResult: {},
      invocation: {},
    });
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: configForWorkspace(workspaceRoot),
      storySource: new MutableStorySource([[story('A001')]]),
      storyRunner: fake,
      gitInspector: new FakeGitInspector(),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toContain('duplicate active launch');
    expect(fake.requests).toEqual([]);
    expect(artifacts.json.has('children/A001.launch.json')).toBe(false);
  });

  it('ignores stale unacknowledged startup launch records before retrying a story', async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'wk-runner-stale-startup-retry-'));
    const runDir = path.join(workspaceRoot, '.codex/agentic-workflow-kit/runs/older-run/children');
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      path.join(runDir, 'A001.launch.json'),
      JSON.stringify({
        storyId: 'A001',
        launchId: 'stale-startup',
        status: 'launched',
        expectedBranch: 't/a001-a001',
        expectedWorktreePath: path.join(workspaceRoot, '.worktrees/a001-a001'),
        startedAt: '2026-06-01T23:58:00.000Z',
        sessionId: null,
        lastHeartbeatAt: null,
        lastObservedChildProgressAt: null,
      }),
    );
    const artifacts = new MemoryArtifacts();
    const sync = new SyncRunner();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: configForWorkspace(workspaceRoot),
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: sync,
      gitInspector: new FakeGitInspector(),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('A001');

    expect(state.status).toBe('complete');
    expect(sync.requests.map((request) => request.story.id)).toEqual(['A001']);
    expect(artifacts.events).toContainEqual(
      expect.objectContaining({
        type: 'child-launch-stale-ignored',
        storyId: 'A001',
        duplicateStoryId: 'A001',
        duplicateLaunchId: 'stale-startup',
        reason: 'stale startup launch has no acknowledgement evidence',
      }),
    );
  });

  it('blocks duplicate expected branches already active in this run', async () => {
    const sync = new SyncRunner();
    const runnerConfig = {
      ...config(),
      git: { ...config().git, branchPattern: '{track}/shared-branch' },
    };
    const runner = new WorkflowRunner({
      command: 'run-eligible',
      config: runnerConfig,
      storySource: new MutableStorySource([
        [story('A001'), story('A002')],
        [story('A001', 'done'), story('A002', 'done')],
        [story('A001', 'done'), story('A002', 'done')],
      ]),
      storyRunner: sync,
      gitInspector: new FakeGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runEligible();

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toContain('duplicate active launch');
    expect(sync.requests).toEqual([]);
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

  it('can return after initial eligible child launch while supervision continues', async () => {
    const artifacts = new MemoryArtifacts();
    const deferred = new DeferredRunner();
    const runner = new WorkflowRunner({
      command: 'run-eligible',
      config: config(),
      storySource: new MutableStorySource([
        [story('A001'), story('A002')],
        [story('A001', 'done', false), story('A002', 'done', false)],
        [story('A001', 'done', false), story('A002', 'done', false)],
      ]),
      storyRunner: deferred,
      gitInspector: new FakeGitInspector(),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
    });

    const initialState = await runner.runEligible({ returnAfterInitialLaunch: true });

    expect(initialState).toMatchObject({
      status: 'running',
      active: ['A001', 'A002'],
      artifactDir: '/repo/.codex/agentic-workflow-kit/runs/run-1',
    });
    expect(deferred.requests.map((request) => request.story.id)).toEqual(['A001', 'A002']);

    deferred.resolve('A001');
    deferred.resolve('A002');
    await waitFor(() => expect((artifacts.json.get('state.json') as { status?: string })?.status).toBe('complete'));
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
    ).toEqual([['A001'], ['A001'], ['A002'], ['A002']]);
    expect(state.status).toBe('complete');
  });

  it('marks supervision lost when a child exceeds the no-progress timeout', async () => {
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
    timer.fireTimeout(timer.latestTimeoutHandle());
    const state = await run;

    expect(state.status).toBe('supervision_lost');
    expect(state.blockedReason).toContain('child-no-progress-timeout');
    expect(artifacts.json.get('children/A001.launch.json')).toMatchObject({
      storyId: 'A001',
      status: 'supervision_lost',
    });
    expect(artifacts.json.get('children/A001.json')).toMatchObject({
      storyId: 'A001',
      ok: false,
      error: 'child-no-progress-timeout',
    });
    expect(artifacts.events.map((event) => event.type)).toContain('child-supervision-lost');
    expect(artifacts.events.map((event) => event.type)).toContain('run-supervision-lost');
    expect(artifacts.events).toContainEqual(
      expect.objectContaining({
        type: 'parent_takeover_blocked',
        storyId: 'A001',
        decision: 'manual_recovery_required',
        evidence: expect.arrayContaining(['session thread-a001 has recent heartbeat']),
      }),
    );
  });

  it('persists child session linkage as soon as the child runner reports it', async () => {
    const artifacts = new MemoryArtifacts();
    const lifecycle = new LifecycleRunner();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: config(),
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: lifecycle,
      gitInspector: new FakeGitInspector(),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
    });

    const run = runner.runStory('A001');
    await waitFor(() =>
      expect(artifacts.json.get('children/A001.launch.json')).toMatchObject({
        storyId: 'A001',
        status: 'launched',
        sessionId: 'thread-a001',
        sessionLogPath: '/sessions/a001.jsonl',
      }),
    );

    lifecycle.resolve('A001');
    const state = await run;

    expect(state.status).toBe('complete');
  });

  it('marks unacknowledged child startup failed after the startup timeout', async () => {
    const artifacts = new MemoryArtifacts();
    const unacknowledged = new UnacknowledgedRunner();
    const timer = new ManualChildTimer();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: { ...config(), orchestrator: { ...config().orchestrator, childStartupTimeoutMs: 25 } },
      storySource: new MutableStorySource([[story('A001')]]),
      storyRunner: unacknowledged,
      gitInspector: new FakeGitInspector(),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
      childTimer: timer,
    });

    const run = runner.runStory('A001');
    await waitFor(() => expect(unacknowledged.requests).toHaveLength(1));
    expect(artifacts.json.get('children/A001.launch.json')).toMatchObject({
      storyId: 'A001',
      status: 'requested',
      sessionId: null,
      lastHeartbeatAt: null,
      lastObservedChildProgressAt: null,
    });
    timer.fireTimeout(timer.latestTimeoutHandle());
    const state = await run;

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toContain('child-startup-timeout');
    expect(state.active).toEqual([]);
    expect(state.activeChildren).toEqual([]);
    expect(artifacts.json.get('children/A001.launch.json')).toMatchObject({
      storyId: 'A001',
      status: 'startup_failed',
    });
    expect(artifacts.events).toContainEqual(
      expect.objectContaining({
        type: 'child-startup-failed',
        storyId: 'A001',
        error: 'child-startup-timeout',
      }),
    );
  });

  it('releases its tracker claim when startup fails before any child acknowledgement', async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'wk-runner-startup-release-'));
    const trackerPath = path.join(workspaceRoot, 'docs/tracks/sample/README.md');
    mkdirSync(path.dirname(trackerPath), { recursive: true });
    writeFileSync(trackerPath, trackerMarkdown('specced'));
    const resolvedConfig = {
      ...configForWorkspace(workspaceRoot),
      orchestrator: { ...configForWorkspace(workspaceRoot).orchestrator, childStartupTimeoutMs: 25 },
    };
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
    const unacknowledged = new UnacknowledgedRunner();
    const timer = new ManualChildTimer();
    const artifacts = new MemoryArtifacts();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: resolvedConfig,
      storySource,
      storyRunner: unacknowledged,
      gitInspector: new FakeGitInspector(),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
      childTimer: timer,
    });

    const run = runner.runStory('WK001');
    await waitFor(() => expect(unacknowledged.requests).toHaveLength(1));
    expect(readFileSync(trackerPath, 'utf8')).toContain('| WK001 | Wire parser to runner | — | 1 | implementing |');
    timer.fireTimeout(timer.latestTimeoutHandle());
    await run;

    expect(readFileSync(trackerPath, 'utf8')).toContain(
      '| WK001 | Wire parser to runner | — | 1 | specced | [spec](../../specs/WK001.md) | — | — | — |',
    );
    expect(artifacts.events).toContainEqual(
      expect.objectContaining({
        type: 'tracker-claim-released',
        storyId: 'WK001',
        fromStatus: 'implementing',
        toStatus: 'specced',
      }),
    );
  });

  it('serializes child startup acknowledgement while preserving parallel execution after linkage', async () => {
    const lifecycle = new ManualLifecycleRunner();
    const runner = new WorkflowRunner({
      command: 'run-eligible',
      config: config(),
      storySource: new MutableStorySource([
        [story('A001'), story('A002')],
        [story('A001', 'done', false), story('A002', 'done', false)],
        [story('A001', 'done', false), story('A002', 'done', false)],
      ]),
      storyRunner: lifecycle,
      gitInspector: new FakeGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const run = runner.runEligible();
    await waitFor(() => expect(lifecycle.requests.map((request) => request.story.id)).toEqual(['A001']));
    await lifecycle.link('A001');
    await waitFor(() => expect(lifecycle.requests.map((request) => request.story.id)).toEqual(['A001', 'A002']));
    await lifecycle.link('A002');

    lifecycle.resolve('A001');
    lifecycle.resolve('A002');
    const state = await run;

    expect(state.status).toBe('complete');
    expect(state.completed.map((entry) => entry.storyId)).toEqual(['A001', 'A002']);
  });

  it('resets the no-progress timeout on child progress while preserving a wall-clock timeout', async () => {
    const artifacts = new MemoryArtifacts();
    const lifecycle = new LifecycleRunner();
    const timer = new ManualChildTimer();
    const runnerConfig = {
      ...config(),
      orchestrator: {
        ...config().orchestrator,
        childTimeoutMs: 50,
        childNoProgressTimeoutMs: 50,
        childMaxRuntimeMs: 500,
      },
    };
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: runnerConfig,
      storySource: new MutableStorySource([[story('A001')], [story('A001', 'done')]]),
      storyRunner: lifecycle,
      gitInspector: new FakeGitInspector(),
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
      childTimer: timer,
    });

    const run = runner.runStory('A001');
    await waitFor(() => expect(lifecycle.requests).toHaveLength(1));
    const firstNoProgressHandle = timer.latestTimeoutHandle();
    await lifecycle.emitProgress('opened PR #91');
    expect(timer.timeoutHandleCount()).toBe(2);
    timer.fireTimeout(firstNoProgressHandle);
    lifecycle.resolve('A001');
    const state = await run;

    expect(state.status).toBe('complete');
    expect(artifacts.events).toContainEqual(
      expect.objectContaining({ type: 'child-progress', storyId: 'A001', message: 'opened PR #91' }),
    );
  });

  it('emits supervisor poll events without marking observed child progress', async () => {
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
    await waitFor(() => expect(artifacts.events.map((event) => event.type)).toContain('child-supervisor-poll'));
    expect(artifacts.events.map((event) => event.type)).not.toContain('child-heartbeat');
    expect(artifacts.events.find((event) => event.type === 'child-supervisor-poll')).toMatchObject({
      storyId: 'A001',
      launchId: 'A001-2026-06-02T00-00-00-000Z',
    });
    expect(artifacts.json.get('children/A001.launch.json')).toMatchObject({
      storyId: 'A001',
      lastSupervisorPollAt: '2026-06-02T00:00:00.000Z',
      lastObservedChildProgressAt: '2026-06-02T00:00:00.000Z',
      progressSource: 'session-linked',
    });
    deferred.resolve('A001');
    await run;

    const poll = artifacts.events.find((event) => event.type === 'child-supervisor-poll');
    expect(poll).toMatchObject({ storyId: 'A001', elapsedMs: 1_500 });
  });

  it('does not let a delayed supervisor poll overwrite a settled launch record', async () => {
    const artifacts = new DelayedSupervisorPollArtifacts();
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

    const run = runner.runStory('A001');
    await waitFor(() => expect(deferred.requests).toHaveLength(1));
    await waitFor(() => expect(timer.hasInterval()).toBe(true));
    timer.fireInterval();
    await artifacts.pollWriteStarted;
    deferred.resolve('A001');
    artifacts.release();
    const state = await run;

    expect(state.status).toBe('complete');
    expect(artifacts.json.get('children/A001.launch.json')).toMatchObject({
      storyId: 'A001',
      status: 'settled',
      lastSupervisorPollAt: '2026-06-02T00:00:00.000Z',
    });
  });

  it('uses authoritative base tracker status after child merge evidence when local parent snapshot is stale', async () => {
    const gitInspector = new FakeGitInspector({
      committed: true,
      branch: 'main',
      isBaseBranch: true,
      headSha: 'merge-sha',
      baseSha: 'merge-sha',
      uncommittedChanges: false,
      mergedPullRequest: { number: 100, url: 'https://github.com/acme/repo/pull/100', mergeCommitSha: 'merge-sha' },
    });
    gitInspector.filesByRef.set(
      'origin/main:docs/tracks/t/README.md',
      trackerMarkdown('done').replace('| — | — |', '| — | [PR #100](https://github.com/acme/repo/pull/100) |'),
    );
    const result = {
      storyId: 'WK001',
      sessionId: 'thread-wk001',
      content: 'merged PR #100',
      rawResult: {},
      invocation: {},
      evidence: {
        finalStatus: 'done',
        trackerPath: 'docs/tracks/t/README.md',
        prNumber: 100,
        prUrl: 'https://github.com/acme/repo/pull/100',
        merged: true,
        mergeCommit: 'merge-sha',
      },
    } as StoryRunResult;
    const artifacts = new MemoryArtifacts();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: { ...config(), pr: { ...config().pr, merge: { ...config().pr.merge, auto: true } } },
      storySource: new MutableStorySource([[story('WK001')], [story('WK001', 'implementing', false)]]),
      storyRunner: new FakeRunner(result),
      gitInspector,
      artifactStore: artifacts,
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('WK001');

    expect(state.status).toBe('complete');
    expect(state.completed[0]).toMatchObject({ storyId: 'WK001', returnedStatus: 'done', returnedComplete: true });
    expect(artifacts.json.get('children/WK001.json')).toMatchObject({
      storyId: 'WK001',
      completionAuthority: 'merged-pr-on-base',
      completionAuthoritySource: 'base-tracker',
    });
    expect(artifacts.events).toContainEqual(
      expect.objectContaining({
        type: 'completion_authority',
        storyId: 'WK001',
        authority: 'merged-pr-on-base',
        source: 'base-tracker',
      }),
    );
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
    expect(storyRunner.requests[0].story).toMatchObject({
      status: 'implementing',
      owner: 'awk:run-1:WK001',
    });
    expect(state.status).toBe('complete');
    expect(state.completed[0]).toMatchObject({ storyId: 'WK001', returnedStatus: 'done', returnedComplete: true });
  });

  it('blocks stale launch records before claiming a real tracker row', async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'wk-runner-claim-duplicate-'));
    const trackerPath = path.join(workspaceRoot, 'docs/tracks/sample/README.md');
    const staleChildrenDir = path.join(workspaceRoot, '.codex/agentic-workflow-kit/runs/older-run/children');
    mkdirSync(path.dirname(trackerPath), { recursive: true });
    mkdirSync(staleChildrenDir, { recursive: true });
    writeFileSync(trackerPath, trackerMarkdown('specced'));
    writeFileSync(
      path.join(staleChildrenDir, 'WK001.launch.json'),
      JSON.stringify({
        storyId: 'WK001',
        launchId: 'existing',
        status: 'launched',
        expectedBranch: 'sample/wk001-wire-parser-to-runner',
        expectedWorktreePath: path.join(workspaceRoot, '.worktrees/sample/wk001-wire-parser-to-runner'),
      }),
    );

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
    const storyRunner = new SyncRunner();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: resolvedConfig,
      storySource,
      storyRunner,
      gitInspector: new FakeGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('WK001');

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toContain('duplicate active launch');
    expect(storyRunner.requests).toEqual([]);
    expect(readFileSync(trackerPath, 'utf8')).toContain(
      '| WK001 | Wire parser to runner | — | 1 | specced | [spec](../../specs/WK001.md) | — | — | — |',
    );
  });

  it('preserves forced runs for unowned status-ineligible tracker rows', async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'wk-runner-force-claim-'));
    const trackerPath = path.join(workspaceRoot, 'docs/tracks/sample/README.md');
    mkdirSync(path.dirname(trackerPath), { recursive: true });
    writeFileSync(trackerPath, trackerMarkdown('blocked'));

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
      command: 'run-story',
      config: resolvedConfig,
      storySource,
      storyRunner,
      gitInspector: new FakeGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('WK001', { force: true });

    expect(storyRunner.requests[0].story).toMatchObject({
      status: 'implementing',
      owner: 'awk:run-1:WK001',
    });
    expect(state.status).toBe('complete');
  });

  it('blocks before launching when the tracker claim fails', async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'wk-runner-claim-blocked-'));
    const trackerPath = path.join(workspaceRoot, 'docs/tracks/sample/README.md');
    mkdirSync(path.dirname(trackerPath), { recursive: true });
    writeFileSync(trackerPath, trackerMarkdown('specced').replace('| — | — |\n', '| arye | — |\n'));

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
    const storyRunner = new SyncRunner();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: resolvedConfig,
      storySource,
      storyRunner,
      gitInspector: new FakeGitInspector(),
      artifactStore: new MemoryArtifacts(),
      logger,
      clock,
      runId: 'run-1',
    });

    const state = await runner.runStory('WK001', { force: true });

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toBe('owner is arye');
    expect(storyRunner.requests).toEqual([]);
  });
});
