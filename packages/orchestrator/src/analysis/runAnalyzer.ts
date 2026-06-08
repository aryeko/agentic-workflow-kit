import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { isNodeError, isRecord } from '../internal/guards.js';
import { addTokenTotals, emptyTokenTotals, mergeCounts } from '../metrics/aggregate.js';
import type { TokenTotals } from '../types.js';

interface AnalyzeOptions {
  sessionRoots?: string[];
}

export interface WorkflowRunAnalysis {
  runId: string;
  status: string;
  derivedStatus: string;
  blockedReason: string | null;
  issues: string[];
  children: AnalyzedChild[];
  commandCounts: Record<string, number>;
  subagentCounts: Record<string, number>;
  tokenTotals: TokenTotals | null;
}

interface AnalyzedChild {
  storyId: string;
  ok: boolean;
  sessionId: string | null;
  sessionLogPath: string | null;
  status: string;
  expectedBranch: string | null;
  expectedWorktreePath: string | null;
}

export async function analyzeWorkflowRun(
  runDirectory: string,
  options: AnalyzeOptions = {},
): Promise<WorkflowRunAnalysis> {
  const state = await readJsonObject(path.join(runDirectory, 'state.json'));
  const children = await readChildren(path.join(runDirectory, 'children'), state);
  const sessionLogs = await findSessionLogs(options.sessionRoots ?? defaultSessionRoots());
  const logsBySession = await mapSessionLogsByThread(sessionLogs);

  const commandCounts: Record<string, number> = {};
  const subagentCounts: Record<string, number> = {};
  const issues: string[] = [];
  let tokenTotals: TokenTotals = emptyTokenTotals();
  let sawTokens = false;

  const analyzedChildren: AnalyzedChild[] = [];
  for (const child of children) {
    const sessionId =
      typeof child.sessionId === 'string'
        ? child.sessionId
        : typeof child.threadId === 'string'
          ? child.threadId
          : null;
    const sessionLogPath = sessionId ? (logsBySession.get(sessionId) ?? null) : null;
    const storyId = readString(child.storyId, 'child.storyId');
    const status = deriveChildStatus(state, child);
    if (child.launchOnly === true && status === 'supervision_lost') {
      issues.push(`${storyId} has launch metadata but no settled child result`);
    }
    analyzedChildren.push({
      storyId,
      ok: child.ok === true,
      sessionId,
      sessionLogPath,
      status,
      expectedBranch: typeof child.expectedBranch === 'string' ? child.expectedBranch : null,
      expectedWorktreePath: typeof child.expectedWorktreePath === 'string' ? child.expectedWorktreePath : null,
    });

    if (!sessionLogPath) continue;

    const sessionMetrics = await analyzeSessionLog(sessionLogPath);
    mergeCounts(commandCounts, sessionMetrics.commandCounts);
    mergeCounts(subagentCounts, sessionMetrics.subagentCounts);
    if (sessionMetrics.tokenTotals) {
      sawTokens = true;
      tokenTotals = addTokenTotals(tokenTotals, sessionMetrics.tokenTotals);
    }
  }

  const status = readString(state.status, 'state.status');

  return {
    runId: readString(state.runId, 'state.runId'),
    status,
    derivedStatus: deriveRunStatus(status, analyzedChildren),
    blockedReason: typeof state.blockedReason === 'string' ? state.blockedReason : null,
    issues,
    children: analyzedChildren,
    commandCounts,
    subagentCounts,
    tokenTotals: sawTokens ? tokenTotals : null,
  };
}

async function readChildren(
  childrenDirectory: string,
  state: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  let names: string[];
  try {
    names = await readdir(childrenDirectory);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return interactiveStateChildren(state);
    throw error;
  }
  const childFiles = names
    .filter(
      (name) =>
        name.endsWith('.json') &&
        !name.endsWith('.launch.json') &&
        !name.endsWith('.raw.json') &&
        !name.endsWith('.metrics.json'),
    )
    .sort();
  const settled = await Promise.all(childFiles.map((name) => readJsonObject(path.join(childrenDirectory, name))));
  const launches = await readLaunches(childrenDirectory, names);
  if (settled.length === 0 && launches.length === 0) return interactiveStateChildren(state);
  return mergeChildren(settled, launches);
}

function interactiveStateChildren(state: Record<string, unknown>): Record<string, unknown>[] {
  if (state.command !== 'implement-next' || !isRecord(state.interactive)) return [];
  return [state.interactive];
}

async function readLaunches(childrenDirectory: string, names: string[]): Promise<Record<string, unknown>[]> {
  const launchFiles = names.filter((name) => name.endsWith('.launch.json')).sort();
  return await Promise.all(launchFiles.map((name) => readJsonObject(path.join(childrenDirectory, name))));
}

