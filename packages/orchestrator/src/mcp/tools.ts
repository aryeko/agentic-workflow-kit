import { existsSync } from 'node:fs';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { projectInspectFacade, runPreviewFacade, trackerMigrateFacade, trackerValidateFacade } from '../api/facade.js';
import {
  abortRunHandler,
  analyzeRunHandler,
  listEligibleHandler,
  listStoriesHandler,
  listTracksHandler,
  mcpCheckHandler,
  pollWatchRunHandler,
  runWorkflowHandler,
  startWatchRunHandler,
  stopWatchRunHandler,
  watchRunHandler,
} from '../commands/handlers.js';
import type { CliOverrides, Logger, RunState } from '../types.js';
import { sendCodexInterrupt, sendCodexReply } from './codexControl.js';

export const ORCHESTRATOR_MCP_TOOLS = [
  'workflow_project_inspect',
  'workflow_run_preview',
  'workflow_run_control',
  'workflow_tracker_validate',
  'workflow_tracker_migrate',
  'list_tracks',
  'list_stories',
  'list_eligible',
  'run_eligible',
  'run_story',
  'watch_run',
  'watch_run_start',
  'watch_run_poll',
  'watch_run_stop',
  'codex_reply',
  'codex_interrupt',
  'analyze_run',
  'check_codex_mcp',
] as const;

const productBaseInputSchema = z.object({
  cwd: z
    .string()
    .optional()
    .describe('Target repo root to operate in; omit only when the MCP session is already running from that repo.'),
  configPath: z.string().optional().describe('Path to .workflow/config.yaml; defaults to <cwd>/.workflow/config.yaml.'),
  requestId: z.string().optional().describe('Optional client request id echoed in the WorkflowKit API envelope.'),
  responseFormat: z
    .enum(['concise', 'detailed'])
    .optional()
    .describe('Structured response size. Use concise by default; detailed raises limits but may still truncate.'),
});

function baseProductTrackerInputSchema() {
  return productBaseInputSchema.extend({
    track: z.string().describe('Track id containing the tracker to validate or use as migration target.'),
  });
}

const workflowRunPreviewInputSchema = productBaseInputSchema.extend({
  target: z
    .discriminatedUnion('type', [
      z.object({
        type: z.literal('story'),
        trackId: z.string().optional().describe('Track id containing the story.'),
        storyId: z.string().describe('Story id to preview.'),
      }),
      z.object({
        type: z.literal('track'),
        trackId: z.string().optional().describe('Track id to preview.'),
        mode: z.literal('eligible').describe('Preview the eligible-story track run.'),
      }),
    ])
    .describe('Product target for the run preview.'),
});

const workflowRunControlInputSchema = productBaseInputSchema.extend({
  runPath: z.string().describe('Absolute path to the run artifact directory to control.'),
  action: z.literal('abort').describe('Run control action to apply.'),
  storyId: z.string().optional().describe('Optional active story id to target within the run.'),
  reason: z.string().optional().describe('Operator-facing reason for the control request.'),
});

const workflowTrackerValidateInputSchema = baseProductTrackerInputSchema();

const workflowTrackerMigrateInputSchema = baseProductTrackerInputSchema().extend({
  from: z.string().describe('Markdown backlog or tracker source file to import without mutating it in place.'),
});

const baseInputSchema = z.object({
  cwd: z
    .string()
    .optional()
    .describe('Target repo root to operate in; omit only when the MCP session is already running from that repo.'),
  configPath: z.string().optional().describe('Path to .workflow/config.yaml; defaults to <cwd>/.workflow/config.yaml.'),
  track: z
    .string()
    .optional()
    .describe('Track id to scope to; required for run_eligible when multiple tracks have eligible stories.'),
  tracksDir: z
    .string()
    .optional()
    .describe('Tracker directory override relative to the workspace root; defaults to paths.tracksDir from config.'),
  maxParallel: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum stories to dispatch or preview from eligible stories; defaults to the configured maxParallel.'),
  json: z.boolean().optional().describe('Prefer machine-readable CLI-compatible JSON formatting in text summaries.'),
  responseFormat: z
    .enum(['concise', 'detailed'])
    .optional()
    .describe('Structured response size. Use concise by default; detailed raises limits but may still truncate.'),
});

