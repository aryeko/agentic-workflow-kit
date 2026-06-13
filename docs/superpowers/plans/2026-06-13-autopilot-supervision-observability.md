# Autopilot Supervision and Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make autopilot supervision controllable, nonblocking, quiet, and metrics-rich while keeping worktree-based tracker edits out of the parent checkout.

**Architecture:** Keep the orchestrator artifact directory as the source of truth for run supervision. Extract reusable session-log metrics, make watch snapshots summarize meaningful run/story state, expose Codex child control through MCP, and move worktree launch reservation away from parent tracker writes.

**Tech Stack:** TypeScript, Vitest, MCP SDK, Codex MCP server, Markdown tracker artifacts, pnpm 11.5.1.

---

## File Structure

- Create `test/codex-mcp-tool-input.test.ts`: prompt regression tests for Codex review and merge freshness guidance.
- Modify `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts`: child prompt text only.
- Create `packages/orchestrator/src/metrics/sessionLogMetrics.ts`: shared parser for Codex session JSONL metrics and review-loop signals currently embedded in the analyzer.
- Modify `packages/orchestrator/src/analysis/runAnalyzer.ts`: replace private session-log metrics parsing with the shared parser.
- Create `test/session-log-metrics.test.ts`: direct tests for active and completed session-log metric extraction.
- Modify `packages/orchestrator/src/metrics/liveMetrics.ts`: enrich live snapshots with status and session-derived metrics.
- Modify `packages/orchestrator/src/runner/RunJournal.ts`: write enriched live metrics and child metrics artifacts when linked session logs are available.
- Modify `packages/orchestrator/src/runner/MetricsCollector.ts`: merge observed progress with session-derived metrics without losing previous values.
- Modify `packages/orchestrator/src/commands/handlers.ts`: make watch snapshots immediate, add cursor helpers, add meaningful summary generation, and quiet non-JSON event watch.
- Modify `packages/orchestrator/src/mcp/tools.ts`: expose watch cursor tools plus Codex reply and interrupt tools.
- Create `packages/orchestrator/src/mcp/codexControl.ts`: resolve run/story sessions and call Codex control tools.
- Create `test/watch-run.test.ts`: watch snapshot, cursor, meaningful summary, and no-blocking regressions.
- Create `test/mcp-codex-control.test.ts`: MCP control resolution and fail-closed behavior.
- Modify `packages/orchestrator/src/runner/WorkflowRunner.ts`: avoid parent tracker claims for worktree strategy and rely on launch reservations.
- Create `test/workflow-runner-tracker-claim.test.ts`: prove worktree launches do not dirty parent trackers and duplicate protection still blocks collisions.
- Modify `docs/architecture.md`: document nonblocking watch, live metrics, control tools, and worktree tracker ownership.
- Modify `docs/getting-started.md`: update operator guidance for watch and manual Codex child intervention.

---

### Task 1: Prompt Gates

**Files:**
- Create: `test/codex-mcp-tool-input.test.ts`
- Modify: `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts`

- [ ] **Step 1: Write failing prompt tests**

Create `test/codex-mcp-tool-input.test.ts` with tests that assert the prompt contains the review and merge rules.

```ts
import { describe, expect, it } from 'vitest';
import { buildGenericPrompt } from '../packages/orchestrator/src/drivers/codex-mcp/toolInput.js';
import type { ResolvedWorkflowConfig, WorkflowStory } from '../packages/orchestrator/src/types.js';

describe('codex MCP child prompt', () => {
  it('tells Codex children to inspect PR body reactions for approval', () => {
    const prompt = buildGenericPrompt(story(), config());

    expect(prompt).toContain('Check PR body reactions');
    expect(prompt).toContain('issue comments');
    expect(prompt).toContain('PR review comments');
    expect(prompt).toContain('A +1 reaction from bot `codex` means approval');
    expect(prompt).toContain('An eyes reaction from bot `codex` means review is pending');
    expect(prompt).toContain('Do not re-request Codex review after a +1 reaction has been observed');
  });

  it('requires base freshness and verification before auto-merge', () => {
    const prompt = buildGenericPrompt(story(), config());

    expect(prompt).toContain('Before merge, fetch the latest `main`');
    expect(prompt).toContain('rebase or otherwise update the story branch onto `main`');
    expect(prompt).toContain('rerun the required verification after the base update');
    expect(prompt).toContain('If the base update conflicts or verification fails, stop and report the blocker');
  });
});

function story(): WorkflowStory {
  return {
    id: 'DLD07',
    title: 'Delivery workflow hardening',
    status: 'planned',
    owner: null,
    dependencies: [],
    eligible: true,
    blockedReason: null,
    metadata: {
      trackId: 'delivery',
      trackTitle: 'Delivery',
      trackerPath: 'docs/tracks/delivery/README.md',
      order: 1,
      plan: 'docs/superpowers/plans/dld07.md',
    },
  };
}

function config(): Pick<ResolvedWorkflowConfig, 'workspace' | 'git' | 'implement' | 'pr'> {
  return {
    workspace: { rootAbs: '/repo' },
    git: {
      strategy: 'worktree',
      branchPattern: 'story/{id}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    },
    pr: {
      create: true,
      ci: { wait: true, command: 'pnpm check' },
      review: {
        wait: 'bot',
        bot: 'codex',
        triageComments: true,
        maxFixBatches: 2,
        rerequestAfterFix: false,
        waitTimeoutMinutes: 30,
      },
      merge: { auto: true, method: 'squash', deleteBranch: true },
    },
    implement: {
      review: {
        prePr: { enabled: true, mode: 'subagent', maxLoops: 2, loopMode: 'incremental' },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
    },
  };
}
```

