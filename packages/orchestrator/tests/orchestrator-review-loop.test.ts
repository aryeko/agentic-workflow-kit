import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileArtifactStore } from '../src/artifacts/FileArtifactStore';
import { resolveCwdOnlyConfig } from '../src/config/configLoader';
import type { ResumeStoryRequest, StoryRunner, StoryRunRequest, StoryRunResult } from '../src/drivers/StoryRunner';
import type { GitInspector, StoryCommitEvidence } from '../src/git/GitInspector';
import { notifyVerdict } from '../src/review/verdictInbox';
import { renderExpectedBranch, renderExpectedWorktreePath } from '../src/runner/launchMetadata';
import { WorkflowRunner } from '../src/runner/WorkflowRunner';
import type { Clock, Logger, ResolvedWorkflowConfig, ReviewVerdict, StorySource, WorkflowStory } from '../src/types';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

class SnapshotStorySource implements StorySource {
  private index = 0;

  constructor(private readonly snapshots: WorkflowStory[][]) {}

  async listStories(): Promise<WorkflowStory[]> {
    const snapshot = this.snapshots[Math.min(this.index, this.snapshots.length - 1)] ?? [];
    this.index += 1;
    return snapshot;
  }
}

/** Turn descriptor for the fake StoryRunner: yield (awaiting_review) or settle. */
type TurnScript = { kind: 'yield' } | { kind: 'settle' };

/**
 * Fake StoryRunner that drives a scripted sequence of turns. `runStory` consumes the first
 * scripted turn; each `resumeStory` consumes the next. A `yield` turn returns an
 * awaiting_review marker; a `settle` turn returns a plain settled result.
 */
class ScriptedStoryRunner implements StoryRunner {
  runRequests: StoryRunRequest[] = [];
  resumeRequests: ResumeStoryRequest[] = [];
  /** AbortSignal captured from the first runStory turn, so tests can abort mid-review. */
  childSignal: AbortSignal | null = null;
  private turnIndex = 0;

  constructor(private readonly script: TurnScript[]) {}

  async runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    this.runRequests.push(request);
    this.childSignal = request.signal ?? null;
    await request.onLifecycle?.({
      type: 'session-linked',
      sessionId: `thread-${request.story.id.toLowerCase()}`,
      sessionLogPath: `/sessions/${request.story.id.toLowerCase()}.jsonl`,
      progressSource: 'session-linked',
    });
    return this.nextResult(request.story.id, request.cwd);
  }

  async resumeStory(request: ResumeStoryRequest): Promise<StoryRunResult> {
    this.resumeRequests.push(request);
    await request.onLifecycle?.({
      type: 'progress',
      message: 'resumed',
      progressSource: 'codex-event',
    });
    return this.nextResult(request.story.id, request.cwd);
  }

  async checkTools(): Promise<{ ok: boolean; tools: string[] }> {
    return { ok: true, tools: ['fake'] };
  }

  private nextResult(storyId: string, cwd: string): StoryRunResult {
    const turn = this.script[Math.min(this.turnIndex, this.script.length - 1)] ?? { kind: 'settle' };
    this.turnIndex += 1;
    const sessionId = `thread-${storyId.toLowerCase()}`;
    if (turn.kind === 'yield') {
      return {
        storyId,
        sessionId,
        content: 'awaiting review',
        rawResult: { structured: true },
        invocation: { cwd },
        evidence: {
          prePrReview: { status: 'awaiting_review', packetPath: 'children/packet.json', loop: this.turnIndex },
        },
      };
    }
    return {
      storyId,
      sessionId,
      content: 'story completed',
      rawResult: { structured: true },
      invocation: { cwd },
    };
  }
}

/** Fake StoryRunner that never yields (no awaiting_review marker) - used for regression guard. */
class CompletingStoryRunner implements StoryRunner {
  runRequests: StoryRunRequest[] = [];
  resumeCalls = 0;

  async runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    this.runRequests.push(request);
    await request.onLifecycle?.({
      type: 'session-linked',
      sessionId: `thread-${request.story.id.toLowerCase()}`,
      sessionLogPath: `/sessions/${request.story.id.toLowerCase()}.jsonl`,
      progressSource: 'session-linked',
    });
    return {
      storyId: request.story.id,
      sessionId: `thread-${request.story.id.toLowerCase()}`,
      content: 'story completed',
      rawResult: { structured: true },
      invocation: { cwd: request.cwd },
    };
  }

  async resumeStory(request: ResumeStoryRequest): Promise<StoryRunResult> {
    this.resumeCalls += 1;
    return {
      storyId: request.story.id,
      sessionId: request.sessionId,
      content: 'resumed',
      rawResult: {},
      invocation: {},
    };
  }

  async checkTools(): Promise<{ ok: boolean; tools: string[] }> {
    return { ok: true, tools: ['fake'] };
  }
}

