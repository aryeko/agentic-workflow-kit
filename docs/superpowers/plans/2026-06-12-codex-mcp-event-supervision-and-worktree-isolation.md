# Codex MCP Event Supervision And Worktree Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Codex MCP driver supervise live child sessions through `codex/event` notifications and launch worktree-strategy children inside parent-prepared story worktrees.

**Architecture:** Add a Codex-specific event parser at the driver boundary, propagate explicit child progress sources through the story runner lifecycle, and keep `WorkflowRunner` responsible for conservative startup/no-progress state transitions. Add an injectable child workspace preparer so git worktree side effects are isolated, testable, and performed before the Codex tool call receives its `cwd`.

**Tech Stack:** TypeScript, Vitest, `@modelcontextprotocol/sdk`, Node `child_process`, Git worktrees, existing workflow-kit runner/journal/analyzer APIs.

---

## File Structure

- Create `packages/orchestrator/src/drivers/codex-mcp/codexEvents.ts`: parse unknown MCP notifications into a defensive Codex event shape.
- Modify `packages/orchestrator/src/drivers/StoryRunner.ts`: add `ChildProgressSource` and carry `progressSource` / `eventType` through lifecycle events.
- Modify `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts`: install the SDK fallback notification hook, correlate `codex/event` notifications, emit lifecycle events, and keep final `structuredContent.threadId` validation.
- Create `packages/orchestrator/src/runner/ChildWorkspacePreparer.ts`: prepare or verify story worktrees before child launch.
- Modify `packages/orchestrator/src/runner/WorkflowRunner.ts`: call the preparer, pass prepared cwd to the driver, persist progress source/session metadata, and keep parent polls separate from child liveness.
- Modify `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts`: accept a launch cwd, compute writable roots from the workspace root, and change the worktree prompt to parent-prepared semantics.
- Modify `packages/orchestrator/src/analysis/runAnalyzer.ts`: display `codex-event` as real child progress without regressing legacy recovery evidence.
- Modify docs and plugin fixture files: `docs/architecture.md`, `references/config-schema.md`, `plugins/agentic-workflow-kit/references/config-schema.md`, `plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md`, and any mirrored fixture files required by tests.
- Tests: add `packages/orchestrator/tests/codex-mcp-events.test.ts` and `packages/orchestrator/tests/child-workspace-preparer.test.ts`; extend `codex-mcp-runner.test.ts`, `runner.test.ts`, `tool-input.test.ts`, and `analysis.test.ts`.

## Task 1: Codex Event Parser

**Files:**
- Create: `packages/orchestrator/src/drivers/codex-mcp/codexEvents.ts`
- Create: `packages/orchestrator/tests/codex-mcp-events.test.ts`

- [ ] **Step 1: Write parser tests**

Add these tests:

```ts
import { describe, expect, it } from 'vitest';
import { parseCodexEventNotification } from '../src/drivers/codex-mcp/codexEvents';

describe('parseCodexEventNotification', () => {
  it('returns null for non codex event notifications', () => {
    expect(parseCodexEventNotification({ jsonrpc: '2.0', method: 'notifications/progress', params: {} })).toBeNull();
    expect(parseCodexEventNotification({ method: 'codex/other', params: {} })).toBeNull();
    expect(parseCodexEventNotification(null)).toBeNull();
  });

  it('extracts session linkage fields from session_configured', () => {
    const parsed = parseCodexEventNotification({
      jsonrpc: '2.0',
      method: 'codex/event',
      params: {
        _meta: { requestId: 'req-1', threadId: 'thread-meta' },
        msg: {
          type: 'session_configured',
          thread_id: 'thread-msg',
          session_id: 'session-msg',
          rollout_path: '/Users/me/.codex/sessions/run.jsonl',
          cwd: '/repo/.worktrees/a001-story',
        },
      },
    });

    expect(parsed).toMatchObject({
      method: 'codex/event',
      requestId: 'req-1',
      threadId: 'thread-meta',
      sessionId: 'session-msg',
      eventType: 'session_configured',
      sessionLogPath: '/Users/me/.codex/sessions/run.jsonl',
      cwd: '/repo/.worktrees/a001-story',
    });
  });

  it('falls back from meta thread id to message ids', () => {
    expect(
      parseCodexEventNotification({
        method: 'codex/event',
        params: { msg: { type: 'task_started', thread_id: 'thread-msg', session_id: 'session-msg' } },
      })?.threadId,
    ).toBe('thread-msg');

    expect(
      parseCodexEventNotification({
        method: 'codex/event',
        params: { msg: { type: 'task_started', session_id: 'session-msg' } },
      })?.threadId,
    ).toBe('session-msg');
  });

  it('tolerates malformed notifications without throwing', () => {
    expect(parseCodexEventNotification({ method: 'codex/event', params: { msg: 'bad' } })).toMatchObject({
      method: 'codex/event',
      requestId: null,
      threadId: null,
      sessionId: null,
      eventType: 'unknown',
      sessionLogPath: null,
      cwd: null,
    });
  });
});
```

