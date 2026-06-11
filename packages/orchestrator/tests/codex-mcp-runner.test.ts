import { describe, expect, it } from 'vitest';
import { CodexMcpStoryRunner } from '../src/drivers/codex-mcp/CodexMcpStoryRunner';
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
      childMaxRuntimeMs: 7_200_000,
    },
    codex: { childSession: { cwdAbs: '/repo' } },
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

  constructor(
    private readonly behavior: {
      connect?: () => Promise<void>;
      callTool?: () => Promise<unknown>;
      listTools?: () => Promise<unknown>;
    },
  ) {}

  async connect(): Promise<void> {
    this.connectCalls += 1;
    await this.behavior.connect?.();
  }

  async callTool(): Promise<unknown> {
    this.callToolCalls += 1;
    return await this.behavior.callTool?.();
  }

  async listTools(): Promise<unknown> {
    return await this.behavior.listTools?.();
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

const validResult = {
  structuredContent: {
    threadId: 'thread-a001',
    content: 'done',
  },
};

describe('CodexMcpStoryRunner', () => {
  it('retries transient connection errors and then succeeds', async () => {
    const clients = [
      new FakeClient({
        connect: async () => {
          throw new Error('connect failed');
        },
      }),
      new FakeClient({ callTool: async () => validResult }),
    ];
    let index = 0;
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 1,
      createClient: () => ({ client: clients[index++] as never, transport: {} as never }),
    });

    const result = await runner.runStory({ story: story(), prompt: 'prompt', cwd: '/repo', metadata: {} });

    expect(result.sessionId).toBe('thread-a001');
    expect(index).toBe(2);
    expect(clients.every((client) => client.closed)).toBe(true);
  });

  it('retries a startup timeout and then succeeds', async () => {
    const clients = [
      new FakeClient({
        connect: async () => {
          throw new Error('Codex MCP startup timed out');
        },
      }),
      new FakeClient({ callTool: async () => validResult }),
    ];
    let index = 0;
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 1,
      createClient: () => ({ client: clients[index++] as never, transport: {} as never }),
    });

    const result = await runner.runStory({ story: story(), prompt: 'prompt', cwd: '/repo', metadata: {} });

    expect(result.sessionId).toBe('thread-a001');
    expect(index).toBe(2);
    expect(clients.every((client) => client.closed)).toBe(true);
  });

  it('does not retry validation errors and closes the client', async () => {
    const client = new FakeClient({ callTool: async () => ({}) });
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 2,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await expect(runner.runStory({ story: story(), prompt: 'prompt', cwd: '/repo', metadata: {} })).rejects.toThrow(
      'Codex MCP result missing structuredContent',
    );
    expect(client.callToolCalls).toBe(1);
    expect(client.closed).toBe(true);
  });

  it('closes the client when the operation throws', async () => {
    const client = new FakeClient({
      callTool: async () => {
        throw new Error('tool exploded');
      },
    });
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await expect(runner.runStory({ story: story(), prompt: 'prompt', cwd: '/repo', metadata: {} })).rejects.toThrow(
      'tool exploded',
    );
    expect(client.closed).toBe(true);
  });

  it('rejects when a request exceeds the injected timeout', async () => {
    const client = new FakeClient({ callTool: async () => await new Promise(() => undefined) });
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      requestTimeoutMs: 5,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await expect(runner.runStory({ story: story(), prompt: 'prompt', cwd: '/repo', metadata: {} })).rejects.toThrow(
      'Codex MCP request timed out',
    );
    expect(client.closed).toBe(true);
  });

  it('does not retry a request timeout', async () => {
    const client = new FakeClient({ callTool: async () => await new Promise(() => undefined) });
    let createClientCalls = 0;
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 2,
      requestTimeoutMs: 5,
      createClient: () => {
        createClientCalls += 1;
        return { client: client as never, transport: {} as never };
      },
    });

    await expect(runner.runStory({ story: story(), prompt: 'prompt', cwd: '/repo', metadata: {} })).rejects.toThrow(
      'Codex MCP request timed out',
    );
    expect(createClientCalls).toBe(1);
    expect(client.callToolCalls).toBe(1);
    expect(client.closed).toBe(true);
  });

  it('caps total wait at childMaxRuntimeMs when it is smaller than requestTimeoutMs', async () => {
    const client = new FakeClient({ callTool: async () => await new Promise(() => undefined) });
    // requestTimeoutMs = 60_000, childMaxRuntimeMs = 5 -> total cap should be 5ms.
    const cfg = { ...config(), orchestrator: { ...config().orchestrator, childMaxRuntimeMs: 5 } };
    const runner = new CodexMcpStoryRunner(cfg, {
      retries: 0,
      requestTimeoutMs: 60_000,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await expect(runner.runStory({ story: story(), prompt: 'prompt', cwd: '/repo', metadata: {} })).rejects.toThrow(
      'Codex MCP request timed out',
    );
    expect(client.closed).toBe(true);
  });

  it('does not retry a missing codex binary', async () => {
    let createClientCalls = 0;
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 2,
      createClient: () => {
        createClientCalls += 1;
        return {
          client: new FakeClient({
            connect: async () => {
              throw new Error('spawn codex ENOENT');
            },
          }) as never,
          transport: {} as never,
        };
      },
    });

    await expect(runner.runStory({ story: story(), prompt: 'prompt', cwd: '/repo', metadata: {} })).rejects.toThrow(
      /ENOENT/,
    );
    expect(createClientCalls).toBe(1);
  });
});