- [ ] **Step 2: Run the prompt tests and verify RED**

Run:

```bash
pnpm vitest run test/codex-mcp-tool-input.test.ts
```

Expected: FAIL because the current prompt does not mention PR body reactions, explicit `+1` approval, or base freshness before merge.

- [ ] **Step 3: Update prompt details**

Modify `reviewGateDetails()` in `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts` so the Codex branch returns explicit PR body reaction guidance.

```ts
  return [
    '- Codex review signal is reaction/comment based, not a native GitHub approval gate.',
    '- Check PR body reactions, issue comments, and PR review comments before deciding whether Codex review is pending, approved, or has findings.',
    `- A +1 reaction from bot \`${review.bot}\` means approval / clear / no findings.`,
    `- An eyes reaction from bot \`${review.bot}\` means review is pending; it is not approval.`,
    `- Codex PR review comments or PR comments are findings. ${triage}`,
    '- Do not require a GitHub PullRequestReview APPROVED or CHANGES_REQUESTED state from Codex.',
    '- Do not re-request Codex review after a +1 reaction has been observed.',
    '- Do not mention @codex unless auto review failed to start or a manual retry is needed.',
  ];
```

Add merge freshness lines near the PR policy section in `buildGenericPrompt()`, directly after the auto-merge/delete-branch lines.

```ts
    pr.merge.auto
      ? `- Before merge, fetch the latest \`${git.baseBranch}\`, rebase or otherwise update the story branch onto \`${git.baseBranch}\`, and rerun the required verification after the base update.`
      : null,
    pr.merge.auto
      ? '- If the base update conflicts or verification fails, stop and report the blocker instead of merging.'
      : null,
```

- [ ] **Step 4: Run the prompt tests and verify GREEN**

Run:

```bash
pnpm vitest run test/codex-mcp-tool-input.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit prompt gates**

```bash
git add test/codex-mcp-tool-input.test.ts packages/orchestrator/src/drivers/codex-mcp/toolInput.ts
git commit -m "fix: clarify codex review and merge gates"
```

---

### Task 2: Shared Session Metrics Parser

**Files:**
- Create: `packages/orchestrator/src/metrics/sessionLogMetrics.ts`
- Create: `test/session-log-metrics.test.ts`
- Modify: `packages/orchestrator/src/analysis/runAnalyzer.ts`

- [ ] **Step 1: Write failing parser tests**