- [ ] **Step 2: Run parser tests and verify they fail**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/codex-mcp-events.test.ts
```

Expected: fail because `codexEvents.ts` does not exist.

- [ ] **Step 3: Implement parser**

Create `codexEvents.ts`:

```ts
import { isRecord } from '../../internal/guards.js';

export interface CodexEventNotification {
  method: 'codex/event';
  requestId: string | number | null;
  threadId: string | null;
  eventType: string;
  sessionId: string | null;
  sessionLogPath: string | null;
  cwd: string | null;
  raw: Record<string, unknown>;
}

export function parseCodexEventNotification(value: unknown): CodexEventNotification | null {
  if (!isRecord(value) || value.method !== 'codex/event') return null;
  const params = isRecord(value.params) ? value.params : {};
  const meta = isRecord(params._meta) ? params._meta : {};
  const msg = isRecord(params.msg) ? params.msg : {};
  const metaThreadId = readString(meta.threadId);
  const msgThreadId = readString(msg.thread_id);
  const msgSessionId = readString(msg.session_id);

  return {
    method: 'codex/event',
    requestId: readString(meta.requestId) ?? readNumber(meta.requestId),
    threadId: metaThreadId ?? msgThreadId ?? msgSessionId,
    eventType: readString(msg.type) ?? 'unknown',
    sessionId: msgSessionId,
    sessionLogPath: readString(msg.rollout_path),
    cwd: readString(msg.cwd),
    raw: value,
  };
}

