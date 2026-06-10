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
  review: ReviewSummary;
  verification: VerificationSummary;
  merge: MergeSummary;
  timeline: TimelineEvent[];
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

interface ReviewSummary {
  prePr: PrePrReviewSummary;
  pr: PrReviewSummary;
}

interface PrePrReviewSummary {
  requestedMode: string | null;
  actualMode: string | null;
  status: 'not_configured' | 'not_started' | 'downgraded' | 'blocked' | 'passed' | 'findings';
  warnings: string[];
  blockers: string[];
  maxLoops: number | null;
  loopMode: string | null;
  loops: PrePrReviewLoop[];
  subagent: {
    agentId: string | null;
    status: string | null;
  };
}

interface PrePrReviewLoop {
  loop: number | null;
  mode: string | null;
  status: string;
  findings: number | null;
}

interface PrReviewSummary {
  findings: PrReviewFinding[];
  fixBatchCount: number;
  rerequestAfterFix: boolean | null;
}

interface PrReviewFinding {
  severity: string | null;
  summary: string;
  file: string | null;
}

interface VerificationSummary {
  commands: VerificationCommandSummary[];
  finalPassedAt: string | null;
}

interface VerificationCommandSummary {
  phase: string | null;
  command: string | null;
  status: string;
  eventAt: string | null;
}

interface MergeSummary {
  merged: boolean;
  mergedAt: string | null;
  cleanupStatus: string | null;
  mergeBeforeFinalVerification: boolean;
}

interface TimelineEvent {
  type: string;
  eventAt: string | null;
  recordedAt: string | null;
  index: number;
}

interface NormalizedEvent extends TimelineEvent {
  raw: Record<string, unknown>;
}

export async function analyzeWorkflowRun(
  runDirectory: string,
  options: AnalyzeOptions = {},
): Promise<WorkflowRunAnalysis> {
  const state = await readJsonObject(path.join(runDirectory, 'state.json'));
  const [config, events] = await Promise.all([
    readJsonObjectIfExists(path.join(runDirectory, 'config.resolved.json')),
    readEvents(path.join(runDirectory, 'events.ndjson')),
  ]);
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
  const eventSummary = summarizeEvents(events, config);

  return {
    runId: readString(state.runId, 'state.runId'),
    status,
    derivedStatus: deriveRunStatus(status, analyzedChildren),
    blockedReason: typeof state.blockedReason === 'string' ? state.blockedReason : null,
    issues: [...issues, ...eventSummary.issues],
    children: analyzedChildren,
    commandCounts,
    subagentCounts,
    tokenTotals: sawTokens ? tokenTotals : null,
    review: eventSummary.review,
    verification: eventSummary.verification,
    merge: eventSummary.merge,
    timeline: eventSummary.timeline,
  };
}

