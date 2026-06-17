import { describe, expect, it } from 'vitest';
import { resolveCwdOnlyConfig } from '../src/config/configLoader';
import { CodexMcpStoryRunner } from '../src/drivers/codex-mcp/CodexMcpStoryRunner';
import type { ChildControlRequest, StoryRunRequest } from '../src/drivers/StoryRunner';
import type { ResolvedWorkflowConfig, WorkflowStory } from '../src/types';

function config(): ResolvedWorkflowConfig {
  return {
    version: '0.7.0',
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
  callToolOptions: unknown[] = [];
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

  async callTool(_request?: unknown, _resultSchema?: unknown, options?: unknown): Promise<unknown> {
    this.callToolCalls += 1;
    this.callToolOptions.push(options);
    return await this.behavior.callTool?.(this, options);
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

function request(overrides: Partial<StoryRunRequest> = {}): StoryRunRequest {
  const cfg = config();
  const profile = cfg.agents.resolved.implementStory;
  return {
    story: story(),
    prompt: 'prompt',
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

describe('CodexMcpStoryRunner', () => {
  it('classifies Codex request timeouts as recoverable supervision loss', () => {
    const runner = new CodexMcpStoryRunner(config());

    expect(runner.classifyError(new Error('Codex MCP request timed out'))).toEqual({
      supervisionLost: true,
      recoverable: true,
    });
    expect(runner.classifyError(new Error('validation failed'))).toEqual({
      supervisionLost: false,
      recoverable: false,
    });
  });

  it('describes Codex structured-output downgrade through the driver contract', () => {
    const runner = new CodexMcpStoryRunner(config());
    const profile = config().agents.resolved.implementStory;

    expect(
      runner.describeCapabilityDowngrades({
        template: profile.prompt.template,
        promptHash: 'hash-a001',
        structuredOutputSchema: profile.structuredOutput.schema,
        structuredOutputRequired: true,
      }),
    ).toEqual([
      {
        capability: 'structured-output-enforcement',
        reason: 'Codex MCP V1 records structured-output intent but does not expose a stable schema-enforcement knob.',
        severity: 'warning',
        source: 'driver',
      },
    ]);
  });

  it('routes child control and abort through the StoryRunner control contract', async () => {
    const requests: ChildControlRequest[] = [];
    const runner = new CodexMcpStoryRunner(config(), {
      controlChild: async (controlRequest) => {
        requests.push(controlRequest);
        return {
          ok: true,
          tool: controlRequest.kind === 'reply' ? 'codex_reply' : 'codex_interrupt',
          sessionId: controlRequest.sessionId ?? 'thread-a001',
          storyId: controlRequest.storyId ?? null,
          runPath: controlRequest.runPath ?? null,
          rawResult: {},
        };
      },
    });

    await expect(
      runner.controlChild({ kind: 'reply', sessionId: 'thread-a001', message: 'continue' }),
    ).resolves.toMatchObject({ tool: 'codex_reply', sessionId: 'thread-a001' });
    await expect(
      runner.abort({ kind: 'reply', sessionId: 'thread-a001', message: 'ignored', reason: 'stop' }),
    ).resolves.toMatchObject({ tool: 'codex_interrupt', sessionId: 'thread-a001' });

    expect(requests).toEqual([
      { kind: 'reply', sessionId: 'thread-a001', message: 'continue' },
      { kind: 'interrupt', sessionId: 'thread-a001', message: 'ignored', reason: 'stop' },
    ]);
  });

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

    const result = await runner.runStory(request());

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

    const result = await runner.runStory(request());

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

    await expect(runner.runStory(request())).rejects.toThrow('Codex MCP result missing structuredContent');
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

    await expect(runner.runStory(request())).rejects.toThrow('tool exploded');
    expect(client.closed).toBe(true);
  });

  it('rejects when a request exceeds the injected timeout', async () => {
    const client = new FakeClient({ callTool: async () => await new Promise(() => undefined) });
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      requestTimeoutMs: 5,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await expect(runner.runStory(request())).rejects.toThrow('Codex MCP request timed out');
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

    await expect(runner.runStory(request())).rejects.toThrow('Codex MCP request timed out');
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

    await expect(runner.runStory(request())).rejects.toThrow('Codex MCP request timed out');
    expect(client.closed).toBe(true);
  });

  it('uses childMaxRuntimeMs for the default SDK request timeout', async () => {
    const client = new FakeClient({ callTool: async () => validResult });
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await runner.runStory(request());

    expect(client.callToolOptions[0]).toMatchObject({
      timeout: 7_200_000,
      maxTotalTimeout: 7_200_000,
      resetTimeoutOnProgress: true,
    });
  });

  it('passes resolved profile metadata to Codex and returns structured-output downgrade evidence', async () => {
    const client = new FakeClient({ callTool: async () => validResult });
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });
    const profile = config().agents.resolved.implementStory;
    const result = await runner.runStory({
      story: story(),
      prompt: 'prompt',
      cwd: '/repo',
      metadata: {},
      profile,
      promptMetadata: {
        template: profile.prompt.template,
        promptHash: 'hash-a001',
        structuredOutputSchema: profile.structuredOutput.schema,
        structuredOutputRequired: profile.structuredOutput.required,
      },
    });

    expect(result.invocation.config).not.toHaveProperty('workflowkit_profile');
    expect(result.invocation.config).not.toHaveProperty('workflowkit_structured_output');
    expect(result.evidence).toMatchObject({
      profile: { name: 'storyImplementer', taskType: 'implementStory' },
      prompt: { template: 'built-in/story-implementer', hash: 'hash-a001' },
      structuredOutput: { schema: 'built-in/child-run-result', required: true, enforced: false },
      capabilityDowngrades: [
        {
          capability: 'structured-output-enforcement',
          source: 'driver',
          severity: 'warning',
        },
      ],
    });
  });

  it('passes the child abort signal to the MCP tool request', async () => {
    const controller = new AbortController();
    const client = new FakeClient({ callTool: async () => validResult });
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await runner.runStory(request({ signal: controller.signal }));

    expect(client.callToolOptions[0]).toMatchObject({
      signal: controller.signal,
    });
  });

  it('persists session linkage from progress before the final tool result returns', async () => {
    const client = new FakeClient({
      callTool: async (_client, options) => {
        (options as { onprogress?: (value: unknown) => void }).onprogress?.({
          threadId: 'thread-progress',
          message: 'thread created',
        });
        return validResult;
      },
    });
    const lifecycle: unknown[] = [];
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    const result = await runner.runStory({
      ...request(),
      onLifecycle: async (event) => {
        lifecycle.push(event);
      },
    });

    expect(result.sessionId).toBe('thread-a001');
    expect(lifecycle).toContainEqual({
      type: 'session-linked',
      sessionId: 'thread-progress',
      sessionLogPath: null,
      progressSource: 'mcp-progress',
    });
  });

  it('links and reports liveness from codex event notifications before final output', async () => {
    const client = new FakeClient({
      callTool: async (fake) => {
        await fake.fallbackNotificationHandler?.({
          method: 'codex/event',
          params: {
            _meta: { requestId: 'req-foreign', threadId: 'thread-foreign' },
            msg: { type: 'session_configured', rollout_path: '/sessions/thread-foreign.jsonl', cwd: '/other-repo' },
          },
        });
        await fake.fallbackNotificationHandler?.({
          method: 'codex/event',
          params: {
            _meta: { requestId: 'req-1', threadId: 'thread-event' },
            msg: { type: 'session_configured', rollout_path: '/sessions/thread-event.jsonl', cwd: '/repo' },
          },
        });
        await fake.fallbackNotificationHandler?.({
          method: 'codex/event',
          params: { _meta: { requestId: 'req-1', threadId: 'thread-event' }, msg: { type: 'exec_command_begin' } },
        });
        await fake.fallbackNotificationHandler?.({
          method: 'codex/event',
          params: { _meta: { requestId: 'req-1', threadId: 'thread-event' }, msg: { type: 'token_count' } },
        });
        await fake.fallbackNotificationHandler?.({
          method: 'codex/event',
          params: { _meta: { requestId: 'req-1', threadId: 'other-thread' }, msg: { type: 'exec_command_end' } },
        });
        await fake.fallbackNotificationHandler?.({
          method: 'codex/event',
          params: { _meta: { requestId: 'req-2', threadId: 'thread-event' }, msg: { type: 'exec_command_end' } },
        });
        return validResult;
      },
    });
    const lifecycle: unknown[] = [];
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await runner.runStory({
      ...request(),
      onLifecycle: async (event) => {
        lifecycle.push(event);
      },
    });

    expect(lifecycle).toContainEqual({
      type: 'session-linked',
      sessionId: 'thread-event',
      sessionLogPath: '/sessions/thread-event.jsonl',
      progressSource: 'codex-event',
    });
    expect(lifecycle).not.toContainEqual(
      expect.objectContaining({
        type: 'session-linked',
        sessionId: 'thread-foreign',
      }),
    );
    expect(lifecycle).toContainEqual({
      type: 'progress',
      message: 'codex event: exec_command_begin',
      progressSource: 'codex-event',
      eventType: 'exec_command_begin',
      journal: true,
    });
    expect(lifecycle).toContainEqual({
      type: 'progress',
      message: 'codex event: token_count',
      progressSource: 'codex-event',
      eventType: 'token_count',
      journal: false,
    });
    expect(lifecycle).not.toContainEqual(
      expect.objectContaining({
        message: 'codex event: exec_command_end',
        eventType: 'exec_command_end',
      }),
    );
  });

  it('keeps standard mcp progress as mcp-progress', async () => {
    const client = new FakeClient({
      callTool: async (_fake, options) => {
        (options as { onprogress?: (value: unknown) => void }).onprogress?.({
          progressToken: 'token-1',
          message: 'standard progress',
        });
        return validResult;
      },
    });
    const lifecycle: unknown[] = [];
    const runner = new CodexMcpStoryRunner(config(), {
      retries: 0,
      createClient: () => ({ client: client as never, transport: {} as never }),
    });

    await runner.runStory({
      ...request(),
      onLifecycle: async (event) => {
        lifecycle.push(event);
      },
    });

    expect(lifecycle).toContainEqual({
      type: 'progress',
      message: 'standard progress',
      progressToken: 'token-1',
      progressSource: 'mcp-progress',
    });
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

    await expect(runner.runStory(request())).rejects.toThrow(/ENOENT/);
    expect(createClientCalls).toBe(1);
  });
});