export function codexProgressMessage(event: CodexEventNotification): string {
  return event.eventType === 'unknown' ? 'codex event' : `codex event: ${event.eventType}`;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
```

- [ ] **Step 4: Run parser tests and verify they pass**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/codex-mcp-events.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit parser slice**

```bash
git add packages/orchestrator/src/drivers/codex-mcp/codexEvents.ts packages/orchestrator/tests/codex-mcp-events.test.ts
git commit -m "feat: parse codex mcp event notifications"
```

## Task 2: Driver Lifecycle Integration

**Files:**
- Modify: `packages/orchestrator/src/drivers/StoryRunner.ts`
- Modify: `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts`
- Modify: `packages/orchestrator/tests/codex-mcp-runner.test.ts`

- [ ] **Step 1: Write failing runner lifecycle tests**

Extend `FakeClient` in `codex-mcp-runner.test.ts` with a mutable fallback handler:

```ts
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
```

Add tests:

```ts
it('links and reports liveness from codex event notifications before final output', async () => {
  const client = new FakeClient({
    callTool: async (fake) => {
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
      return validResult;
    },
  });
  const lifecycle: unknown[] = [];
  const runner = new CodexMcpStoryRunner(config(), {
    retries: 0,
    createClient: () => ({ client: client as never, transport: {} as never }),
  });

  await runner.runStory({
    story: story(),
    prompt: 'prompt',
    cwd: '/repo',
    metadata: {},
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
  expect(lifecycle).toContainEqual({
    type: 'progress',
    message: 'codex event: exec_command_begin',
    progressSource: 'codex-event',
    eventType: 'exec_command_begin',
  });
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
    story: story(),
    prompt: 'prompt',
    cwd: '/repo',
    metadata: {},
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
```

- [ ] **Step 2: Run driver tests and verify they fail**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/codex-mcp-runner.test.ts
```

Expected: fail because lifecycle events do not expose `progressSource` and the driver does not install a fallback notification hook.

- [ ] **Step 3: Extend lifecycle event types**

Change `StoryRunner.ts`:

```ts
import type { ChildMetricsSnapshot, ChildResultEvidence, WorkflowStory } from '../types.js';

export type ChildProgressSource = 'codex-event' | 'mcp-progress' | 'session-linked' | 'structured';

export type ChildLifecycleEvent =
  | {
      type: 'session-linked';
      sessionId: string;
      sessionLogPath?: string | null;
      progressSource: ChildProgressSource;
    }
  | {
      type: 'progress';
      message: string;
      progressSource: ChildProgressSource;
      progressToken?: string | number | null;
      eventType?: string | null;
    };
```

- [ ] **Step 4: Install Codex notification handling in the driver**

In `CodexMcpStoryRunner.ts`, import the parser and widen the client type:

```ts
import { codexProgressMessage, parseCodexEventNotification } from './codexEvents.js';

type NotificationHandler = (notification: unknown) => Promise<void> | void;
type CodexMcpClient = Pick<Client, 'connect' | 'callTool' | 'listTools' | 'close'> & {
  fallbackNotificationHandler?: NotificationHandler;
};
```

Inside `runStory()`, use the request cwd and install the handler before `callTool`:

```ts
const invocation = buildCodexToolInput(this.config, request.story, request.prompt, request.cwd);
const previousFallbackHandler = client.fallbackNotificationHandler;
const linkedSessionIds = new Set<string>();
const reportSessionLinked = async (
  sessionId: string,
  sessionLogPath: string | null,
  progressSource: 'codex-event' | 'session-linked' | 'structured',
): Promise<void> => {
  if (request.signal?.aborted) return;
  if (linkedSessionIds.has(sessionId)) return;
  linkedSessionIds.add(sessionId);
  await request.onLifecycle?.({ type: 'session-linked', sessionId, sessionLogPath, progressSource });
};

client.fallbackNotificationHandler = async (notification: unknown) => {
  await previousFallbackHandler?.(notification);
  if (request.signal?.aborted) return;
  const event = parseCodexEventNotification(notification);
  if (event === null) return;
  if (event.eventType === 'session_configured' && event.threadId !== null) {
    await reportSessionLinked(event.threadId, event.sessionLogPath, 'codex-event');
  }
  if (event.threadId !== null || event.eventType === 'warning') {
    await request.onLifecycle?.({
      type: 'progress',
      message: codexProgressMessage(event),
      progressSource: 'codex-event',
      eventType: event.eventType,
    });
  }
};
```

Update standard progress handling:

```ts
onprogress: (progress: unknown) => {
  if (request.signal?.aborted) return;
  const sessionId = progressSessionId(progress);
  if (sessionId) void reportSessionLinked(sessionId, null, 'mcp-progress');
  void request.onLifecycle?.({
    type: 'progress',
    message: progressMessage(progress),
    progressToken: progressToken(progress),
    progressSource: 'mcp-progress',
  });
},
```

After final output:

```ts
await reportSessionLinked(output.threadId, null, 'structured');
```

- [ ] **Step 5: Run driver tests and verify they pass**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/codex-mcp-runner.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit driver slice**

```bash
git add packages/orchestrator/src/drivers/StoryRunner.ts packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts packages/orchestrator/tests/codex-mcp-runner.test.ts
git commit -m "feat: supervise codex mcp events"
```

## Task 3: WorkflowRunner State And Artifacts

**Files:**
- Modify: `packages/orchestrator/src/runner/WorkflowRunner.ts`
- Modify: `packages/orchestrator/tests/runner.test.ts`

- [ ] **Step 1: Add runner tests for explicit progress sources**

In `runner.test.ts`, add a lifecycle runner:

```ts
class CodexEventLifecycleRunner implements StoryRunner {
  requests: StoryRunRequest[] = [];

  async runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    this.requests.push(request);
    await request.onLifecycle?.({
      type: 'session-linked',
      sessionId: `thread-${request.story.id.toLowerCase()}`,
      sessionLogPath: `/sessions/${request.story.id.toLowerCase()}.jsonl`,
      progressSource: 'codex-event',
    });
    await request.onLifecycle?.({
      type: 'progress',
      message: 'codex event: exec_command_begin',
      progressSource: 'codex-event',
      eventType: 'exec_command_begin',
    });
    return {
      storyId: request.story.id,
      sessionId: `thread-${request.story.id.toLowerCase()}`,
      content: 'ok',
      rawResult: {},
      invocation: {},
    };
  }

  async checkTools(): Promise<{ ok: boolean; tools: string[] }> {
    return { ok: true, tools: ['codex'] };
  }
}
```

Add an assertion test using the existing temp workspace helpers:

```ts
it('records codex-event progress source in launch records and journal events', async () => {
  const workspace = createWorkspace();
  const runner = new WorkflowRunner({
    config: configForWorkspace(workspace.root),
    storySource: new MutableStorySource([[story('A001')], []]),
    storyRunner: new CodexEventLifecycleRunner(),
    artifactStore: workspace.artifacts,
    tracker: workspace.tracker,
    gitInspector: workspace.gitInspector,
    clock: workspace.clock,
    logger: workspace.logger,
  });

  await runner.runEligible({ dryRun: false });

  const launch = JSON.parse(readFileSync(path.join(workspace.runsDir, 'children', 'A001.launch.json'), 'utf8'));
  expect(launch).toMatchObject({
    status: 'settled',
    sessionId: 'thread-a001',
    sessionLogPath: '/sessions/a001.jsonl',
    progressSource: 'codex-event',
  });
  expect(launch.lastObservedChildProgressAt).toBeTruthy();
  expect(launch.lastHeartbeatAt).toBeTruthy();

  const events = readFileSync(path.join(workspace.runsDir, 'events.ndjson'), 'utf8');
  expect(events).toContain('"event":"child-session-linked"');
  expect(events).toContain('"progressSource":"codex-event"');
  expect(events).toContain('"eventType":"exec_command_begin"');
});
```

- [ ] **Step 2: Run runner test and verify it fails**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/runner.test.ts
```

Expected: fail because `WorkflowRunner` overwrites progress sources with `session-linked` / `mcp-progress`.

- [ ] **Step 3: Honor lifecycle progress sources in WorkflowRunner**

Update `handleLifecycle` in `WorkflowRunner.ts`:

```ts
if (event.type === 'session-linked') {
  await acknowledgeStartup(
    {
      sessionId: event.sessionId,
      sessionLogPath: event.sessionLogPath ?? null,
      progressSource: event.progressSource,
    },
    {
      type: 'session-linked',
      sessionId: event.sessionId,
      sessionLogPath: event.sessionLogPath ?? null,
      progressSource: event.progressSource,
    },
  );
  return;
}

await acknowledgeStartup({ progressSource: event.progressSource });
await this.journal.record('child-progress', {
  storyId: story.id,
  launchId: launch.record.launchId,
  message: event.message,
  progressToken: event.progressToken ?? null,
  progressSource: event.progressSource,
  eventType: event.eventType ?? null,
  elapsedMs: this.dependencies.clock.nowMs() - startedAtMs,
});
```

Update the `acknowledgeStartup` event parameter type and journal payload:

```ts
event: {
  type: 'session-linked';
  sessionId: string;
  sessionLogPath: string | null;
  progressSource: ChildProgressSource;
} | null = null,
```

```ts
await this.journal.record('child-session-linked', {
  storyId: story.id,
  launchId: launch.record.launchId,
  sessionId: event.sessionId,
  sessionLogPath: event.sessionLogPath,
  progressSource: event.progressSource,
});
```

- [ ] **Step 4: Run runner tests and verify they pass**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/runner.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit runner state slice**

```bash
git add packages/orchestrator/src/runner/WorkflowRunner.ts packages/orchestrator/tests/runner.test.ts
git commit -m "feat: persist child progress sources"
```

## Task 4: Parent Worktree Preparation

**Files:**
- Create: `packages/orchestrator/src/runner/ChildWorkspacePreparer.ts`
- Create: `packages/orchestrator/tests/child-workspace-preparer.test.ts`
- Modify: `packages/orchestrator/src/runner/WorkflowRunner.ts`
- Modify: `packages/orchestrator/tests/runner.test.ts`

- [ ] **Step 1: Write child workspace preparer tests**

Add tests that use a temporary git repository:

```ts
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareChildWorkspace } from '../src/runner/ChildWorkspacePreparer';
import type { ResolvedGitConfig, WorkflowStory } from '../src/types';

const git: ResolvedGitConfig = {
  strategy: 'worktree',
  branchPattern: '{track}/{id-lc}-{slug}',
  baseBranch: 'main',
  commitOnBase: 'forbid',
  worktreeDir: '.worktrees',
};

const story: WorkflowStory = {
  id: 'A001',
  title: 'Story One',
  status: 'specced',
  owner: null,
  dependencies: [],
  eligible: true,
  blockedReason: null,
  metadata: { trackId: 'track', trackTitle: 'Track', trackerPath: 'docs/tracks/track/README.md', order: 1 },
};

function repo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'awk-worktree-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: root });
  writeFileSync(path.join(root, 'README.md'), 'root\n');
  execFileSync('git', ['add', 'README.md'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root });
  return root;
}

describe('prepareChildWorkspace', () => {
  it('creates the expected repo-local worktree', async () => {
    const root = repo();

    const prepared = await prepareChildWorkspace({ story, workspaceRootAbs: root, git, fallbackCwdAbs: root });

    expect(prepared).toMatchObject({
      childCwdAbs: path.join(root, '.worktrees', 'a001-story-one'),
      expectedBranch: 'track/a001-story-one',
      expectedWorktreePath: path.join(root, '.worktrees', 'a001-story-one'),
      prepared: true,
    });
    expect(existsSync(prepared.childCwdAbs)).toBe(true);
    expect(execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: prepared.childCwdAbs, encoding: 'utf8' }).trim()).toBe(
      'track/a001-story-one',
    );
  });

  it('blocks an existing non-worktree path', async () => {
    const root = repo();
    mkdirSync(path.join(root, '.worktrees', 'a001-story-one'), { recursive: true });

    await expect(prepareChildWorkspace({ story, workspaceRootAbs: root, git, fallbackCwdAbs: root })).rejects.toThrow(
      'expected worktree path exists but is not a git worktree',
    );
  });

  it('leaves branch strategy on fallback cwd', async () => {
    const root = repo();
    const prepared = await prepareChildWorkspace({
      story,
      workspaceRootAbs: root,
      fallbackCwdAbs: root,
      git: { ...git, strategy: 'branch' },
    });

    expect(prepared).toEqual({
      childCwdAbs: root,
      expectedBranch: 'track/a001-story-one',
      expectedWorktreePath: null,
      prepared: false,
    });
  });
});
```

- [ ] **Step 2: Run preparer tests and verify they fail**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/child-workspace-preparer.test.ts
```

Expected: fail because `ChildWorkspacePreparer.ts` does not exist.

- [ ] **Step 3: Implement preparer**

Create `ChildWorkspacePreparer.ts`:

```ts
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ResolvedGitConfig, WorkflowStory } from '../types.js';
import { renderExpectedBranch, renderExpectedWorktreePath } from './launchMetadata.js';

const execFileAsync = promisify(execFile);

export interface PreparedChildWorkspace {
  childCwdAbs: string;
  expectedBranch: string;
  expectedWorktreePath: string | null;
  prepared: boolean;
}

export interface PrepareChildWorkspaceArgs {
  story: WorkflowStory;
  workspaceRootAbs: string;
  fallbackCwdAbs: string;
  git: ResolvedGitConfig;
}

export async function prepareChildWorkspace(args: PrepareChildWorkspaceArgs): Promise<PreparedChildWorkspace> {
  const expectedBranch = renderExpectedBranch(args.story, args.git);
  const expectedWorktreePath = renderExpectedWorktreePath(args.workspaceRootAbs, args.git, args.story);
  if (args.git.strategy !== 'worktree' || expectedWorktreePath === null) {
    return { childCwdAbs: args.fallbackCwdAbs, expectedBranch, expectedWorktreePath: null, prepared: false };
  }

  assertRepoLocalWorktreePath(args.workspaceRootAbs, args.git.worktreeDir, expectedWorktreePath);

  if (await isGitWorktree(expectedWorktreePath)) {
    const branch = await gitOutput(expectedWorktreePath, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch !== expectedBranch) {
      throw new Error(`expected worktree path is on branch ${branch}, expected ${expectedBranch}`);
    }
    return { childCwdAbs: expectedWorktreePath, expectedBranch, expectedWorktreePath, prepared: true };
  }

  if (await pathExists(expectedWorktreePath)) {
    throw new Error('expected worktree path exists but is not a git worktree');
  }

  await mkdir(path.dirname(expectedWorktreePath), { recursive: true });
  if (await branchExists(args.workspaceRootAbs, expectedBranch)) {
    await gitOutput(args.workspaceRootAbs, ['worktree', 'add', expectedWorktreePath, expectedBranch]);
  } else {
    await gitOutput(args.workspaceRootAbs, ['worktree', 'add', expectedWorktreePath, '-b', expectedBranch, args.git.baseBranch]);
  }

  return { childCwdAbs: expectedWorktreePath, expectedBranch, expectedWorktreePath, prepared: true };
}

function assertRepoLocalWorktreePath(workspaceRootAbs: string, worktreeDir: string, expectedWorktreePath: string): void {
  const normalizedRoot = path.resolve(workspaceRootAbs);
  const normalizedWorktreeRoot = path.resolve(workspaceRootAbs, worktreeDir);
  const normalizedExpected = path.resolve(expectedWorktreePath);
  if (!isInside(normalizedExpected, normalizedRoot) || !isInside(normalizedExpected, normalizedWorktreeRoot)) {
    throw new Error(`expected worktree path escapes configured workspace worktree directory: ${expectedWorktreePath}`);
  }
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative.length === 0 || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function isGitWorktree(cwd: string): Promise<boolean> {
  return (await maybeGitOutput(cwd, ['rev-parse', '--is-inside-work-tree'])) === 'true';
}

async function branchExists(cwd: string, branch: string): Promise<boolean> {
  return (await maybeGitOutput(cwd, ['rev-parse', '--verify', branch])) !== null;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await execFileAsync('test', ['-e', target]);
    return true;
  } catch {
    return false;
  }
}

async function maybeGitOutput(cwd: string, args: string[]): Promise<string | null> {
  try {
    return await gitOutput(cwd, args);
  } catch {
    return null;
  }
}

async function gitOutput(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}
```

- [ ] **Step 4: Run preparer tests and verify they pass**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/child-workspace-preparer.test.ts
```

Expected: pass.

- [ ] **Step 5: Inject preparer into WorkflowRunner**

Add a dependency hook in `WorkflowRunner` dependencies:

```ts
childWorkspacePreparer?: typeof prepareChildWorkspace;
```

Import the default:

```ts
import { prepareChildWorkspace } from './ChildWorkspacePreparer.js';
```

In `prepareChildLaunch`, before building the prompt and launch record:

```ts
const workspacePreparer = this.dependencies.childWorkspacePreparer ?? prepareChildWorkspace;
let preparedWorkspace: PreparedChildWorkspace;
try {
  preparedWorkspace = await workspacePreparer({
    story,
    workspaceRootAbs: this.dependencies.config.workspace.rootAbs,
    fallbackCwdAbs: this.dependencies.config.codex.childSession.cwdAbs,
    git: this.dependencies.config.git,
  });
} catch (error) {
  await this.journal.record('child-workspace-prepare-failed', {
    storyId: story.id,
    reason: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
const childCwd = preparedWorkspace.childCwdAbs;
```

Use `preparedWorkspace.expectedBranch` and `preparedWorkspace.expectedWorktreePath` in `activeChild` / `launchRecord`.

- [ ] **Step 6: Add runner coverage for prepared cwd**

In `runner.test.ts`, add a test with an injected preparer:

```ts
it('passes prepared worktree cwd to the child runner', async () => {
  const workspace = createWorkspace();
  const storyRunner = new SyncRunner();
  const runner = new WorkflowRunner({
    config: configForWorkspace(workspace.root),
    storySource: new MutableStorySource([[story('A001')], []]),
    storyRunner,
    artifactStore: workspace.artifacts,
    tracker: workspace.tracker,
    gitInspector: workspace.gitInspector,
    clock: workspace.clock,
    logger: workspace.logger,
    childWorkspacePreparer: async () => ({
      childCwdAbs: path.join(workspace.root, '.worktrees', 'a001-story'),
      expectedBranch: 't/a001-a001',
      expectedWorktreePath: path.join(workspace.root, '.worktrees', 'a001-story'),
      prepared: true,
    }),
  });

  await runner.runEligible({ dryRun: false });

  expect(storyRunner.requests[0].cwd).toBe(path.join(workspace.root, '.worktrees', 'a001-story'));
});
```

- [ ] **Step 7: Run preparer and runner tests**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/child-workspace-preparer.test.ts packages/orchestrator/tests/runner.test.ts
```

Expected: pass.

- [ ] **Step 8: Commit workspace slice**

```bash
git add packages/orchestrator/src/runner/ChildWorkspacePreparer.ts packages/orchestrator/src/runner/WorkflowRunner.ts packages/orchestrator/tests/child-workspace-preparer.test.ts packages/orchestrator/tests/runner.test.ts
git commit -m "feat: prepare child worktrees before launch"
```

## Task 5: Codex Tool Input And Prompt Contract

**Files:**
- Modify: `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts`
- Modify: `packages/orchestrator/tests/tool-input.test.ts`

- [ ] **Step 1: Update tool input tests**

Change the cwd test to pass a prepared cwd:

```ts
it('uses the prepared launch cwd for codex MCP input', () => {
  expect(buildCodexToolInput(config, story, 'custom prompt', '/repo/.worktrees/l002-pilot')).toMatchObject({
    cwd: '/repo/.worktrees/l002-pilot',
    prompt: 'custom prompt',
  });
});
```

Add prompt contract assertions:

```ts
it('describes parent-prepared worktree semantics for worktree strategy', () => {
  const prompt = buildGenericPrompt(story, config);

  expect(prompt).toContain('The parent orchestrator has already prepared the expected branch/worktree.');
  expect(prompt).toContain('You are launched in the expected worktree cwd.');
  expect(prompt).toContain('If cwd, git top-level, branch, or worktree path verification fails, stop and report the blocker before editing.');
  expect(prompt).not.toContain('treat a missing expected worktree');
  expect(prompt).not.toContain('needs-create/expected');
});

it('keeps writable roots tied to the workspace root when launch cwd is a worktree', () => {
  const result = buildCodexToolInput(config, story, 'p', '/repo/.worktrees/l002-pilot');

  expect(result.config).toEqual(
    expect.objectContaining({
      sandbox_workspace_write: {
        writable_roots: ['/repo/.git', '/repo/.worktrees'],
      },
    }),
  );
});
```

- [ ] **Step 2: Run tool input tests and verify they fail**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/tool-input.test.ts
```

Expected: fail because `buildCodexToolInput` does not accept a launch cwd and the prompt still tells the child to create the worktree.

- [ ] **Step 3: Update `buildCodexToolInput` signature and cwd behavior**

Change the function signature:

```ts
export function buildCodexToolInput(
  config: ResolvedWorkflowConfig,
  story: WorkflowStory,
  prompt = buildGenericPrompt(story, config),
  cwdAbs = config.codex.childSession.cwdAbs,
): CodexToolInput {
```

Set the input cwd:

```ts
const input: CodexToolInput = {
  cwd: cwdAbs,
  prompt,
};
```

Keep writable root computation tied to the workspace root:

```ts
const workspaceRoot = config.workspace.rootAbs;
const gitAbs = path.join(workspaceRoot, '.git');
const worktreesAbs = path.join(workspaceRoot, config.git.worktreeDir);
```

- [ ] **Step 4: Update worktree prompt text**

Replace the worktree preflight instruction with:

```ts
expectedWorktreePath
  ? `3. Before editing, verify the parent-prepared worktree: cwd must be \`${expectedWorktreePath}\`, git top-level must be \`${expectedWorktreePath}\`, current branch must be \`${branchPattern}\`, and the configured base branch \`${git.baseBranch}\` must exist. If cwd, git top-level, branch, or worktree path verification fails, stop and report the blocker before editing.`
  : '3. Before editing, run a child preflight: verify cwd, git top-level, current branch, expected branch, and configured base branch against the Git policy above.',
```

Add the policy lines:

```ts
expectedWorktreePath ? '- The parent orchestrator has already prepared the expected branch/worktree.' : null,
expectedWorktreePath ? '- You are launched in the expected worktree cwd.' : null,
```

Replace:

```ts
'- You MUST create the isolated branch/worktree, commit your work there, and confirm the commit exists BEFORE reporting the story done. An uncommitted tracker edit is not acceptance.',
```

with:

```ts
expectedWorktreePath
  ? '- You MUST use the parent-prepared branch/worktree, commit your work there, and confirm the commit exists BEFORE reporting the story done. An uncommitted tracker edit is not acceptance.'
  : '- You MUST create or use the isolated branch, commit your work there, and confirm the commit exists BEFORE reporting the story done. An uncommitted tracker edit is not acceptance.',
```

- [ ] **Step 5: Run tool input tests and verify they pass**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/tool-input.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit tool input slice**

```bash
git add packages/orchestrator/src/drivers/codex-mcp/toolInput.ts packages/orchestrator/tests/tool-input.test.ts
git commit -m "feat: launch codex children in prepared cwd"
```

## Task 6: Analyzer, Docs, Fixture Sync

**Files:**
- Modify: `packages/orchestrator/src/analysis/runAnalyzer.ts`
- Modify: `packages/orchestrator/tests/analysis.test.ts`
- Modify: `docs/architecture.md`
- Modify: `references/config-schema.md`
- Modify: `plugins/agentic-workflow-kit/references/config-schema.md`
- Modify: `plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md`
- Modify: generated/materialized plugin files if tests identify drift.

- [ ] **Step 1: Add analyzer regression coverage**

In `analysis.test.ts`, add a fixture launch record with:

```json
{
  "storyId": "A001",
  "status": "launched",
  "sessionId": "thread-a001",
  "sessionLogPath": "/sessions/a001.jsonl",
  "progressSource": "codex-event",
  "lastObservedChildProgressAt": "2026-06-12T20:00:00.000Z",
  "lastHeartbeatAt": "2026-06-12T20:00:00.000Z",
  "expectedWorktreePath": "/repo/.worktrees/a001-story"
}
```

Assert the analyzer output includes:

```ts
expect(result.children[0]?.progress.progressSource).toBe('codex-event');
expect(result.children[0]?.session.linked).toBe(true);
expect(result.children[0]?.issues).not.toContain('startup is stale');
```

- [ ] **Step 2: Run analyzer tests**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/analysis.test.ts
```

Expected: pass if `runAnalyzer.ts` already reads arbitrary `progressSource`; otherwise fail with a missing or null source.

- [ ] **Step 3: Patch analyzer only if the test fails**

If needed, update child launch parsing in `runAnalyzer.ts` to keep the string:

```ts
progressSource: readOptionalString(child.progressSource),
```

and ensure linked status checks use existing `sessionId` / `sessionLogPath` fields:

```ts
const linked = child.sessionId !== null || child.sessionLogPath !== null;
```

- [ ] **Step 4: Update canonical docs**

In `references/config-schema.md`, change the timeout explanation to distinguish sources:

```md
Use `childStartupTimeoutMs` to fail empty child startup shells quickly when no session id, session
log, Codex `codex/event` notification, MCP `notifications/progress`, heartbeat, result, or
worktree activity appears. After startup acknowledgement, use `childNoProgressTimeoutMs` to detect
silent children. Parent supervisor polls are parent liveness only; they do not reset child startup
or no-progress timers.
```

In `docs/architecture.md`, add a short paragraph in the supervision/worktree section:

```md
For the Codex MCP driver, child liveness is observed through Codex custom `codex/event`
notifications when available. Standard MCP `notifications/progress` remains supported, but Codex
CLI session activity is not expected to arrive through the SDK `onprogress` path. Under worktree
strategy, the parent prepares the story worktree before launch and passes that path as the Codex
tool `cwd`, so file tools default to the isolated checkout.
```

- [ ] **Step 5: Mirror plugin fixture docs**

Copy the same durable text into:

```text
plugins/agentic-workflow-kit/references/config-schema.md
plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md
```

Keep wording short and operational. Do not add YAML comments to presets.

- [ ] **Step 6: Run docs and fixture tests**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/analysis.test.ts test/config-doc-sync.test.ts test/plugin-runtime-bundle.test.ts test/skill-authoring.test.ts
```

Expected: pass, or report fixture/bundle drift that must be regenerated by the repo's existing command.

- [ ] **Step 7: Commit docs/analyzer slice**

```bash
git add packages/orchestrator/src/analysis/runAnalyzer.ts packages/orchestrator/tests/analysis.test.ts docs/architecture.md references/config-schema.md plugins/agentic-workflow-kit/references/config-schema.md plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md
git commit -m "docs: document codex event supervision"
```

## Task 7: Optional Live Probe

**Files:**
- Create if committed: `packages/orchestrator/scripts/probe-codex-mcp-events.mjs`
- Modify if committed: `package.json`

- [ ] **Step 1: Decide script versus manual validation**

Use the spec recommendation: commit a small optional script if driver behavior is still high risk after unit coverage. Keep it out of required CI because local Codex CLI availability is not guaranteed.

- [ ] **Step 2: If committing a script, implement a compact probe**

The script should:

```js
#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const requestedCwd = process.argv[2] ?? process.cwd();
const client = new Client({ name: 'agentic-workflow-kit-codex-event-probe', version: '0.1.0' });
const transport = new StdioClientTransport({ command: 'codex', args: ['mcp-server'], cwd: requestedCwd });
const events = [];

client.fallbackNotificationHandler = async (notification) => {
  if (notification?.method === 'codex/event') events.push(notification);
};

await client.connect(transport);
const tools = await client.listTools();
const result = await client.callTool({
  name: 'codex',
  arguments: {
    cwd: requestedCwd,
    prompt: 'Print WK_EVENT_SUPERVISION_VALIDATION_DONE and do not modify files.',
    sandbox: 'read-only',
  },
});
await client.close();

const first = events.find((event) => event?.params?.msg?.type === 'session_configured');
const structuredThreadId = result?.structuredContent?.threadId ?? null;
const eventThreadId = first?.params?._meta?.threadId ?? first?.params?.msg?.thread_id ?? first?.params?.msg?.session_id ?? null;

const summary = {
  ok: Boolean(first && structuredThreadId && structuredThreadId === eventThreadId),
  requestedCwd,
  sessionCwd: first?.params?.msg?.cwd ?? null,
  structuredThreadId,
  eventThreadId,
  customEvents: events.length,
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
```

- [ ] **Step 3: Run optional live probe manually**

Run:

```bash
node packages/orchestrator/scripts/probe-codex-mcp-events.mjs /Users/aryekogan/repos/workflow-kit/packages/orchestrator
```

Expected: JSON summary with `"ok": true`, matching thread ids, nonzero `customEvents`, and `sessionCwd` equal to the requested cwd.

- [ ] **Step 4: Commit probe only if added**

```bash
git add packages/orchestrator/scripts/probe-codex-mcp-events.mjs package.json
git commit -m "test: add codex mcp event probe"
```

## Task 8: Full Verification And Release Hygiene

**Files:**
- Modify: `.changeset/*.md`
- Final cleanup: delete this spec and plan in the story's final implementation commit after durable content is folded into canonical docs.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm exec vitest run packages/orchestrator/tests/codex-mcp-events.test.ts packages/orchestrator/tests/codex-mcp-runner.test.ts packages/orchestrator/tests/runner.test.ts packages/orchestrator/tests/child-workspace-preparer.test.ts packages/orchestrator/tests/tool-input.test.ts packages/orchestrator/tests/analysis.test.ts
```

Expected: pass.

- [ ] **Step 2: Run required gate**

Run:

```bash
pnpm check
```

Expected: pass.

- [ ] **Step 3: Run publish-surface checks**

Run when plugin surfaces or generated fixtures changed:

```bash
pnpm build
pnpm pack:dry-run
pnpm smoke:codex-plugin
claude plugin validate .
```

Expected: pass. If `claude` or local plugin prerequisites are unavailable, record the exact command and reason in the handoff.

- [ ] **Step 4: Add one changeset for the feature**

Create `.changeset/codex-mcp-event-supervision.md`:

```md
---
"agentic-workflow-kit": patch
"@agentic-workflow-kit/orchestrator": patch
---

Supervise Codex MCP child sessions through Codex `codex/event` notifications and launch worktree-strategy children from parent-prepared story worktrees.
```

- [ ] **Step 5: Commit changeset**

```bash
git add .changeset/codex-mcp-event-supervision.md
git commit -m "chore: add codex mcp supervision changeset"
```

- [ ] **Step 6: Final implementation cleanup commit**

Before opening the implementation PR, delete transient story artifacts and keep durable content in canonical docs:

```bash
git rm docs/superpowers/specs/2026-06-12-codex-mcp-event-supervision-and-worktree-isolation-design.md docs/superpowers/plans/2026-06-12-codex-mcp-event-supervision-and-worktree-isolation.md
git add docs/architecture.md references/config-schema.md plugins/agentic-workflow-kit/references/config-schema.md plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md
git commit -m "docs: fold codex mcp supervision design into canonical docs"
```

- [ ] **Step 7: Open PR after all gates**

Run:

```bash
git status --short
gh pr create --fill
```

Expected: clean working tree before PR creation; PR body includes focused tests, `pnpm check`, publish-surface checks, and live probe result or explicit skip reason.

## Self-Review

- Spec coverage: Tasks 1-3 cover `codex/event` parsing, source-aware lifecycle events, timer-reset evidence, and artifacts. Tasks 4-5 cover parent-created worktrees and prepared Codex cwd. Task 6 covers analyzer/docs/fixture sync. Task 7 covers the optional live probe. Task 8 covers verification, changeset, and transient artifact cleanup.
- Placeholder scan: every task names concrete files, commands, assertions, and expected outcomes.
- Type consistency: `ChildProgressSource`, `CodexEventNotification`, `PreparedChildWorkspace`, and `buildCodexToolInput(..., cwdAbs)` are introduced before later tasks reference them.