const runInputSchema = baseInputSchema.extend({
  dryRun: z
    .boolean()
    .optional()
    .describe('Defaults to true. Set false only when the user explicitly approves launching child sessions.'),
  force: z.boolean().optional().describe('Allow dispatch even when the selected story is not currently eligible.'),
  childTimeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Timeout in milliseconds for each child Codex MCP session.'),
  model: z.string().optional().describe('Optional Codex model override for child sessions.'),
  reasoning: z.string().optional().describe('Optional reasoning effort override for child sessions.'),
  approvalPolicy: z
    .enum(['never', 'on-failure', 'on-request', 'untrusted'])
    .optional()
    .describe('Child Codex approval policy; never means no interactive approval prompts.'),
  sandbox: z
    .enum(['danger-full-access', 'read-only', 'workspace-write'])
    .optional()
    .describe('Child Codex filesystem sandbox; danger-full-access grants full local disk access.'),
});

const runStoryInputSchema = runInputSchema.extend({
  storyId: z.string().describe('Tracker story id to dry-run or dispatch, for example WK4.'),
});

const runPathInputSchema = z.object({
  runPath: z
    .string()
    .describe('Absolute path to a run artifact directory, e.g. the artifactDir returned by run_story or run_eligible.'),
  sessionRoot: z.string().optional().describe('Override root for child session artifacts when analyzing a run.'),
  wait: z.boolean().optional().describe('For watch_run, poll until the run leaves running or timeoutMs expires.'),
  intervalMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('For watch_run --wait, polling interval in milliseconds.'),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('For watch_run --wait, maximum wait time in milliseconds.'),
  json: z.boolean().optional().describe('Prefer machine-readable CLI-compatible JSON formatting in text summaries.'),
  responseFormat: z
    .enum(['concise', 'detailed'])
    .optional()
    .describe('Structured response size. Use concise by default; detailed raises limits but may still truncate.'),
});

const watchRunPollInputSchema = runPathInputSchema.extend({
  cursor: z
    .object({
      eventOffset: z.number().int().nonnegative().describe('Number of run events the caller has already consumed.'),
    })
    .describe('Cursor returned by watch_run_start or a previous watch_run_poll call.'),
});

const watchRunStopInputSchema = z.object({
  watchId: z.string().describe('Watch id returned by watch_run_start.'),
  responseFormat: z
    .enum(['concise', 'detailed'])
    .optional()
    .describe('Structured response size. Use concise by default; detailed raises limits but may still truncate.'),
});

const codexReplyInputSchema = z.object({
  sessionId: z.string().optional().describe('Direct Codex session/thread id to reply to.'),
  runPath: z.string().optional().describe('Run artifact directory used with storyId to resolve a child session.'),
  storyId: z.string().optional().describe('Story id used with runPath to resolve children/<story>.launch.json.'),
  message: z.string().min(1).describe('Reply message to send to the live Codex child session.'),
  responseFormat: z
    .enum(['concise', 'detailed'])
    .optional()
    .describe('Structured response size. Use concise by default; detailed raises limits but may still truncate.'),
});

const codexInterruptInputSchema = z.object({
  sessionId: z.string().optional().describe('Direct Codex session/thread id to interrupt.'),
  runPath: z.string().optional().describe('Run artifact directory used with storyId to resolve a child session.'),
  storyId: z.string().optional().describe('Story id used with runPath to resolve children/<story>.launch.json.'),
  reason: z.string().optional().describe('Optional operator-facing reason for interrupting the child session.'),
  responseFormat: z
    .enum(['concise', 'detailed'])
    .optional()
    .describe('Structured response size. Use concise by default; detailed raises limits but may still truncate.'),
});