function mergeChildren(
  settledChildren: Record<string, unknown>[],
  launchRecords: Record<string, unknown>[],
): Record<string, unknown>[] {
  const byStory = new Map<string, Record<string, unknown>>();
  for (const launch of launchRecords) {
    if (typeof launch.storyId === 'string') byStory.set(launch.storyId, { ...launch, launchOnly: true });
  }
  for (const settled of settledChildren) {
    if (typeof settled.storyId !== 'string') continue;
    const launch = byStory.get(settled.storyId);
    byStory.set(settled.storyId, launch ? { ...launch, ...settled, launchOnly: false } : settled);
  }
  return [...byStory.values()].sort((a, b) =>
    readString(a.storyId, 'child.storyId').localeCompare(readString(b.storyId, 'child.storyId')),
  );
}

function deriveChildStatus(state: Record<string, unknown>, child: Record<string, unknown>): string {
  if (child.launchOnly === true && state.status === 'running') return 'supervision_lost';
  if (typeof child.status === 'string') return child.status;
  return 'settled';
}

function deriveRunStatus(status: string, children: AnalyzedChild[]): string {
  if (status === 'running' && children.some((child) => child.status === 'supervision_lost')) {
    return 'supervision_lost';
  }
  return status;
}

async function findSessionLogs(roots: string[]): Promise<string[]> {
  const logs: string[] = [];
  for (const root of roots) {
    if (!(await pathExists(root))) continue;
    await walkJsonl(root, logs);
  }
  return logs;
}

async function walkJsonl(directory: string, logs: string[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walkJsonl(entryPath, logs);
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      logs.push(entryPath);
    }
  }
}

async function mapSessionLogsByThread(sessionLogs: string[]): Promise<Map<string, string>> {
  const byThread = new Map<string, string>();
  for (const sessionLog of sessionLogs) {
    const content = await readFile(sessionLog, 'utf8');
    for (const line of content.split('\n')) {
      const entry = parseJsonLine(line);
      if (entry?.type !== 'session_meta' || !isRecord(entry.payload)) continue;
      const id = entry.payload.id;
      if (typeof id === 'string' && !byThread.has(id)) {
        byThread.set(id, sessionLog);
      }
    }
  }
  return byThread;
}

async function analyzeSessionLog(sessionLog: string): Promise<{
  commandCounts: Record<string, number>;
  subagentCounts: Record<string, number>;
  tokenTotals: TokenTotals | null;
}> {
  const commandCounts: Record<string, number> = {};
  const subagentCounts: Record<string, number> = {};
  let tokenTotals: TokenTotals | null = null;

  const content = await readFile(sessionLog, 'utf8');
  for (const line of content.split('\n')) {
    const entry = parseJsonLine(line);
    if (!entry || !isRecord(entry.payload)) continue;

    if (entry.type === 'response_item' && isRecord(entry.payload)) {
      const payload = entry.payload;
      if (
        (payload.type === 'function_call' || payload.type === 'custom_tool_call') &&
        typeof payload.name === 'string'
      ) {
        increment(commandCounts, payload.name);
      }
      if (payload.type === 'function_call' && payload.name === 'spawn_agent' && typeof payload.arguments === 'string') {
        const parsedArgs = parseJsonLine(payload.arguments);
        if (parsedArgs && typeof parsedArgs.agent_type === 'string') {
          increment(subagentCounts, parsedArgs.agent_type);
        }
      }
    }

    if (entry.type === 'event_msg' && entry.payload.type === 'token_count' && isRecord(entry.payload.info)) {
      const usage = entry.payload.info.total_token_usage;
      if (isRecord(usage)) {
        tokenTotals = {
          inputTokens: readNumber(usage.input_tokens),
          cachedInputTokens: readNumber(usage.cached_input_tokens),
          outputTokens: readNumber(usage.output_tokens),
          reasoningOutputTokens: readNumber(usage.reasoning_output_tokens),
          totalTokens: readNumber(usage.total_tokens),
        };
      }
    }
  }

  return { commandCounts, subagentCounts, tokenTotals };
}

function defaultSessionRoots(): string[] {
  const home = process.env.HOME;
  return home ? [path.join(home, '.codex', 'sessions'), path.join(home, '.codex', 'archived_sessions')] : [];
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown>> {
  const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) throw new Error(`${filePath} must contain a JSON object`);
  return parsed;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseJsonLine(line: string): Record<string, unknown> | null {
  if (line.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(line) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function readString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  return value;
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