Create `test/session-log-metrics.test.ts`.

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeSessionLogMetrics, mapSessionLogsByThread } from '../packages/orchestrator/src/metrics/sessionLogMetrics.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('session log metrics', () => {
  it('extracts command counts, subagent counts, and token totals', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-session-metrics-'));
    tempRoots.push(root);
    const logPath = path.join(root, 'session.jsonl');
    await writeFile(
      logPath,
      [
        JSON.stringify({ type: 'session_meta', payload: { id: '019e-child' } }),
        JSON.stringify({ type: 'response_item', payload: { type: 'function_call', name: 'exec_command' } }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'spawn_agent',
            arguments: JSON.stringify({ agent_type: 'reviewer' }),
          },
        }),
        JSON.stringify({ type: 'response_item', payload: { type: 'custom_tool_call', name: 'apply_patch' } }),
        JSON.stringify({
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: {
                input_tokens: 100,
                cached_input_tokens: 80,
                output_tokens: 20,
                reasoning_output_tokens: 7,
                total_tokens: 127,
              },
            },
          },
        }),
      ].join('\n'),
    );

    const metrics = await analyzeSessionLogMetrics(logPath);

    expect(metrics.commandCounts).toEqual({ exec_command: 1, spawn_agent: 1, apply_patch: 1 });
    expect(metrics.subagentCounts).toEqual({ reviewer: 1 });
    expect(metrics.tokenTotals).toEqual({
      inputTokens: 100,
      cachedInputTokens: 80,
      outputTokens: 20,
      reasoningOutputTokens: 7,
      totalTokens: 127,
    });
  });

  it('maps session ids to log paths', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-session-map-'));
    tempRoots.push(root);
    const day = path.join(root, '2026/06/13');
    await mkdir(day, { recursive: true });
    const logPath = path.join(day, 'rollout.jsonl');
    await writeFile(logPath, JSON.stringify({ type: 'session_meta', payload: { id: '019e-child' } }));

    const map = await mapSessionLogsByThread([logPath]);

    expect(map.get('019e-child')).toBe(logPath);
  });
});
```

- [ ] **Step 2: Run parser tests and verify RED**

Run:

```bash
pnpm vitest run test/session-log-metrics.test.ts
```

Expected: FAIL because `packages/orchestrator/src/metrics/sessionLogMetrics.ts` does not exist.

- [ ] **Step 3: Extract parser implementation**

Create `packages/orchestrator/src/metrics/sessionLogMetrics.ts`. Move the existing `mapSessionLogsByThread()`, `analyzeSessionLog()`, JSON-line parsing helpers, token readers, and review-loop state from `runAnalyzer.ts` into this file. Export:

```ts
export interface SessionLogMetrics {
  commandCounts: Record<string, number>;
  subagentCounts: Record<string, number>;
  tokenTotals: TokenTotals | null;
  reviewLoops: SessionReviewLoop[];
  failedSpawnAgentAttempts: number;
}

export async function mapSessionLogsByThread(sessionLogs: string[]): Promise<Map<string, string>>;
export async function analyzeSessionLogMetrics(sessionLog: string): Promise<SessionLogMetrics>;
```

Keep helper functions private except for the two exported functions and the exported interfaces needed by `runAnalyzer.ts`.

- [ ] **Step 4: Wire analyzer to shared parser**

Modify `packages/orchestrator/src/analysis/runAnalyzer.ts`:

```ts
import {
  analyzeSessionLogMetrics,
  mapSessionLogsByThread,
  type SessionReviewLoop,
} from '../metrics/sessionLogMetrics.js';
```

Replace calls to the private `analyzeSessionLog()` with `analyzeSessionLogMetrics()`. Delete the old private parser and duplicate helper code from `runAnalyzer.ts`.

- [ ] **Step 5: Run parser and analyzer tests**

Run:

```bash
pnpm vitest run test/session-log-metrics.test.ts test/run-analyzer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit shared parser**

```bash
git add packages/orchestrator/src/metrics/sessionLogMetrics.ts packages/orchestrator/src/analysis/runAnalyzer.ts test/session-log-metrics.test.ts
git commit -m "refactor: share session log metrics parsing"
```

---

### Task 3: Live Metrics From Linked Sessions

**Files:**
- Modify: `packages/orchestrator/src/metrics/liveMetrics.ts`
- Modify: `packages/orchestrator/src/runner/MetricsCollector.ts`
- Modify: `packages/orchestrator/src/runner/RunJournal.ts`
- Create: `test/live-metrics.test.ts`

- [ ] **Step 1: Write failing live metrics tests**