const outputSchema = z
  .object({
    truncated: z.boolean().optional().describe('True when structuredContent was shortened for MCP response safety.'),
    truncation: z
      .object({
        message: z.string().describe('Human-readable truncation summary.'),
        paths: z.array(z.string()).describe('StructuredContent paths that were truncated.'),
      })
      .optional()
      .describe('Present when structuredContent was shortened.'),
  })
  .passthrough();

export function registerOrchestratorTools(server: McpServer): void {
  server.registerTool(
    'workflow_project_inspect',
    {
      description: 'Resolve WorkflowKit project context, tracks, and capability flags using the product API envelope.',
      inputSchema: productBaseInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_project_inspect', input.responseFormat, () => {
        return projectInspectFacade(toOverrides(input));
      }),
  );

  server.registerTool(
    'workflow_run_preview',
    {
      description:
        'Preview story or track execution through the product API envelope. This is non-mutating runtime preview behavior and keeps legacy run_story/run_eligible tools available.',
      inputSchema: workflowRunPreviewInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_run_preview', input.responseFormat, () => {
        return runPreviewFacade({ ...toOverrides(input), target: input.target });
      }),
  );

  server.registerTool(
    'workflow_run_control',
    {
      description: 'Append a durable run control request and apply supported run-level controls. V1 supports abort.',
      inputSchema: workflowRunControlInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) =>
      handleTool('workflow_run_control', input.responseFormat, () =>
        abortRunHandler({
          runPath: input.runPath,
          storyId: input.storyId,
          reason: input.reason,
          requestedBy: 'mcp',
        }),
      ),
  );

  server.registerTool(
    'workflow_tracker_validate',
    {
      description: 'Validate tracker contract diagnostics before runtime execution.',
      inputSchema: workflowTrackerValidateInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_tracker_validate', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return trackerValidateFacade(toOverrides(input));
      }),
  );

  server.registerTool(
    'workflow_tracker_migrate',
    {
      description: 'Draft a kit tracker from an existing markdown backlog or tracker source plus diagnostics.',
      inputSchema: workflowTrackerMigrateInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_tracker_migrate', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return trackerMigrateFacade({ ...toOverrides(input), from: input.from, track: input.track });
      }),
  );

  server.registerTool(
    'list_tracks',
    {
      description:
        'Discover tracker directories and active tracks. Run first when you do not know available track ids.',
      inputSchema: baseInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('list_tracks', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return listTracksHandler(toOverrides(input));
      }),
  );

  server.registerTool(
    'list_stories',
    {
      description:
        'Parse tracker stories for one track or all active tracks. Use track to narrow large repos; use before run_story to find exact ids.',
      inputSchema: baseInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('list_stories', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return listStoriesHandler(toOverrides(input));
      }),
  );

  server.registerTool(
    'list_eligible',
    {
      description:
        'Stories ready to dispatch after status, owner, and dependency filtering. Run before run_eligible; if more than one track has eligible stories you must pass track.',
      inputSchema: baseInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('list_eligible', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return listEligibleHandler(toOverrides(input));
      }),
  );

  server.registerTool(
    'run_eligible',
    {
      description:
        'Dry-run or launch eligible stories for a single track. Defaults to dry-run unless dryRun is false. Non-dry-run returns after initial child launch with runId/artifactDir; use watch_run and analyze_run for supervision. Non-dry-run with sandbox danger-full-access and approvalPolicy never runs unsupervised child sessions with full disk access.',
      inputSchema: runInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => {
      const overrides = toOverrides({ ...input, dryRun: input.dryRun !== false, asyncLaunch: input.dryRun === false });
      return handleTool(
        'run_eligible',
        input.responseFormat,
        () => {
          assertWorkflowRepoContext(input);
          return runWorkflowHandler({ kind: 'run-eligible', overrides }, { logger: nullLogger, stdout: noopStdout });
        },
        summarizeRun,
      );
    },
  );

  server.registerTool(
    'run_story',
    {
      description:
        'Dry-run or launch one tracker story. Defaults to dry-run unless dryRun is false. Non-dry-run may run a long child session; use watch_run and analyze_run for supervision.',
      inputSchema: runStoryInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => {
      const overrides = toOverrides({ ...input, dryRun: input.dryRun !== false });
      return handleTool(
        'run_story',
        input.responseFormat,
        () => {
          assertWorkflowRepoContext(input);
          return runWorkflowHandler(
            { kind: 'run-story', storyId: input.storyId, overrides },
            { logger: nullLogger, stdout: noopStdout },
          );
        },
        summarizeRun,
      );
    },
  );

  server.registerTool(
    'watch_run',
    {
      description:
        'Read current state.json, metrics.live.json, and a meaningful run summary for a run artifact directory returned by run_story or run_eligible. Returns immediately by default; prefer watch_run_start and watch_run_poll for long supervision.',
      inputSchema: runPathInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('watch_run', input.responseFormat, () => watchRunHandler(input.runPath, toOverrides(input))),
  );

  server.registerTool(
    'watch_run_start',
    {
      description:
        'Start nonblocking run supervision. Returns the current watch summary plus a cursor for later watch_run_poll calls.',
      inputSchema: runPathInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('watch_run_start', input.responseFormat, () =>
        startWatchRunHandler(input.runPath, toOverrides(input)),
      ),
  );

  server.registerTool(
    'watch_run_poll',
    {
      description:
        'Poll a nonblocking run watch using a cursor from watch_run_start or a previous watch_run_poll call. Returns meaningful snapshot data and raw changes since the cursor.',
      inputSchema: watchRunPollInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('watch_run_poll', input.responseFormat, () =>
        pollWatchRunHandler({ runPath: input.runPath, cursor: input.cursor }, toOverrides(input)),
      ),
  );

  server.registerTool(
    'watch_run_stop',
    {
      description:
        'Stop a nonblocking watch id returned by watch_run_start. Cursor correctness is client-side, so this only releases process-local watch state when present.',
      inputSchema: watchRunStopInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => handleTool('watch_run_stop', input.responseFormat, () => stopWatchRunHandler(input.watchId)),
  );

  server.registerTool(
    'codex_reply',
    {
      description:
        'Send an operator reply to a live Codex child session. Target either sessionId directly or runPath plus storyId; run-targeted replies are journaled with a redacted preview and hash.',
      inputSchema: codexReplyInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => handleTool('codex_reply', input.responseFormat, () => sendCodexReply(input)),
  );

  server.registerTool(
    'codex_interrupt',
    {
      description:
        'Interrupt a live Codex child session. Target either sessionId directly or runPath plus storyId; run-targeted interrupts are journaled.',
      inputSchema: codexInterruptInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => handleTool('codex_interrupt', input.responseFormat, () => sendCodexInterrupt(input)),
  );

  server.registerTool(
    'analyze_run',
    {
      description:
        'Analyze a completed run artifact directory and child session artifacts, including compatible interactive implement-next journals. Use after watch_run shows the run is complete or blocked.',
      inputSchema: runPathInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool(
        'analyze_run',
        input.responseFormat,
        async () => {
          const analysis = await analyzeRunHandler(input.runPath, toOverrides(input));
          return input.responseFormat === 'detailed' ? analysis : conciseAnalysisContent(analysis);
        },
        summarizeAnalysis,
      ),
  );

  server.registerTool(
    'check_codex_mcp',
    {
      description:
        'Validate the Codex child MCP server schema used by the codex-mcp driver before launching non-dry-run children.',
      inputSchema: baseInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('check_codex_mcp', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return mcpCheckHandler(toOverrides(input), { logger: nullLogger });
      }),
  );
}

function assertWorkflowRepoContext(input: { cwd?: string; configPath?: string }): void {
  if (input.cwd !== undefined || input.configPath !== undefined) return;

  const implicitCwd = process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD) : process.cwd();
  if (existsSync(path.join(implicitCwd, '.workflow', 'config.yaml'))) return;

  throw new Error(
    `Target repo cwd is required for agentic-workflow-kit MCP tools when the session is not running from a workflow repo. Pass cwd as the target repository root. Checked: ${implicitCwd}`,
  );
}

function toOverrides(input: {
  cwd?: string;
  configPath?: string;
  track?: string;
  tracksDir?: string;
  maxParallel?: number;
  json?: boolean;
  requestId?: string;
  dryRun?: boolean;
  force?: boolean;
  watch?: boolean;
  wait?: boolean;
  intervalMs?: number;
  timeoutMs?: number;
  asyncLaunch?: boolean;
  childTimeoutMs?: number;
  model?: string;
  reasoning?: string;
  approvalPolicy?: CliOverrides['approvalPolicy'];
  sandbox?: CliOverrides['sandbox'];
  sessionRoot?: string;
  responseFormat?: 'concise' | 'detailed';
}): CliOverrides {
  const overrides: CliOverrides = {};
  if (input.cwd !== undefined) overrides.cwd = input.cwd;
  if (input.configPath !== undefined) overrides.configPath = input.configPath;
  if (input.track !== undefined) overrides.track = input.track;
  if (input.tracksDir !== undefined) overrides.tracksDir = input.tracksDir;
  if (input.maxParallel !== undefined) overrides.maxParallel = input.maxParallel;
  if (input.json === true) overrides.json = true;
  if (input.requestId !== undefined) overrides.requestId = input.requestId;
  if (input.dryRun === true) overrides.dryRun = true;
  if (input.asyncLaunch === true) overrides.asyncLaunch = true;
  if (input.force === true) overrides.force = true;
  if (input.watch !== undefined) overrides.watch = input.watch;
  if (input.wait !== undefined) overrides.wait = input.wait;
  if (input.intervalMs !== undefined) overrides.intervalMs = input.intervalMs;
  if (input.timeoutMs !== undefined) overrides.timeoutMs = input.timeoutMs;
  if (input.childTimeoutMs !== undefined) overrides.childTimeoutMs = input.childTimeoutMs;
  if (input.model !== undefined) overrides.model = input.model;
  if (input.reasoning !== undefined) overrides.reasoning = input.reasoning;
  if (input.approvalPolicy !== undefined) overrides.approvalPolicy = input.approvalPolicy;
  if (input.sandbox !== undefined) overrides.sandbox = input.sandbox;
  if (input.sessionRoot !== undefined) overrides.sessionRoot = input.sessionRoot;
  return overrides;
}

async function handleTool<T>(
  tool: string,
  responseFormat: 'concise' | 'detailed' | undefined,
  operation: () => Promise<T>,
  summarize: (value: T) => string = () => `${tool} completed`,
): Promise<CallToolResult> {
  try {
    const value = await operation();
    return toolResult(tool, value, responseFormat, summarize(value));
  } catch (error) {
    return toolError(error);
  }
}

function toolResult(
  tool: string,
  value: unknown,
  responseFormat: 'concise' | 'detailed' | undefined,
  summary = `${tool} completed`,
): CallToolResult {
  const { content, truncated, paths } = boundedObjectContent(value, responseFormat);
  return {
    content: [{ type: 'text', text: truncated ? `${summary}; structuredContent truncated` : summary }],
    structuredContent: truncated
      ? {
          ...content,
          truncated: true,
          truncation: {
            message:
              'Structured MCP response was shortened. Narrow the request with track or use responseFormat=detailed.',
            paths,
          },
        }
      : content,
  };
}

function toolError(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
    structuredContent: { error: message },
  };
}

function boundedObjectContent(
  value: unknown,
  responseFormat: 'concise' | 'detailed' | undefined,
): { content: Record<string, unknown>; truncated: boolean; paths: string[] } {
  const limits =
    responseFormat === 'detailed'
      ? { arrayItems: 250, stringChars: 40_000, jsonChars: 120_000 }
      : { arrayItems: 50, stringChars: 10_000, jsonChars: 60_000 };
  const paths: string[] = [];
  const bounded = boundValue(objectContent(value), '$', limits, paths);
  return {
    content: bounded.content as Record<string, unknown>,
    truncated: bounded.truncated,
    paths,
  };
}

function objectContent(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { value };
}

function boundValue(
  value: unknown,
  pathName: string,
  limits: { arrayItems: number; stringChars: number; jsonChars: number },
  paths: string[],
): { content: unknown; truncated: boolean } {
  if (typeof value === 'string') {
    if (value.length <= limits.stringChars) return { content: value, truncated: false };
    paths.push(pathName);
    return {
      content: `${value.slice(0, limits.stringChars)}\n[truncated ${value.length - limits.stringChars} chars]`,
      truncated: true,
    };
  }
  if (Array.isArray(value)) {
    const items = value
      .slice(0, limits.arrayItems)
      .map((item, index) => boundValue(item, `${pathName}[${index}]`, limits, paths));
    const truncated = items.some((item) => item.truncated) || value.length > limits.arrayItems;
    if (value.length > limits.arrayItems) paths.push(pathName);
    return {
      content:
        value.length > limits.arrayItems
          ? [...items.map((item) => item.content), { truncatedCount: value.length - limits.arrayItems }]
          : items.map((item) => item.content),
      truncated,
    };
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const content: Record<string, unknown> = {};
    let truncated = false;
    for (const [key, child] of entries) {
      const bounded = boundValue(child, `${pathName}.${key}`, limits, paths);
      content[key] = bounded.content;
      truncated = truncated || bounded.truncated;
    }
    const serializedLength = JSON.stringify(content).length;
    if (serializedLength > limits.jsonChars) {
      paths.push(pathName);
      return {
        content: {
          truncated: true,
          summary: `Object exceeded ${limits.jsonChars} JSON characters after field-level truncation.`,
          keys: Object.keys(content),
        },
        truncated: true,
      };
    }
    return { content, truncated };
  }
  return { content: value, truncated: false };
}

function summarizeRun(result: RunState): string {
  if (result.status === 'running') return `run ${result.runId} launched with status running`;
  return `run ${result.runId} finished with status ${result.status}`;
}

function summarizeAnalysis(value: unknown): string {
  if (!isPlainObject(value)) return 'analyze_run completed';
  const runId = typeof value.runId === 'string' ? value.runId : 'unknown';
  const status = typeof value.derivedStatus === 'string' ? value.derivedStatus : value.status;
  const issueCount = Array.isArray(value.issues) ? value.issues.length : 0;
  return `run ${runId} analysis status ${String(status ?? 'unknown')} with ${issueCount} issue(s)`;
}

function conciseAnalysisContent(value: unknown): unknown {
  if (!isPlainObject(value)) return value;
  return {
    runId: value.runId,
    status: value.status,
    derivedStatus: value.derivedStatus,
    blockedReason: value.blockedReason,
    issues: Array.isArray(value.issues) ? value.issues.slice(0, 20) : [],
    children: Array.isArray(value.children) ? value.children.slice(0, 20).map(conciseChildAnalysis) : [],
    review: value.review,
    verification: value.verification,
    merge: value.merge,
  };
}

function conciseChildAnalysis(value: unknown): unknown {
  if (!isPlainObject(value)) return value;
  return {
    storyId: value.storyId,
    ok: value.ok,
    status: value.status,
    sessionId: value.sessionId,
    sessionLogPath: value.sessionLogPath,
    linkageStatus: value.linkageStatus,
    metricsStatus: value.metricsStatus,
    completionAuthority: value.completionAuthority,
    completionAuthoritySource: value.completionAuthoritySource,
    staleParentSnapshot: value.staleParentSnapshot,
    progress: value.progress,
    verification: value.verification,
    merge: value.merge,
    recoveryEvents: value.recoveryEvents,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const noopStdout = (): void => undefined;

const nullLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
