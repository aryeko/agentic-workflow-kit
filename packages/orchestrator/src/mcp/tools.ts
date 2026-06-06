import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  analyzeRunHandler,
  listEligibleHandler,
  listStoriesHandler,
  listTracksHandler,
  mcpCheckHandler,
  runWorkflowHandler,
  watchRunHandler,
} from '../commands/handlers.js';
import type { CliOverrides, Logger, RunState } from '../types.js';

export const ORCHESTRATOR_MCP_TOOLS = [
  'list_tracks',
  'list_stories',
  'list_eligible',
  'run_eligible',
  'run_story',
  'watch_run',
  'analyze_run',
  'check_codex_mcp',
] as const;

const baseInputSchema = z.object({
  cwd: z.string().optional(),
  configPath: z.string().optional(),
  track: z.string().optional(),
  tracksDir: z.string().optional(),
  maxParallel: z.number().int().positive().optional(),
  json: z.boolean().optional(),
});

const runInputSchema = baseInputSchema.extend({
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
  watch: z.boolean().optional(),
  childTimeoutMs: z.number().int().positive().optional(),
  model: z.string().optional(),
  reasoning: z.string().optional(),
  approvalPolicy: z.enum(['never', 'on-failure', 'on-request', 'untrusted']).optional(),
  sandbox: z.enum(['danger-full-access', 'read-only', 'workspace-write']).optional(),
});

const runStoryInputSchema = runInputSchema.extend({
  storyId: z.string(),
});

const runPathInputSchema = z.object({
  runPath: z.string(),
  sessionRoot: z.string().optional(),
  json: z.boolean().optional(),
});

export function registerOrchestratorTools(server: McpServer): void {
  server.registerTool(
    'list_tracks',
    {
      description: 'Discover agentic-workflow-kit tracker directories and active tracks.',
      inputSchema: baseInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => toolResult('list_tracks', await listTracksHandler(toOverrides(input))),
  );

  server.registerTool(
    'list_stories',
    {
      description: 'Parse tracker stories for one track or all active tracks.',
      inputSchema: baseInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => toolResult('list_stories', await listStoriesHandler(toOverrides(input))),
  );

  server.registerTool(
    'list_eligible',
    {
      description: 'Return tracker stories eligible for dispatch after status, owner, and dependency filtering.',
      inputSchema: baseInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => toolResult('list_eligible', await listEligibleHandler(toOverrides(input))),
  );

  server.registerTool(
    'run_eligible',
    {
      description: 'Dry-run or launch eligible stories for a single track. Defaults to dry-run unless dryRun is false.',
      inputSchema: runInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => {
      const overrides = toOverrides({ ...input, dryRun: input.dryRun !== false });
      const result = await runWorkflowHandler(
        { kind: 'run-eligible', overrides },
        { logger: nullLogger, stdout: noopStdout },
      );
      return toolResult('run_eligible', result, summarizeRun(result));
    },
  );

  server.registerTool(
    'run_story',
    {
      description: 'Dry-run or launch a specific tracker story. Defaults to dry-run unless dryRun is false.',
      inputSchema: runStoryInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => {
      const overrides = toOverrides({ ...input, dryRun: input.dryRun !== false });
      const result = await runWorkflowHandler(
        { kind: 'run-story', storyId: input.storyId, overrides },
        { logger: nullLogger, stdout: noopStdout },
      );
      return toolResult('run_story', result, summarizeRun(result));
    },
  );

  server.registerTool(
    'watch_run',
    {
      description: 'Read the current state and live metrics snapshot for a run artifact directory.',
      inputSchema: runPathInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => toolResult('watch_run', await watchRunHandler(input.runPath, toOverrides(input))),
  );

  server.registerTool(
    'analyze_run',
    {
      description: 'Analyze a completed run artifact directory and child session artifacts.',
      inputSchema: runPathInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => toolResult('analyze_run', await analyzeRunHandler(input.runPath, toOverrides(input))),
  );

  server.registerTool(
    'check_codex_mcp',
    {
      description: 'Validate the Codex child MCP server schema used by the codex-mcp driver.',
      inputSchema: baseInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => toolResult('check_codex_mcp', await mcpCheckHandler(toOverrides(input), { logger: nullLogger })),
  );
}

function toOverrides(input: {
  cwd?: string;
  configPath?: string;
  track?: string;
  tracksDir?: string;
  maxParallel?: number;
  json?: boolean;
  dryRun?: boolean;
  force?: boolean;
  watch?: boolean;
  childTimeoutMs?: number;
  model?: string;
  reasoning?: string;
  approvalPolicy?: CliOverrides['approvalPolicy'];
  sandbox?: CliOverrides['sandbox'];
  sessionRoot?: string;
}): CliOverrides {
  const overrides: CliOverrides = {};
  if (input.cwd !== undefined) overrides.cwd = input.cwd;
  if (input.configPath !== undefined) overrides.configPath = input.configPath;
  if (input.track !== undefined) overrides.track = input.track;
  if (input.tracksDir !== undefined) overrides.tracksDir = input.tracksDir;
  if (input.maxParallel !== undefined) overrides.maxParallel = input.maxParallel;
  if (input.json === true) overrides.json = true;
  if (input.dryRun === true) overrides.dryRun = true;
  if (input.force === true) overrides.force = true;
  if (input.watch === true) overrides.watch = true;
  if (input.childTimeoutMs !== undefined) overrides.childTimeoutMs = input.childTimeoutMs;
  if (input.model !== undefined) overrides.model = input.model;
  if (input.reasoning !== undefined) overrides.reasoning = input.reasoning;
  if (input.approvalPolicy !== undefined) overrides.approvalPolicy = input.approvalPolicy;
  if (input.sandbox !== undefined) overrides.sandbox = input.sandbox;
  if (input.sessionRoot !== undefined) overrides.sessionRoot = input.sessionRoot;
  return overrides;
}

function toolResult(tool: string, value: unknown, summary = `${tool} completed`): CallToolResult {
  return {
    content: [{ type: 'text', text: summary }],
    structuredContent: objectContent(value),
  };
}

function objectContent(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function summarizeRun(result: RunState): string {
  return `run ${result.runId} finished with status ${result.status}`;
}

const noopStdout = (): void => undefined;

const nullLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