function summarizeEvents(
  events: NormalizedEvent[],
  config: Record<string, unknown> | null,
): {
  issues: string[];
  review: ReviewSummary;
  verification: VerificationSummary;
  merge: MergeSummary;
  timeline: TimelineEvent[];
} {
  const prePrConfig = readPrePrConfig(config);
  const prReviewConfig = readPrReviewConfig(config);
  const warnings: string[] = [];
  const blockers: string[] = [];
  const loops: PrePrReviewLoop[] = [];
  const prFindings: PrReviewFinding[] = [];
  const verificationCommands: VerificationCommandSummary[] = [];
  const issues: string[] = [];

  let requestedMode = prePrConfig.requestedMode;
  let actualMode: string | null = null;
  let prePrStatus: PrePrReviewSummary['status'] = prePrConfig.configured ? 'not_started' : 'not_configured';
  let subagentAgentId: string | null = null;
  let subagentStatus: string | null = null;
  let fixBatchCount = 0;
  let rerequestAfterFix = prReviewConfig.rerequestAfterFix;
  let latestReviewFixAt: string | null = null;
  let finalPassedAt: string | null = null;
  let mergedAt: string | null = null;
  let cleanupStatus: string | null = null;

  for (const event of events) {
    if (event.type === 'pre_pr_review_started') {
      requestedMode = readRequestedMode(event.raw) ?? requestedMode;
      actualMode = readActualMode(event.raw) ?? actualMode;
    }

    if (event.type === 'pre_pr_review_downgraded') {
      const from = readRequestedMode(event.raw) ?? requestedMode ?? 'unknown';
      const to = readActualMode(event.raw) ?? 'inline';
      const reason = readOptionalString(event.raw.reason) ?? 'no reason recorded';
      requestedMode = from;
      actualMode = to;
      prePrStatus = 'downgraded';
      warnings.push(`pre-PR review downgraded from ${from} to ${to}: ${reason}`);
    }

    if (event.type === 'pre_pr_review_blocked') {
      const reason = readOptionalString(event.raw.reason) ?? 'subagent review could not run';
      requestedMode = readRequestedMode(event.raw) ?? requestedMode;
      actualMode = readActualMode(event.raw) ?? actualMode;
      prePrStatus = 'blocked';
      blockers.push(`pre-PR review blocked: ${reason}`);
    }

    if (event.type === 'pre_pr_review_findings') {
      actualMode = readActualMode(event.raw) ?? actualMode;
      prePrStatus = prePrStatus === 'blocked' ? prePrStatus : 'findings';
      loops.push({
        loop: readOptionalNumber(event.raw.loop),
        mode: readActualMode(event.raw),
        status: 'findings',
        findings: countFindings(event.raw.findings),
      });
    }

    if (event.type === 'pre_pr_review_cleared') {
      const eventMode = readActualMode(event.raw);
      actualMode = eventMode ?? actualMode;
      if (prePrStatus !== 'downgraded' && prePrStatus !== 'blocked') prePrStatus = 'passed';
      loops.push({
        loop: readOptionalNumber(event.raw.loop),
        mode: eventMode,
        status: 'passed',
        findings: 0,
      });
      if (eventMode?.startsWith('subagent') || typeof event.raw.agentId === 'string') {
        subagentAgentId = readOptionalString(event.raw.agentId) ?? subagentAgentId;
        subagentStatus = 'passed';
      }
    }

    if (event.type === 'pr_review_findings') {
      prFindings.push(...readPrFindings(event.raw));
    }

    if (event.type === 'pr_review_fix_batch' || event.type === 'pr_review_fix_pushed') {
      fixBatchCount += 1;
      rerequestAfterFix = readOptionalBoolean(event.raw.rerequestAfterFix) ?? rerequestAfterFix;
      latestReviewFixAt = event.eventAt;
      verificationCommands.push(...readVerificationCommands(event, null, 'verification'));
    }

    if (isVerificationEvent(event.type)) {
      const status = event.type.endsWith('_failed') ? 'failed' : (readOptionalString(event.raw.status) ?? 'passed');
      const phase =
        readOptionalString(event.raw.phase) ??
        (event.type.startsWith('final_') || event.raw.afterReviewFix === true ? 'final' : null);
      verificationCommands.push(...readVerificationCommands(event, phase, 'commands', status));
      if (status === 'passed' && phase === 'final') {
        finalPassedAt = maxIso(finalPassedAt, event.eventAt);
      }
    }

    if (event.type === 'merged') {
      mergedAt = event.eventAt;
    }

    if (event.type === 'cleanup_complete') {
      cleanupStatus = readOptionalString(event.raw.status) ?? 'complete';
    }
  }

  for (const warning of warnings) issues.push(warning);
  for (const blocker of blockers) issues.push(blocker);

  const hasReviewFixes = fixBatchCount > 0;
  const hasRequiredFinalVerification =
    !hasReviewFixes ||
    (finalPassedAt !== null &&
      latestReviewFixAt !== null &&
      compareNullableIso(finalPassedAt, latestReviewFixAt) >= 0 &&
      (mergedAt === null || compareNullableIso(finalPassedAt, mergedAt) <= 0));
  const mergeBeforeFinalVerification =
    hasReviewFixes && mergedAt !== null && finalPassedAt !== null && compareNullableIso(mergedAt, finalPassedAt) < 0;

  if (mergedAt !== null && hasReviewFixes && !hasRequiredFinalVerification) {
    issues.push(
      finalPassedAt === null
        ? 'merge occurred after PR review fixes without final verification'
        : 'merge occurred before final verification after PR review fixes completed',
    );
  }

  return {
    issues,
    review: {
      prePr: {
        requestedMode,
        actualMode,
        status: prePrStatus,
        warnings,
        blockers,
        maxLoops: prePrConfig.maxLoops,
        loopMode: prePrConfig.loopMode,
        loops,
        subagent: {
          agentId: subagentAgentId,
          status: subagentStatus,
        },
      },
      pr: {
        findings: prFindings,
        fixBatchCount,
        rerequestAfterFix,
      },
    },
    verification: {
      commands: verificationCommands,
      finalPassedAt,
    },
    merge: {
      merged: mergedAt !== null,
      mergedAt,
      cleanupStatus,
      mergeBeforeFinalVerification,
    },
    timeline: events.map(({ type, eventAt, recordedAt, index }) => ({ type, eventAt, recordedAt, index })),
  };
}