Create `test/live-metrics.test.ts` with a direct test around a new exported enrichment helper.

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { enrichLiveMetricsFromSessionLogs } from '../packages/orchestrator/src/metrics/liveMetrics.js';
import type { LiveMetricsSnapshot } from '../packages/orchestrator/src/types.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('live metrics enrichment', () => {
  it('fills active child metrics from a linked session log', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-live-metrics-'));
    tempRoots.push(root);
    const sessionLogPath = path.join(root, 'session.jsonl');
    await mkdir(root, { recursive: true });
    await writeFile(
      sessionLogPath,
      [
        JSON.stringify({ type: 'response_item', payload: { type: 'function_call', name: 'exec_command' } }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'spawn_agent',
            arguments: JSON.stringify({ agent_type: 'reviewer' }),
          },
        }),
        JSON.stringify({
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: {
                input_tokens: 10,
                cached_input_tokens: 4,
                output_tokens: 3,
                reasoning_output_tokens: 2,
                total_tokens: 15,
              },
            },
          },
        }),
      ].join('\n'),
    );
    const snapshot: LiveMetricsSnapshot = {
      runId: 'run-1',
      status: 'running',
      elapsedMs: 1000,
      maxParallel: 2,
      active: ['DLD07'],
      completedCount: 0,
      blockedStoryId: null,
      blockedReason: null,
      children: {
        DLD07: {
          storyId: 'DLD07',
          toolCounts: {},
          subagentCounts: {},
          tokenTotals: null,
          latestProgress: 'session linked',
          sessionLogPath,
        },
      },
      aggregate: { toolCounts: {}, subagentCounts: {}, tokenTotals: null },
    };

    const enriched = await enrichLiveMetricsFromSessionLogs(snapshot);

    expect(enriched.children.DLD07.toolCounts).toEqual({ exec_command: 1, spawn_agent: 1 });
    expect(enriched.children.DLD07.subagentCounts).toEqual({ reviewer: 1 });
    expect(enriched.children.DLD07.tokenTotals?.totalTokens).toBe(15);
    expect(enriched.aggregate.toolCounts).toEqual({ exec_command: 1, spawn_agent: 1 });
  });
});
```

- [ ] **Step 2: Run live metrics tests and verify RED**

Run:

```bash
pnpm vitest run test/live-metrics.test.ts
```

Expected: FAIL because `enrichLiveMetricsFromSessionLogs()` is not exported.

- [ ] **Step 3: Implement live enrichment**

In `packages/orchestrator/src/metrics/liveMetrics.ts`, add:

```ts
export async function enrichLiveMetricsFromSessionLogs(
  snapshot: LiveMetricsSnapshot,
): Promise<LiveMetricsSnapshot> {
  const children: Record<string, ChildMetricsSnapshot> = {};
  for (const [storyId, child] of Object.entries(snapshot.children)) {
    children[storyId] = await enrichChildMetric(child);
  }
  return {
    ...snapshot,
    children,
    aggregate: mergeChildMetrics(Object.values(children)),
  };
}
```

Implement `enrichChildMetric()` with `analyzeSessionLogMetrics()` and fail soft on `ENOENT`, partial writes, and JSON parse misses by returning the existing child metric.

- [ ] **Step 4: Persist enriched live metrics**

Modify `RunJournal.writeLiveMetrics()` to build the snapshot, call `enrichLiveMetricsFromSessionLogs()`, then write the enriched result to `metrics.live.json`.

- [ ] **Step 5: Preserve monotonic observed metrics**

Modify `MetricsCollector.updateChildMetric()` and `observeChildProgress()` so a child never loses existing `toolCounts`, `subagentCounts`, or `tokenTotals` when a later progress event only carries `latestProgress` or `sessionLogPath`.

- [ ] **Step 6: Run live metrics tests**

Run:

```bash
pnpm vitest run test/session-log-metrics.test.ts test/live-metrics.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit live metrics**

```bash
git add packages/orchestrator/src/metrics/liveMetrics.ts packages/orchestrator/src/runner/MetricsCollector.ts packages/orchestrator/src/runner/RunJournal.ts test/live-metrics.test.ts
git commit -m "feat: enrich live metrics from session logs"
```

---

### Task 4: Nonblocking Watch and Meaningful Summary

**Files:**
- Modify: `packages/orchestrator/src/commands/handlers.ts`
- Modify: `packages/orchestrator/src/types.ts`
- Create: `test/watch-run.test.ts`

- [ ] **Step 1: Write failing watch snapshot tests**

Create `test/watch-run.test.ts` with tests for immediate snapshots and summary shape.

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { watchRunHandler } from '../packages/orchestrator/src/commands/handlers.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('watch run handler', () => {
  it('returns immediately by default for running state', async () => {
    const runPath = await writeRun({
      state: { runId: 'run-1', status: 'running', active: ['DLD07'], activeChildren: [] },
      metrics: { runId: 'run-1', status: 'running', children: {}, aggregate: {} },
    });

    const started = Date.now();
    const snapshot = await watchRunHandler(runPath, {});

    expect(Date.now() - started).toBeLessThan(1000);
    expect(snapshot.wait).toBeUndefined();
    expect(snapshot.summary).toMatchObject({ runId: 'run-1', status: 'running', active: ['DLD07'] });
  });

  it('summarizes per-story launch and metric state', async () => {
    const runPath = await writeRun({
      state: {
        runId: 'run-1',
        status: 'running',
        active: ['DLD07'],
        completed: [],
        blockedStoryId: null,
        blockedReason: null,
        activeChildren: [
          {
            storyId: 'DLD07',
            launchId: 'DLD07-1',
            expectedBranch: 'story/dld07',
            expectedWorktreePath: '/repo/.worktrees/DLD07',
            startedAt: '2026-06-13T12:00:00.000Z',
            lastSupervisorPollAt: '2026-06-13T12:01:00.000Z',
            lastObservedChildProgressAt: '2026-06-13T12:02:00.000Z',
            progressSource: 'codex-event',
            lastHeartbeatAt: '2026-06-13T12:02:00.000Z',
          },
        ],
      },
      metrics: {
        runId: 'run-1',
        status: 'running',
        active: ['DLD07'],
        children: {
          DLD07: {
            storyId: 'DLD07',
            toolCounts: { exec_command: 2 },
            subagentCounts: { reviewer: 1 },
            tokenTotals: { inputTokens: 10, cachedInputTokens: 5, outputTokens: 3, reasoningOutputTokens: 1, totalTokens: 14 },
            latestProgress: 'task complete',
            sessionLogPath: '/sessions/dld07.jsonl',
          },
        },
        aggregate: {
          toolCounts: { exec_command: 2 },
          subagentCounts: { reviewer: 1 },
          tokenTotals: { inputTokens: 10, cachedInputTokens: 5, outputTokens: 3, reasoningOutputTokens: 1, totalTokens: 14 },
        },
      },
    });

    const snapshot = await watchRunHandler(runPath, {});

    expect(snapshot.summary?.stories).toEqual([
      expect.objectContaining({
        storyId: 'DLD07',
        status: 'active',
        sessionLogPath: '/sessions/dld07.jsonl',
        expectedBranch: 'story/dld07',
        toolCounts: { exec_command: 2 },
        subagentCounts: { reviewer: 1 },
      }),
    ]);
  });
});