class PassingGitInspector implements GitInspector {
  async snapshotBaseSha(): Promise<string | null> {
    return 'base-sha';
  }

  async inspectStory(): Promise<StoryCommitEvidence> {
    return {
      committed: true,
      branch: 'sample/wk001-run-the-story',
      isBaseBranch: false,
      headSha: 'head-sha',
      baseSha: 'base-sha',
      uncommittedChanges: false,
    };
  }
}

const logger: Logger = { info() {}, warn() {}, error() {} };
const clock: Clock = {
  now: () => '2026-06-15T20:32:00.000Z',
  nowMs: () => 1_000,
};

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

async function readEvents(runPath: string): Promise<Array<Record<string, unknown>>> {
  const content = await readFile(path.join(runPath, 'events.ndjson'), 'utf8');
  return content
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function eventTypes(events: Array<Record<string, unknown>>): string[] {
  return events.map((event) => String(event.type));
}

interface ReviewConfigOptions {
  mode?: 'auto' | 'subagent' | 'inline' | 'orchestrator';
  maxLoops?: number;
  downgradeTo?: 'none' | 'subagent' | 'inline';
  loopMode?: 'incremental' | 'full';
  childReviewWaitTimeoutMs?: number;
}

function configForWorkspace(workspaceRoot: string, options: ReviewConfigOptions = {}): ResolvedWorkflowConfig {
  const base = resolveCwdOnlyConfig(workspaceRoot);
  return {
    ...base,
    pr: {
      ...base.pr,
      create: false,
      merge: { ...base.pr.merge, auto: false },
    },
    implement: {
      ...base.implement,
      review: {
        ...base.implement.review,
        prePr: {
          enabled: true,
          mode: options.mode ?? 'orchestrator',
          maxLoops: options.maxLoops ?? 2,
          loopMode: options.loopMode ?? 'incremental',
          downgradeTo: options.downgradeTo ?? 'none',
        },
      },
    },
    orchestrator: {
      ...base.orchestrator,
      driver: 'codex-mcp',
      maxParallel: 1,
      childNoProgressTimeoutMs: 5_000,
      childStartupTimeoutMs: 5_000,
      childMaxRuntimeMs: 5_000,
      childReviewWaitTimeoutMs: options.childReviewWaitTimeoutMs ?? 5_000,
    },
  };
}

function story(status: 'specced' | 'done'): WorkflowStory {
  return {
    id: 'WK001',
    title: 'Run the story',
    status,
    owner: null,
    dependencies: [],
    eligible: status === 'specced',
    blockedReason: null,
    metadata: {
      trackId: 'sample',
      trackTitle: 'Sample',
      trackerPath: 'docs/tracks/sample/README.md',
      order: 1,
      pr: '—',
    },
  };
}

function makeRunner(
  runId: string,
  config: ResolvedWorkflowConfig,
  source: SnapshotStorySource,
  storyRunner: StoryRunner,
): { runner: WorkflowRunner; runPath: string } {
  const runPath = path.join(config.artifacts.runsDirAbs, runId);
  const runner = new WorkflowRunner({
    command: 'run-story',
    config,
    storySource: source,
    storyRunner,
    gitInspector: new PassingGitInspector(),
    artifactStore: new FileArtifactStore(runPath),
    logger,
    clock,
    runId,
    childWorkspacePreparer: async ({ story: workflowStory, workspaceRootAbs, fallbackCwdAbs, git }) => ({
      childCwdAbs: fallbackCwdAbs,
      expectedBranch: renderExpectedBranch(workflowStory, git),
      expectedWorktreePath: renderExpectedWorktreePath(workspaceRootAbs, git, workflowStory),
      prepared: false,
    }),
  });
  return { runner, runPath };
}

describe('orchestrator pre-PR review loop', () => {
  it('yield -> PASS verdict -> resume opens PR -> run completes', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'awk-review-pass-'));
    tempRoots.push(workspaceRoot);
    const runId = 'run-pass';
    const config = configForWorkspace(workspaceRoot);
    const source = new SnapshotStorySource([[story('specced')], [story('done')]]);
    const storyRunner = new ScriptedStoryRunner([{ kind: 'yield' }, { kind: 'settle' }]);
    const { runner, runPath } = makeRunner(runId, config, source, storyRunner);

    const verdict: ReviewVerdict = { decision: 'PASS', summary: 'looks good' };
    const statePromise = runner.runStory('WK001');
    // Deliver the verdict once the child is awaiting review; poll-driven, deterministic.
    await deliverVerdictWhenWaiting(runPath, 'WK001', verdict);

    const state = await statePromise;

    expect(state.status).toBe('complete');
    expect(state.blockedStoryId).toBeNull();
    expect(storyRunner.resumeRequests).toHaveLength(1);
    expect(storyRunner.resumeRequests[0]?.sessionId).toBe('thread-wk001');
    expect(storyRunner.resumeRequests[0]?.message).toContain('PASS');

    const events = await readEvents(runPath);
    const types = eventTypes(events);
    expect(types).toContain('pre_pr_review_requested');
    expect(types).toContain('pre_pr_review_verdict');
  });

  it('yield -> BLOCK -> resume yields again -> exceeds maxLoops -> run blocked', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'awk-review-maxloops-'));
    tempRoots.push(workspaceRoot);
    const runId = 'run-maxloops';
    const config = configForWorkspace(workspaceRoot, { maxLoops: 2 });
    const source = new SnapshotStorySource([[story('specced')], [story('specced')]]);
    const storyRunner = new ScriptedStoryRunner([{ kind: 'yield' }, { kind: 'yield' }, { kind: 'yield' }]);
    const { runner, runPath } = makeRunner(runId, config, source, storyRunner);

    const statePromise = runner.runStory('WK001');
    // Deliver BLOCK twice; the second one hits maxLoops and blocks the run.
    await deliverVerdictWhenWaiting(runPath, 'WK001', { decision: 'BLOCK', summary: 'fix it' });
    await waitForResumeCount(storyRunner, 1);
    await deliverVerdictWhenWaiting(runPath, 'WK001', { decision: 'BLOCK', summary: 'still broken' });

    const state = await statePromise;

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toBe('pre_pr_review_max_loops');
    expect(storyRunner.resumeRequests).toHaveLength(1);

    const events = await readEvents(runPath);
    const blocked = events.find((event) => event.type === 'pre_pr_review_blocked');
    expect(blocked).toMatchObject({ reason: 'pre_pr_review_max_loops' });
  });

  it('yield -> no verdict within timeout, downgradeTo=none -> run blocked', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'awk-review-timeout-'));
    tempRoots.push(workspaceRoot);
    const runId = 'run-timeout';
    const config = configForWorkspace(workspaceRoot, { downgradeTo: 'none', childReviewWaitTimeoutMs: 50 });
    const source = new SnapshotStorySource([[story('specced')], [story('specced')]]);
    const storyRunner = new ScriptedStoryRunner([{ kind: 'yield' }]);
    const { runner, runPath } = makeRunner(runId, config, source, storyRunner);

    const state = await runner.runStory('WK001');

    expect(state.status).toBe('blocked');
    expect(state.blockedReason).toBe('pre_pr_review_timeout');
    expect(storyRunner.resumeRequests).toHaveLength(0);

    const events = await readEvents(runPath);
    const blocked = events.find((event) => event.type === 'pre_pr_review_blocked');
    expect(blocked).toMatchObject({ reason: 'pre_pr_review_timeout' });
  });

  it('yield -> timeout, downgradeTo=inline -> resumes with downgrade instruction and settles', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'awk-review-downgrade-'));
    tempRoots.push(workspaceRoot);
    const runId = 'run-downgrade';
    const config = configForWorkspace(workspaceRoot, { downgradeTo: 'inline', childReviewWaitTimeoutMs: 50 });
    const source = new SnapshotStorySource([[story('specced')], [story('done')]]);
    const storyRunner = new ScriptedStoryRunner([{ kind: 'yield' }, { kind: 'settle' }]);
    const { runner, runPath } = makeRunner(runId, config, source, storyRunner);

    const state = await runner.runStory('WK001');

    expect(state.status).toBe('complete');
    expect(state.blockedStoryId).toBeNull();
    expect(storyRunner.resumeRequests).toHaveLength(1);
    expect(storyRunner.resumeRequests[0]?.message.toLowerCase()).toContain('inline');

    const events = await readEvents(runPath);
    expect(eventTypes(events)).toContain('pre_pr_review_downgraded');
  });

  it('abort during awaiting_review -> run settles ok:false without hanging', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'awk-review-abort-'));
    tempRoots.push(workspaceRoot);
    const runId = 'run-abort';
    const config = configForWorkspace(workspaceRoot, { childReviewWaitTimeoutMs: 5_000 });
    const source = new SnapshotStorySource([[story('specced')], [story('specced')]]);
    const storyRunner = new ScriptedStoryRunner([{ kind: 'yield' }]);
    const { runner, runPath } = makeRunner(runId, config, source, storyRunner);

    const statePromise = runner.runStory('WK001');
    await waitForLaunchStatus(runPath, 'WK001', 'awaiting_review');
    // Abort the child mid-review via its controller (the same signal awaitVerdict watches).
    abortActiveChild(runner, 'WK001');

    const state = await statePromise;

    expect(state.status === 'aborted' || state.status === 'blocked').toBe(true);
    expect(storyRunner.resumeRequests).toHaveLength(0);
    const events = await readEvents(runPath);
    expect(eventTypes(events)).toContain('pre_pr_review_requested');
  });

  it('non-orchestrator mode behaves as a single-shot run (regression guard)', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'awk-review-single-'));
    tempRoots.push(workspaceRoot);
    const runId = 'run-single';
    const config = configForWorkspace(workspaceRoot, { mode: 'auto' });
    const source = new SnapshotStorySource([[story('specced')], [story('done')]]);
    const storyRunner = new CompletingStoryRunner();
    const { runner } = makeRunner(runId, config, source, storyRunner);

    const state = await runner.runStory('WK001');

    expect(state.status).toBe('complete');
    expect(storyRunner.runRequests).toHaveLength(1);
    expect(storyRunner.resumeCalls).toBe(0);
  });
});

