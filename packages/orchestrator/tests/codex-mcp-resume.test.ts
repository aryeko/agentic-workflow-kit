import { describe, expect, it } from 'vitest';
import { resolveCwdOnlyConfig } from '../src/config/configLoader';
import { CodexMcpStoryRunner } from '../src/drivers/codex-mcp/CodexMcpStoryRunner';
import type { ResumeStoryRequest } from '../src/drivers/StoryRunner';
import type { ResolvedWorkflowConfig, WorkflowStory } from '../src/types';

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
    statuses: { eligible: ['specced'], inProgress: 'implementing', complete: ['done'] },
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
        prePr: { enabled: true, mode: 'auto', maxLoops: 2, loopMode: 'incremental', downgradeTo: 'none' },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
    },
    agents: resolveCwdOnlyConfig('/repo').agents,
    orchestrator: {
      driver: 'codex-mcp',
      maxParallel: 2,
      stopLaunchingOnBlocked: true,
      watch: { enabled: false, wait: false, intervalMs: 300_000, timeoutMs: 300_000 },
      childTimeoutMs: 1_800_000,
      childNoProgressTimeoutMs: 1_800_000,
      childStartupTimeoutMs: 60_000,
      childMaxRuntimeMs: 7_200_000,
      childReviewWaitTimeoutMs: 1_800_000,
    },
    childSession: { cwdAbs: '/repo', speed: 'derive' },
    codex: { childSession: { cwdAbs: '/repo', speed: 'derive' } },
  };
}

function story(): WorkflowStory {
  return {
    id: 'A001',
    title: 'A001',
    status: 'specced',
    owner: null,
    dependencies: [],
    eligible: true,
    blockedReason: null,
    metadata: { trackId: 't', trackTitle: 'T', trackerPath: 'docs/tracks/t/README.md', order: 1 },
  };
}

class FakeClient {
  closed = false;
  connectCalls = 0;
  callToolCalls = 0;
  callToolRequests: Array<{ name: string; arguments?: Record<string, unknown> }> = [];
  callToolOptions: unknown[] = [];
  listToolsCalls = 0;
  fallbackNotificationHandler?: (notification: unknown) => Promise<void> | void;

  constructor(
    private readonly behavior: {
      connect?: () => Promise<void>;
      callTool?: (client: FakeClient, options?: unknown) => Promise<unknown>;
      listTools?: () => Promise<unknown>;
    },
  ) {}

  async connect(): Promise<void> {
    this.connectCalls += 1;
    await this.behavior.connect?.();
  }

  async callTool(
    request: { name: string; arguments?: Record<string, unknown> },
    _resultSchema?: unknown,
    options?: unknown,
  ): Promise<unknown> {
    this.callToolCalls += 1;
    this.callToolRequests.push(request);
    this.callToolOptions.push(options);
    return await this.behavior.callTool?.(this, options);
  }

  async listTools(): Promise<unknown> {
    this.listToolsCalls += 1;
    return await this.behavior.listTools?.();
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

const resumeResult = {
  structuredContent: {
    threadId: 'thread-a001',
    content: 'resumed and done',
  },
};

function resumeRequest(overrides: Partial<ResumeStoryRequest> = {}): ResumeStoryRequest {
  const cfg = config();
  const profile = cfg.agents.resolved.implementStory;
  return {
    sessionId: 'thread-a001',
    message: 'Review verdict: PASS',
    story: story(),
    cwd: '/repo',
    metadata: {},
    profile,
    promptMetadata: {
      template: profile.prompt.template,
      promptHash: 'hash-a001',
      structuredOutputSchema: profile.structuredOutput.schema,
      structuredOutputRequired: profile.structuredOutput.required,
    },
    ...overrides,
  };
}

describe('CodexMcpStoryRunner.resumeStory', () => {
  it('resumes the codex thread via the discovered reply tool and returns a StoryRunResult', async () => {
    const client = new FakeClient({
      listTools: async () => ({ tools: [{ name: 'codex_reply' }] }),
      callTool: async () => resumeResult,
    });
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    const result = await runner.resumeStory(resumeRequest());

    expect(result.storyId).toBe('A001');
    expect(result.sessionId).toBe('thread-a001');
    expect(result.content).toBe('resumed and done');
    expect(client.callToolRequests).toEqual([
      {
        name: 'codex_reply',
        arguments: { threadId: 'thread-a001', sessionId: 'thread-a001', message: 'Review verdict: PASS' },
      },
    ]);
    expect(client.closed).toBe(true);
  });

  it('picks the first available reply tool candidate', async () => {
    const client = new FakeClient({
      listTools: async () => ({ tools: [{ name: 'something-else' }, { name: 'codex_continue' }] }),
      callTool: async () => resumeResult,
    });
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await runner.resumeStory(resumeRequest());

    expect(client.callToolRequests[0]?.name).toBe('codex_continue');
  });

  it('reports progress lifecycle events during the resumed turn', async () => {
    const client = new FakeClient({
      listTools: async () => ({ tools: [{ name: 'codex_reply' }] }),
      callTool: async (_fake, options) => {
        (options as { onprogress?: (value: unknown) => void }).onprogress?.({
          threadId: 'thread-a001',
          message: 'resuming',
        });
        return resumeResult;
      },
    });
    const lifecycle: unknown[] = [];
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await runner.resumeStory({
      ...resumeRequest(),
      onLifecycle: async (event) => {
        lifecycle.push(event);
      },
    });

    expect(lifecycle).toContainEqual({
      type: 'progress',
      message: 'resuming',
      progressToken: null,
      progressSource: 'mcp-progress',
    });
  });

  it('throws when no reply tool is available', async () => {
    const client = new FakeClient({
      listTools: async () => ({ tools: [{ name: 'codex' }] }),
      callTool: async () => resumeResult,
    });
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await expect(runner.resumeStory(resumeRequest())).rejects.toThrow(/reply tool/i);
    expect(client.callToolCalls).toBe(0);
    expect(client.closed).toBe(true);
  });
});