async function writeRun(input: { state: unknown; metrics: unknown }): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'awk-watch-'));
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'state.json'), JSON.stringify(input.state, null, 2));
  await writeFile(path.join(root, 'metrics.live.json'), JSON.stringify(input.metrics, null, 2));
  return root;
}
```

- [ ] **Step 2: Run watch tests and verify RED**

Run:

```bash
pnpm vitest run test/watch-run.test.ts
```

Expected: FAIL because `WatchRunSnapshot` has no `summary`.

- [ ] **Step 3: Add summary types**

Modify `packages/orchestrator/src/types.ts` or `packages/orchestrator/src/commands/handlers.ts` with:

```ts
export interface WatchRunSummary {
  runId: string | null;
  status: string | null;
  active: string[];
  completedCount: number;
  blockedStoryId: string | null;
  blockedReason: string | null;
  elapsedMs: number | null;
  aggregate: LiveMetricsSnapshot['aggregate'] | null;
  stories: WatchStorySummary[];
}

export interface WatchStorySummary {
  storyId: string;
  status: 'requested' | 'launched' | 'active' | 'blocked' | 'complete' | 'supervision_lost' | 'unknown';
  sessionId: string | null;
  sessionLogPath: string | null;
  expectedBranch: string | null;
  expectedWorktreePath: string | null;
  latestMilestone: string | null;
  latestProgressAt: string | null;
  planSteps: { done: number; total: number } | null;
  toolCounts: Record<string, number>;
  subagentCounts: Record<string, number>;
  tokenTotals: TokenTotals | null;
}
```

- [ ] **Step 4: Build summaries in watchRunHandler**

Modify `readRunSnapshot()` so it returns `{ state, metrics, summary }`. Derive story summaries from `state.activeChildren`, `state.completed`, and `metrics.children`.

- [ ] **Step 5: Keep wait opt-in and bounded**

Keep existing `wait` support for CLI compatibility, but ensure MCP descriptions and default behavior make `wait` false. Do not add implicit waiting in `watchRunHandler()`.

- [ ] **Step 6: Quiet CLI event watch**

Modify `printNewEvents()` so non-JSON output prints only meaningful event types:

```ts
const meaningfulEventTypes = new Set([
  'run-started',
  'child-launch-requested',
  'child-launched',
  'child-session-linked',
  'child-complete',
  'child-error',
  'story-not-complete',
  'run-blocked',
  'run-complete',
  'run-supervision-lost',
]);
```

When `overrides.json` is true, keep printing every raw event.

- [ ] **Step 7: Run watch tests**

Run:

```bash
pnpm vitest run test/watch-run.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit watch summary**

```bash
git add packages/orchestrator/src/commands/handlers.ts packages/orchestrator/src/types.ts test/watch-run.test.ts
git commit -m "feat: summarize watch run state"
```

---

### Task 5: Watch Cursor MCP Tools

**Files:**
- Modify: `packages/orchestrator/src/commands/handlers.ts`
- Modify: `packages/orchestrator/src/mcp/tools.ts`
- Modify: `packages/orchestrator/src/mcp/server.ts`
- Modify: `packages/orchestrator/src/types.ts`
- Modify: `test/watch-run.test.ts`

- [ ] **Step 1: Add failing cursor tests**

Extend `test/watch-run.test.ts` with:

