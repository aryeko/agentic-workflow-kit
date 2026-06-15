import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileArtifactStore } from '../src/artifacts/FileArtifactStore';
import { resolveCwdOnlyConfig } from '../src/config/configLoader';
import type { StoryRunner, StoryRunRequest, StoryRunResult } from '../src/drivers/StoryRunner';
import type { GitInspector, StoryCommitEvidence } from '../src/git/GitInspector';
import { renderExpectedBranch, renderExpectedWorktreePath } from '../src/runner/launchMetadata';
import { WorkflowRunner } from '../src/runner/WorkflowRunner';
import type { Clock, Logger, ResolvedWorkflowConfig, StorySource, WorkflowStory } from '../src/types';

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

class CompletingStoryRunner implements StoryRunner {
  requests: StoryRunRequest[] = [];

  async runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    this.requests.push(request);
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

describe('WorkflowRunner story-run e2e artifacts', () => {
  it('runs one story through real journal, completion gate, and file artifacts', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'awk-story-run-e2e-'));
    tempRoots.push(workspaceRoot);
    const runId = 'run-e2e';
    const runPath = path.join(workspaceRoot, '.codex/agentic-workflow-kit/runs', runId);
    const config = configForWorkspace(workspaceRoot);
    const source = new SnapshotStorySource([[story('specced')], [story('done')]]);
    const storyRunner = new CompletingStoryRunner();

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

    const state = await runner.runStory('WK001');

    expect(state).toMatchObject({
      runId,
      command: 'run-story',
      status: 'complete',
      active: [],
      blockedStoryId: null,
      blockedReason: null,
    });
    expect(state.completed).toMatchObject([
      {
        storyId: 'WK001',
        ok: true,
        sessionId: 'thread-wk001',
        returnedStatus: 'done',
        returnedComplete: true,
      },
    ]);
    expect(storyRunner.requests).toHaveLength(1);
    expect(storyRunner.requests[0]?.metadata).toMatchObject({ runId });

    await expect(readJson(path.join(runPath, 'state.json'))).resolves.toMatchObject({
      status: 'complete',
      completed: [{ storyId: 'WK001', ok: true }],
    });
    await expect(readJson(path.join(runPath, 'summary.json'))).resolves.toMatchObject({
      schemaVersion: 1,
      runId,
      status: 'complete',
      completedStoryIds: ['WK001'],
      artifactPaths: {
        state: 'state.json',
        summary: 'summary.json',
        rows: 'rows.json',
      },
    });
    await expect(readJson(path.join(runPath, 'rows.json'))).resolves.toMatchObject({
      schemaVersion: 1,
      rows: [{ storyId: 'WK001', status: 'completed' }],
    });
    await expect(readJson(path.join(runPath, 'children/WK001.launch.json'))).resolves.toMatchObject({
      runId,
      storyId: 'WK001',
      status: 'settled',
      sessionId: 'thread-wk001',
      baseShaAtLaunch: 'base-sha',
    });
    await expect(readJson(path.join(runPath, 'children/WK001.json'))).resolves.toMatchObject({
      storyId: 'WK001',
      ok: true,
      sessionId: 'thread-wk001',
      returnedStatus: 'done',
      returnedComplete: true,
      commitEvidence: {
        committed: true,
        branch: 'sample/wk001-run-the-story',
      },
    });
  });
});

function configForWorkspace(workspaceRoot: string): ResolvedWorkflowConfig {
  const base = resolveCwdOnlyConfig(workspaceRoot);
  return {
    ...base,
    pr: {
      ...base.pr,
      create: false,
      merge: { ...base.pr.merge, auto: false },
    },
    orchestrator: {
      ...base.orchestrator,
      maxParallel: 1,
      childNoProgressTimeoutMs: 1_000,
      childStartupTimeoutMs: 1_000,
      childMaxRuntimeMs: 1_000,
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

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}
