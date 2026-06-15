import { describe, expect, it } from 'vitest';
import type { StoryRunner, StoryRunRequest, StoryRunResult } from '../packages/orchestrator/src/drivers/StoryRunner.js';
import type { GitInspector } from '../packages/orchestrator/src/git/GitInspector.js';
import { WorkflowRunner } from '../packages/orchestrator/src/runner/WorkflowRunner.js';
import type {
  ArtifactStore,
  Clock,
  Logger,
  ResolvedWorkflowConfig,
  StorySource,
  WorkflowStory,
} from '../packages/orchestrator/src/types.js';

describe('workflow runner tracker refresh tolerance', () => {
  it('blocks when an in-run tracker refresh throws instead of rejecting the run', async () => {
    const storySource = new ThrowOnSecondListStorySource();
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: config(),
      storySource,
      storyRunner: new SuccessfulStoryRunner(),
      gitInspector: {
        inspectStory: async () => ({
          committed: true,
          branch: 'track/awk01-example',
          isBaseBranch: false,
          headSha: 'head',
          baseSha: 'base',
          uncommittedChanges: false,
          uncommittedPaths: [],
          mergedPullRequest: null,
        }),
      } satisfies GitInspector,
      artifactStore: new MemoryArtifactStore(),
      logger: { info() {}, warn() {}, error() {} } satisfies Logger,
      clock: fixedClock(),
      runId: 'run-1',
      childWorkspacePreparer: async () => ({
        childCwdAbs: '/repo',
        expectedBranch: 'track/awk01-example',
        expectedWorktreePath: null,
        prepared: false,
      }),
    });

    await expect(runner.runStory('AWK01')).resolves.toMatchObject({
      status: 'blocked',
      blockedStoryId: 'AWK01',
      blockedReason: 'tracker refresh failed: malformed tracker row',
    });
  });
});

class ThrowOnSecondListStorySource implements StorySource {
  calls = 0;

  async listStories(): Promise<WorkflowStory[]> {
    this.calls += 1;
    if (this.calls > 1) throw new Error('malformed tracker row');
    return [story()];
  }
}

class SuccessfulStoryRunner implements StoryRunner {
  async runStory(_request: StoryRunRequest): Promise<StoryRunResult> {
    return {
      storyId: 'AWK01',
      sessionId: 'session-1',
      content: 'done',
      rawResult: {},
      invocation: {},
    };
  }

  async checkTools() {
    return { ok: true, tools: [] };
  }
}

class MemoryArtifactStore implements ArtifactStore {
  async writeJson(): Promise<void> {}
  async writeText(): Promise<void> {}
  async appendEvent(): Promise<void> {}
}

function story(): WorkflowStory {
  return {
    id: 'AWK01',
    title: 'Example',
    status: 'specced',
    owner: null,
    dependencies: [],
    eligible: true,
    blockedReason: null,
    metadata: {
      trackId: 'track',
      trackTitle: 'Track',
      trackerPath: 'docs/tracks/track/README.md',
      order: 1,
      wave: 'W1',
      spec: '—',
      plan: '—',
      pr: '—',
    },
  };
}

function fixedClock(): Clock {
  return {
    now: () => '2026-06-14T10:00:00.000Z',
    nowMs: () => 0,
  };
}

function config(): ResolvedWorkflowConfig {
  return {
    workspace: { rootAbs: '/repo' },
    artifacts: { runsDirAbs: '/repo/.codex/agentic-workflow-kit/runs' },
    statuses: {
      eligible: ['specced', 'plan-approved'],
      inProgress: 'implementing',
      complete: ['done', 'verified'],
    },
    tracker: { idPattern: '^[A-Z]{2,}[0-9]+$' },
    git: {
      strategy: 'worktree',
      branchPattern: '{track}/{id-lc}-{slug}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    },
    pr: {
      create: false,
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
        prePr: { enabled: true, mode: 'inline', maxLoops: 2, loopMode: 'incremental' },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: false, maxParallel: 0, allowWorkers: false },
    },
    orchestrator: {
      maxParallel: 1,
      stopLaunchingOnBlocked: true,
      childStartupTimeoutMs: 1000,
      childNoProgressTimeoutMs: 1000,
      childMaxRuntimeMs: 10000,
    },
    agents: {
      resolved: {
        implementStory: {
          name: 'storyImplementer',
          taskType: 'implementStory',
          driver: 'codex-mcp',
          prompt: { template: 'built-in/story-implementer', variables: {} },
          structuredOutput: { schema: 'built-in/child-run-result', required: true },
          budget: {},
        },
      },
    },
    childSession: { cwdAbs: '/repo', speed: 'derive' },
  } as ResolvedWorkflowConfig;
}