```ts
import { startWatchRunHandler, pollWatchRunHandler, stopWatchRunHandler } from '../packages/orchestrator/src/commands/handlers.js';

it('starts, polls, and stops a watch cursor without holding a long request open', async () => {
  const runPath = await writeRun({
    state: { runId: 'run-1', status: 'running', active: ['DLD07'], completed: [] },
    metrics: { runId: 'run-1', status: 'running', children: {}, aggregate: {} },
  });

  const started = await startWatchRunHandler(runPath, {});
  expect(started.watchId).toMatch(/^watch_/);
  expect(started.cursor).toEqual({ eventOffset: 0 });

  const polled = await pollWatchRunHandler({ runPath, cursor: started.cursor }, {});
  expect(polled.summary?.runId).toBe('run-1');
  expect(polled.cursor.eventOffset).toBe(0);

  const stopped = await stopWatchRunHandler(started.watchId);
  expect(stopped.stopped).toBe(true);
});
```

- [ ] **Step 2: Run cursor tests and verify RED**

Run:

```bash
pnpm vitest run test/watch-run.test.ts
```

Expected: FAIL because cursor handler exports do not exist.

- [ ] **Step 3: Implement cursor handlers**

Add command handlers:

```ts
export interface WatchRunCursor {
  eventOffset: number;
}

export interface StartWatchRunResult extends WatchRunSnapshot {
  watchId: string;
  cursor: WatchRunCursor;
}

export async function startWatchRunHandler(runPath: string, overrides: CliOverrides = {}): Promise<StartWatchRunResult>;
export async function pollWatchRunHandler(input: { runPath: string; cursor: WatchRunCursor }, overrides: CliOverrides = {}): Promise<WatchRunSnapshot & { cursor: WatchRunCursor; changes: unknown[] }>;
export async function stopWatchRunHandler(watchId: string): Promise<{ watchId: string; stopped: boolean }>;
```

Use client-side event offsets as the durable cursor. `watchId` is a convenience identifier; correctness must not depend on server memory.

- [ ] **Step 4: Register MCP tools**

In `packages/orchestrator/src/mcp/tools.ts`, add tools:

- `watch_run_start`
- `watch_run_poll`
- `watch_run_stop`

Update `ORCHESTRATOR_MCP_TOOLS` and tool descriptions. Mark start and poll as read-only/idempotent. Mark stop as read-only/idempotent because it only releases local watch state.

- [ ] **Step 5: Update MCP server description**

Modify `packages/orchestrator/src/mcp/server.ts` to recommend `watch_run_start` and `watch_run_poll` for long supervision instead of `watch_run wait=true`.

- [ ] **Step 6: Run focused watch/MCP tests**

Run:

```bash
pnpm vitest run test/watch-run.test.ts test/orchestrator-package.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit watch cursor tools**

```bash
git add packages/orchestrator/src/commands/handlers.ts packages/orchestrator/src/mcp/tools.ts packages/orchestrator/src/mcp/server.ts packages/orchestrator/src/types.ts test/watch-run.test.ts test/orchestrator-package.test.ts
git commit -m "feat: add nonblocking watch cursors"
```

---

### Task 6: Codex Reply and Interrupt MCP Control

**Files:**
- Create: `packages/orchestrator/src/mcp/codexControl.ts`
- Modify: `packages/orchestrator/src/mcp/tools.ts`
- Modify: `packages/orchestrator/src/mcp/server.ts`
- Create: `test/mcp-codex-control.test.ts`

- [ ] **Step 1: Write failing control tests**

Create `test/mcp-codex-control.test.ts`.

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveCodexControlTarget } from '../packages/orchestrator/src/mcp/codexControl.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('codex MCP control target resolution', () => {
  it('resolves a child session from runPath and storyId', async () => {
    const runPath = await mkdtemp(path.join(tmpdir(), 'awk-control-'));
    tempRoots.push(runPath);
    await mkdir(path.join(runPath, 'children'), { recursive: true });
    await writeFile(
      path.join(runPath, 'children/DLD07.launch.json'),
      JSON.stringify({ storyId: 'DLD07', sessionId: '019e-child', sessionLogPath: '/sessions/dld07.jsonl' }),
    );

    const target = await resolveCodexControlTarget({ runPath, storyId: 'DLD07' });

    expect(target).toEqual({ sessionId: '019e-child', storyId: 'DLD07', runPath });
  });

  it('rejects a run-resolved target without a linked session', async () => {
    const runPath = await mkdtemp(path.join(tmpdir(), 'awk-control-missing-'));
    tempRoots.push(runPath);
    await mkdir(path.join(runPath, 'children'), { recursive: true });
    await writeFile(path.join(runPath, 'children/DLD07.launch.json'), JSON.stringify({ storyId: 'DLD07', sessionId: null }));

    await expect(resolveCodexControlTarget({ runPath, storyId: 'DLD07' })).rejects.toThrow(
      'story DLD07 does not have a linked Codex session',
    );
  });
});
```

- [ ] **Step 2: Run control tests and verify RED**

Run:

```bash
pnpm vitest run test/mcp-codex-control.test.ts
```

Expected: FAIL because `codexControl.ts` does not exist.

- [ ] **Step 3: Implement target resolution**