function readPrePrConfig(config: Record<string, unknown> | null): {
  configured: boolean;
  requestedMode: string | null;
  maxLoops: number | null;
  loopMode: string | null;
} {
  const implement = readRecord(config?.implement);
  const review = readRecord(implement?.review);
  const prePr = readRecord(review?.prePr);
  if (!prePr || prePr.enabled === false) {
    return {
      configured: false,
      requestedMode: null,
      maxLoops: null,
      loopMode: null,
    };
  }
  return {
    configured: true,
    requestedMode: readOptionalString(prePr?.mode),
    maxLoops: readOptionalNumber(prePr?.maxLoops),
    loopMode: readOptionalString(prePr?.loopMode),
  };
}

function readPrReviewConfig(config: Record<string, unknown> | null): { rerequestAfterFix: boolean | null } {
  const pr = readRecord(config?.pr);
  const review = readRecord(pr?.review);
  return { rerequestAfterFix: readOptionalBoolean(review?.rerequestAfterFix) };
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

async function readEvents(filePath: string): Promise<NormalizedEvent[]> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return [];
    throw error;
  }

  return content
    .split('\n')
    .map((line, index) => ({ entry: parseJsonLine(line), index }))
    .filter((item): item is { entry: Record<string, unknown>; index: number } => item.entry !== null)
    .map(({ entry, index }) => normalizeEvent(entry, index))
    .filter((event): event is NormalizedEvent => event !== null)
    .sort(compareEvents);
}

function normalizeEvent(entry: Record<string, unknown>, index: number): NormalizedEvent | null {
  const type = readOptionalString(entry.type) ?? readOptionalString(entry.event);
  if (!type) return null;
  const eventAt =
    readOptionalString(entry.eventAt) ??
    readOptionalString(entry.ts) ??
    readOptionalString(entry.time) ??
    readOptionalString(entry.recordedAt);
  const recordedAt =
    readOptionalString(entry.recordedAt) ?? readOptionalString(entry.ts) ?? readOptionalString(entry.time) ?? eventAt;
  return { type, eventAt, recordedAt, index, raw: entry };
}

function compareEvents(a: NormalizedEvent, b: NormalizedEvent): number {
  const byEventAt = compareNullableIso(a.eventAt, b.eventAt);
  if (byEventAt !== 0) return byEventAt;
  const byRecordedAt = compareNullableIso(a.recordedAt, b.recordedAt);
  return byRecordedAt === 0 ? a.index - b.index : byRecordedAt;
}

function readPrFindings(event: Record<string, unknown>): PrReviewFinding[] {
  const findings = Array.isArray(event.findings) ? event.findings : [event];
  return findings.flatMap((finding) => {
    if (!isRecord(finding)) return [];
    const summary =
      readOptionalString(finding.summary) ??
      readOptionalString(finding.message) ??
      readOptionalString(finding.title) ??
      null;
    if (!summary) return [];
    return [
      {
        severity: readOptionalString(finding.severity) ?? readOptionalString(finding.priority),
        summary,
        file: readOptionalString(finding.file) ?? readOptionalString(finding.path),
      },
    ];
  });
}

function readVerificationCommands(
  event: NormalizedEvent,
  phase: string | null,
  arrayField: 'commands' | 'verification',
  status = 'passed',
): VerificationCommandSummary[] {
  const command = readOptionalString(event.raw.command);
  const commands = Array.isArray(event.raw[arrayField])
    ? event.raw[arrayField].filter((entry): entry is string => typeof entry === 'string')
    : [];
  const values = command ? [command] : commands;
  if (values.length === 0) {
    return [{ phase, command: null, status, eventAt: event.eventAt }];
  }
  return values.map((value) => ({ phase, command: value, status, eventAt: event.eventAt }));
}

function readRequestedMode(event: Record<string, unknown>): string | null {
  return readOptionalString(event.requestedMode) ?? readOptionalString(event.from);
}

function readActualMode(event: Record<string, unknown>): string | null {
  return readOptionalString(event.actualMode) ?? readOptionalString(event.to) ?? readOptionalString(event.mode);
}

function countFindings(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function isVerificationEvent(type: string): boolean {
  return (
    type === 'verification_passed' ||
    type === 'verification_failed' ||
    type === 'final_verification_passed' ||
    type === 'final_verification_failed'
  );
}

function maxIso(current: string | null, candidate: string | null): string | null {
  if (candidate === null) return current;
  if (current === null) return candidate;
  return compareNullableIso(current, candidate) >= 0 ? current : candidate;
}

function compareNullableIso(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return Date.parse(a) - Date.parse(b);
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

async function readJsonObjectIfExists(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    return await readJsonObject(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return null;
    throw error;
  }
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

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
