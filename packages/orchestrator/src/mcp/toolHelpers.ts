import { existsSync } from 'node:fs';
import path from 'node:path';
import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { projectInspectFacade, runReportFacade, runStatusFacade } from '../api/facade.js';
import { resolveInvocationCwd } from '../cli/args.js';
import { listTracksHandler } from '../commands/handlers.js';
import { loadResolvedConfig } from '../config/configLoader.js';
import { CodexMcpStoryRunner } from '../drivers/codex-mcp/CodexMcpStoryRunner.js';
import type { ChildControlRequest, ChildControlResult } from '../drivers/StoryRunner.js';
import type { CliOverrides, Logger, RunState } from '../types.js';

export function registerWorkflowResources(server: McpServer): void {
  server.registerResource(
    'workflow-project-context',
    'workflow://project/context',
    { mimeType: 'application/json', description: 'WorkflowKit project context and capabilities.' },
    async (uri) => resourceJson(uri, await projectInspectFacade({})),
  );
  server.registerResource(
    'workflow-config-resolved',
    'workflow://config/resolved',
    { mimeType: 'application/json', description: 'Resolved WorkflowKit config with defaults.' },
    async (uri) => resourceJson(uri, await loadResolvedConfig({}, resolveInvocationCwd({}))),
  );
  server.registerResource(
    'workflow-tracks',
    'workflow://tracks',
    { mimeType: 'application/json', description: 'WorkflowKit track index.' },
    async (uri) => resourceJson(uri, await listTracksHandler({})),
  );
  server.registerResource(
    'workflow-run-state',
    new ResourceTemplate('workflow://runs/{runId}/state', { list: undefined }),
    { mimeType: 'application/json', description: 'WorkflowKit run state snapshot.' },
    async (uri, variables) => resourceJson(uri, await runStatusFacade({ runId: String(variables.runId) })),
  );
  server.registerResource(
    'workflow-run-events',
    new ResourceTemplate('workflow://runs/{runId}/events', { list: undefined }),
    { mimeType: 'application/json', description: 'WorkflowKit bounded run event tail.' },
    async (uri, variables) =>
      resourceJson(uri, await runStatusFacade({ runId: String(variables.runId), events: { limit: 50 } })),
  );
  server.registerResource(
    'workflow-run-report',
    new ResourceTemplate('workflow://runs/{runId}/report', { list: undefined }),
    { mimeType: 'application/json', description: 'WorkflowKit run report envelope.' },
    async (uri, variables) =>
      resourceJson(uri, await runReportFacade({ runId: String(variables.runId), write: false })),
  );
}

export function resourceJson(uri: URL, value: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function assertWorkflowRepoContext(input: { cwd?: string; configPath?: string }): void {
  if (input.cwd !== undefined || input.configPath !== undefined) return;

  const implicitCwd = process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD) : process.cwd();
  if (existsSync(path.join(implicitCwd, '.workflow', 'config.yaml'))) return;

  throw new Error(
    `Target repo cwd is required for agentic-workflow-kit MCP tools when the session is not running from a workflow repo. Pass cwd as the target repository root. Checked: ${implicitCwd}`,
  );
}

export async function controlConfiguredChild(
  input: { cwd?: string; configPath?: string; sessionId?: string; runPath?: string; storyId?: string },
  request: Pick<ChildControlRequest, 'kind' | 'message' | 'reason'>,
): Promise<ChildControlResult> {
  const cwd = resolveChildControlCwd(input);
  const config = await loadResolvedConfig(toOverrides(input), cwd);
  const runner = new CodexMcpStoryRunner(config);
  const result = await runner.controlChild?.({
    ...request,
    sessionId: input.sessionId,
    runPath: input.runPath,
    storyId: input.storyId,
  });
  if (!result) throw new Error('configured child driver does not support child control');
  return result;
}

export function resolveChildControlCwd(input: { cwd?: string; configPath?: string; runPath?: string }): string {
  if (input.cwd !== undefined || input.configPath !== undefined) return resolveInvocationCwd(input);
  if (input.runPath !== undefined) {
    const runPath = path.resolve(input.runPath);
    const marker = `${path.sep}.codex${path.sep}agentic-workflow-kit${path.sep}runs${path.sep}`;
    const markerIndex = runPath.indexOf(marker);
    if (markerIndex > 0) return runPath.slice(0, markerIndex);
  }
  return resolveInvocationCwd(input);
}

export function toOverrides(input: {
  cwd?: string;
  configPath?: string;
  track?: string;
  tracksDir?: string;
  maxParallel?: number;
  json?: boolean;
  requestId?: string;
  dryRun?: boolean;
  confirmNonDryRun?: boolean;
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
  format?: CliOverrides['format'];
  out?: string;
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
  if (input.confirmNonDryRun === true) overrides.confirmNonDryRun = true;
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
  if (input.format !== undefined) overrides.format = input.format;
  if (input.out !== undefined) overrides.out = input.out;
  return overrides;
}

export async function handleTool<T>(
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

export function toolResult(
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

export function toolError(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
    structuredContent: { error: message },
  };
}

export function boundedObjectContent(
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

export function objectContent(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { value };
}

export function boundValue(
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

export function summarizeRun(result: RunState): string {
  if (result.status === 'running') return `run ${result.runId} launched with status running`;
  return `run ${result.runId} finished with status ${result.status}`;
}

export function summarizeAnalysis(value: unknown): string {
  if (!isPlainObject(value)) return 'analyze_run completed';
  const runId = typeof value.runId === 'string' ? value.runId : 'unknown';
  const status = typeof value.derivedStatus === 'string' ? value.derivedStatus : value.status;
  const issueCount = Array.isArray(value.issues) ? value.issues.length : 0;
  return `run ${runId} analysis status ${String(status ?? 'unknown')} with ${issueCount} issue(s)`;
}

export function conciseAnalysisContent(value: unknown): unknown {
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

export function conciseChildAnalysis(value: unknown): unknown {
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

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const noopStdout = (): void => undefined;

export const nullLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