Create `packages/orchestrator/src/mcp/codexControl.ts` with:

```ts
export interface CodexControlTargetInput {
  sessionId?: string;
  runPath?: string;
  storyId?: string;
}

export interface CodexControlTarget {
  sessionId: string;
  storyId: string | null;
  runPath: string | null;
}

export async function resolveCodexControlTarget(input: CodexControlTargetInput): Promise<CodexControlTarget>;
```

Rules:

- If `sessionId` is supplied, return it directly with `storyId ?? null` and `runPath ?? null`.
- If `runPath` and `storyId` are supplied, read `children/<safe story id>.launch.json`.
- Reject when neither targeting mode is complete.
- Reject when the launch file has no non-empty `sessionId`.

- [ ] **Step 4: Implement Codex control calls**

In `codexControl.ts`, add:

```ts
export async function sendCodexReply(input: CodexReplyInput): Promise<CodexControlResult>;
export async function sendCodexInterrupt(input: CodexInterruptInput): Promise<CodexControlResult>;
```

Connect to the Codex MCP server with `codex mcp-server`, call the underlying reply/interrupt tool if present, and fail with `Codex MCP control tool <name> is unavailable` if `listTools()` does not expose the needed tool.

- [ ] **Step 5: Journal control events**

When `runPath` is provided, append events to `events.ndjson`:

- `codex-reply-sent`
- `codex-interrupt-sent`

For replies, store `messagePreview` as the first 200 characters and `messageSha256`; do not store the full message.

- [ ] **Step 6: Register MCP control tools**

In `packages/orchestrator/src/mcp/tools.ts`, add:

- `codex_reply`
- `codex_interrupt`

Input shape:

```ts
const codexReplyInputSchema = z.object({
  sessionId: z.string().optional(),
  runPath: z.string().optional(),
  storyId: z.string().optional(),
  message: z.string().min(1),
  responseFormat: z.enum(['concise', 'detailed']).optional(),
});

const codexInterruptInputSchema = z.object({
  sessionId: z.string().optional(),
  runPath: z.string().optional(),
  storyId: z.string().optional(),
  reason: z.string().optional(),
  responseFormat: z.enum(['concise', 'detailed']).optional(),
});
```

- [ ] **Step 7: Run control tests**

Run:

```bash
pnpm vitest run test/mcp-codex-control.test.ts test/orchestrator-package.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit MCP control tools**

```bash
git add packages/orchestrator/src/mcp/codexControl.ts packages/orchestrator/src/mcp/tools.ts packages/orchestrator/src/mcp/server.ts test/mcp-codex-control.test.ts test/orchestrator-package.test.ts
git commit -m "feat: expose codex child control tools"
```

---

### Task 7: Worktree Tracker Ownership

**Files:**
- Modify: `packages/orchestrator/src/runner/WorkflowRunner.ts`
- Modify: `packages/orchestrator/src/tracks/trackerClaimer.ts`
- Create: `test/workflow-runner-tracker-claim.test.ts`

- [ ] **Step 1: Write failing parent-tracker mutation test**

Create `test/workflow-runner-tracker-claim.test.ts` with a fake story runner and artifact store. The test should create a parent tracker file, launch a worktree-strategy story, and assert the parent tracker content is unchanged before child handoff.

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowRunner } from '../packages/orchestrator/src/runner/WorkflowRunner.js';
import type { ArtifactStore, Clock, GitInspector, RunEvent, StoryRunner, WorkflowStory } from '../packages/orchestrator/src/types.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('workflow runner tracker ownership', () => {
  it('does not claim the parent tracker for worktree strategy launches', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-runner-tracker-'));
    tempRoots.push(root);
    const trackerPath = path.join(root, 'docs/tracks/delivery/README.md');
    const original = [
      '# Delivery',
      '',
      '| ID | Title | Status | Owner | Dependencies |',
      '| --- | --- | --- | --- | --- |',
      '| DLD07 | Delivery workflow hardening | planned | — | — |',
      '',
    ].join('\n');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, original);
    const artifactStore = new MemoryArtifactStore(root);
    const runner = new WorkflowRunner({
      command: 'run-story',
      config: makeConfig(root),
      storySource: { listStories: async () => [story()] },
      storyRunner: new HangingStoryRunner(),
      gitInspector: fakeGitInspector(),
      artifactStore,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      clock: fixedClock(),
      runId: 'run-1',
      childWorkspacePreparer: async () => ({
        childCwdAbs: path.join(root, '.worktrees/DLD07'),
        expectedBranch: 'story/dld07',
        expectedWorktreePath: path.join(root, '.worktrees/DLD07'),
        prepared: true,
      }),
    });

    const launched = await runner.runEligible({ returnAfterInitialLaunch: true });

    expect(launched.status).toBe('running');
    expect(await readFile(trackerPath, 'utf8')).toBe(original);
  });
});
```