/**
 * Polls the child launch record until it enters `awaiting_review`, then delivers the verdict
 * via the in-process inbox. Keeps the test deterministic without coupling to internal timing.
 */
async function deliverVerdictWhenWaiting(runPath: string, storyId: string, verdict: ReviewVerdict): Promise<void> {
  const artifactPath = path.join(runPath, 'children', `${storyId}.verdict.json`);
  // Ensure any prior verdict artifact has been consumed (cleared by the supervisor) so this
  // delivery is observed for the current loop, not a stale one.
  await waitForFileAbsent(artifactPath);
  await waitForLaunchStatus(runPath, storyId, 'awaiting_review');
  // Durable route: write the verdict artifact (awaitVerdict polls/watches for it).
  await writeFile(artifactPath, JSON.stringify(verdict), 'utf8');
  // Belt-and-braces: also wake any in-process waiter immediately.
  notifyVerdict(runPath, storyId, verdict);
}

async function waitForLaunchStatus(runPath: string, storyId: string, status: string): Promise<void> {
  const launchPath = path.join(runPath, 'children', `${storyId}.launch.json`);
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    try {
      const record = (await readJson(launchPath)) as { status?: string };
      if (record.status === status) return;
    } catch {
      // launch record not written yet
    }
    await delay(5);
  }
  throw new Error(`timed out waiting for launch status ${status}`);
}

async function waitForFileAbsent(filePath: string): Promise<void> {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    try {
      await readFile(filePath, 'utf8');
    } catch {
      return; // file does not exist
    }
    await delay(5);
  }
  throw new Error(`timed out waiting for ${filePath} to be absent`);
}

async function waitForResumeCount(storyRunner: ScriptedStoryRunner, count: number): Promise<void> {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    if (storyRunner.resumeRequests.length >= count) return;
    await delay(5);
  }
  throw new Error(`timed out waiting for ${count} resume(s)`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Aborts the live child's AbortController. The supervisor passes that same signal to
 * `awaitVerdict`, so aborting it drives the `settleAbortDuringReview` path. Reaches the
 * private controllers map via cast - acceptable in tests, and the realistic production
 * trigger (budget/operator abort) aborts the very same controllers.
 */
function abortActiveChild(runner: WorkflowRunner, storyId: string): void {
  const controllers = (runner as unknown as { activeChildAbortControllers: Map<string, AbortController> })
    .activeChildAbortControllers;
  const controller = controllers.get(storyId);
  if (!controller) throw new Error(`no active child controller for ${storyId}`);
  controller.abort(new Error('operator abort'));
}