Add the helper classes/functions in the same test file. `HangingStoryRunner.runStory()` should call `request.onLifecycle?.({ type: 'session-linked', sessionId: '019e-child', sessionLogPath: null, progressSource: 'structured' })` and return a never-resolving promise so the launch state can be inspected.

- [ ] **Step 2: Run tracker ownership test and verify RED**

Run:

```bash
pnpm vitest run test/workflow-runner-tracker-claim.test.ts
```

Expected: FAIL because `claimBeforeLaunch()` currently edits the parent tracker.

- [ ] **Step 3: Split claim policy by git strategy**

Modify `WorkflowRunner.claimBeforeLaunch()`:

- For `config.git.strategy === 'worktree'`, do not call `claimTrackerRow()`.
- Return a `ClaimedWorkflowStory` with `trackerClaimed: false`, original `story`, owner, and previous status.
- Record a new event `tracker-claim-skipped` with reason `worktree-child-owns-tracker`.
- For branch strategy, keep the current claim/release behavior.

- [ ] **Step 4: Preserve duplicate launch protection**

Ensure `preflightDuplicateLaunch()` still runs before every launch. Keep launch records as the parent reservation source. Add a second test in `test/workflow-runner-tracker-claim.test.ts` that seeds `state.activeChildren` through an existing launch path and proves a duplicate same story/worktree blocks.

- [ ] **Step 5: Run tracker ownership tests**

Run:

```bash
pnpm vitest run test/workflow-runner-tracker-claim.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit tracker ownership**

```bash
git add packages/orchestrator/src/runner/WorkflowRunner.ts packages/orchestrator/src/tracks/trackerClaimer.ts test/workflow-runner-tracker-claim.test.ts
git commit -m "fix: keep worktree tracker claims out of parent checkout"
```

---

### Task 8: Documentation and Final Verification

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/getting-started.md`
- Delete before final PR: `docs/superpowers/specs/2026-06-13-autopilot-supervision-observability-design.md`
- Delete before final PR: `docs/superpowers/plans/2026-06-13-autopilot-supervision-observability.md`

- [ ] **Step 1: Update architecture docs**

In `docs/architecture.md`, document:

- `watch_run` is an immediate snapshot.
- `watch_run_start`, `watch_run_poll`, and `watch_run_stop` are the long-supervision path.
- `metrics.live.json` includes live command counts, subagent counts, and token totals by type when session logs are linked.
- Worktree strategy leaves tracker mutation to child worktrees; parent reservations live in launch artifacts.
- `codex_reply` and `codex_interrupt` are manual intervention tools and journal redacted control events.

- [ ] **Step 2: Update getting started docs**

In `docs/getting-started.md`, update the operator flow:

```text
1. Dry-run with run_eligible.
2. Launch after explicit approval.
3. Use watch_run_start and watch_run_poll for nonblocking supervision.
4. Use codex_reply when a child is alive but needs operator input.
5. Use codex_interrupt only when the child should stop.
6. Use analyze_run after watch shows complete, blocked, or supervision_lost.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 4: Remove transient working artifacts before final implementation PR**

When this plan has been fully implemented and durable docs are updated, delete:

```bash
git rm docs/superpowers/specs/2026-06-13-autopilot-supervision-observability-design.md
git rm docs/superpowers/plans/2026-06-13-autopilot-supervision-observability.md
```

Do not delete them in the planning-only commit requested for this handoff.

- [ ] **Step 5: Commit docs and verification**

```bash
git add docs/architecture.md docs/getting-started.md
git commit -m "docs: document autopilot supervision controls"
```

If this task is only committing the planning artifacts, use:

```bash
git add docs/superpowers/specs/2026-06-13-autopilot-supervision-observability-design.md docs/superpowers/plans/2026-06-13-autopilot-supervision-observability.md
git commit -m "docs: plan autopilot supervision improvements"
```

---

## Self-Review

- Spec coverage: the plan covers the prompt-only review gate, merge freshness prompt, MCP reply/interrupt controls, live session-derived metrics, nonblocking watch cursor tools, meaningful watch summaries, parent tracker ownership for worktree strategy, and verification.
- Non-goals preserved: the plan does not add analyzer reconstruction for the manual-recovery corner case, synthetic recovered-child finalization, or remote/API merge behavior.
- Placeholder scan: the plan contains no placeholder markers or deferred test descriptions; each task names files, commands, expected red/green results, and commit boundaries.
- Type consistency: watch summary and metrics type names are introduced before use; Codex control target names are consistent across handler and MCP tasks.

Plan complete and saved to `docs/superpowers/plans/2026-06-13-autopilot-supervision-observability.md`.
