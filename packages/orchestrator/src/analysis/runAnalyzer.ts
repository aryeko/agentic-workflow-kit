import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { isNodeError, isRecord } from '../internal/guards.js';
import { addTokenTotals, emptyTokenTotals, mergeCounts } from '../metrics/aggregate.js';
import type { TokenTotals } from '../types.js';

interface AnalyzeOptions {
  sessionRoots?: string[];
  now?: string;
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
  metricsStatus: 'available' | 'session_linkage_unavailable' | 'session_log_missing';
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
  fixBatchCount: number;
  maxLoopsReached: boolean;
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

interface SessionReviewLoop extends PrePrReviewLoop {
  agentId: string | null;
}

interface PrReviewSummary {
  findings: PrReviewFinding[];
  fixBatchCount: number;
  resolvedThreadCount: number;
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

interface AnalyzerIssue {
  key: string;
  message: string;
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
  const latestHeartbeatByStory = latestHeartbeats(events);
  const now = options.now ?? new Date().toISOString();
  const staleThresholdMs = readChildTimeoutMs(config);

  const commandCounts: Record<string, number> = {};
  const subagentCounts: Record<string, number> = {};
  const issues: string[] = [];
  let tokenTotals: TokenTotals = emptyTokenTotals();
  let sawTokens = false;
  const sessionReviewLoops: SessionReviewLoop[] = [];

  const analyzedChildren: AnalyzedChild[] = [];
  for (const child of children) {
    const sessionId =
      typeof child.sessionId === 'string'
        ? child.sessionId
        : typeof child.threadId === 'string'
          ? child.threadId
          : null;
    const explicitSessionLogPath =
      typeof child.sessionLogPath === 'string' && (await pathExists(child.sessionLogPath))
        ? child.sessionLogPath
        : null;
    const sessionLogPath = explicitSessionLogPath ?? (sessionId ? (logsBySession.get(sessionId) ?? null) : null);
    const storyId = readString(child.storyId, 'child.storyId');
    const expectedWorktreePath = typeof child.expectedWorktreePath === 'string' ? child.expectedWorktreePath : null;
    const status = deriveChildStatus(state, child, {
      sessionId,
      sessionLogPath,
      latestHeartbeatAt: latestHeartbeatByStory.get(storyId) ?? null,
      worktreeActivityAt: expectedWorktreePath ? await pathMtime(expectedWorktreePath) : null,
      now,
      staleThresholdMs,
    });
    if (child.launchOnly === true && status === 'supervision_lost') {
      issues.push(`${storyId} has launch metadata but no settled child result`);
    }
    analyzedChildren.push({
      storyId,
      ok: child.ok === true,
      sessionId,
      sessionLogPath,
      metricsStatus: childMetricsStatus(sessionId, sessionLogPath),
      status,
      expectedBranch: typeof child.expectedBranch === 'string' ? child.expectedBranch : null,
      expectedWorktreePath,
    });

    if (!sessionLogPath) continue;

    const sessionMetrics = await analyzeSessionLog(sessionLogPath);
    mergeCounts(commandCounts, sessionMetrics.commandCounts);
    mergeCounts(subagentCounts, sessionMetrics.subagentCounts);
    sessionReviewLoops.push(...sessionMetrics.reviewLoops);
    if (sessionMetrics.tokenTotals) {
      sawTokens = true;
      tokenTotals = addTokenTotals(tokenTotals, sessionMetrics.tokenTotals);
    }
  }

  const status = readString(state.status, 'state.status');
  const eventSummary = summarizeEvents(events, config);
  const review = mergeSessionReviewEvidence(eventSummary.review, sessionReviewLoops);

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
    review,
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
  const warnings: AnalyzerIssue[] = [];
  const blockers: AnalyzerIssue[] = [];
  const loops: PrePrReviewLoop[] = [];
  const prFindings: PrReviewFinding[] = [];
  const verificationCommands: VerificationCommandSummary[] = [];
  const issues: AnalyzerIssue[] = [];

  let requestedMode = prePrConfig.requestedMode;
  let actualMode: string | null = null;
  let prePrStatus: PrePrReviewSummary['status'] = prePrConfig.configured ? 'not_started' : 'not_configured';
  let subagentAgentId: string | null = null;
  let subagentStatus: string | null = null;
  let prePrFixBatchCount = 0;
  let prFixBatchCount = 0;
  let resolvedThreadCount = 0;
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
      warnings.push({
        key: `pre-pr-downgraded:${from}:${to}:${reason}`,
        message: `pre-PR review downgraded from ${from} to ${to}: ${reason}`,
      });
    }

    if (isPrePrFindingsEvent(event)) {
      const eventMode = readActualMode(event.raw);
      actualMode = eventMode ?? actualMode;
      if (prePrStatus !== 'blocked') prePrStatus = 'findings';
      loops.push({
        loop: readOptionalNumber(event.raw.loop) ?? nextReviewLoop(loops, prePrFixBatchCount),
        mode: eventMode,
        status: 'findings',
        findings: countFindings(event.raw.findings),
      });
    }

    if (isPrePrExecutionBlockedEvent(event)) {
      const reason = readOptionalString(event.raw.reason) ?? 'subagent review could not run';
      requestedMode = readRequestedMode(event.raw) ?? requestedMode;
      actualMode = readActualMode(event.raw) ?? actualMode;
      prePrStatus = 'blocked';
      blockers.push({
        key: `pre-pr-blocked:${reason}`,
        message: `pre-PR review blocked: ${reason}`,
      });
    }

    if (event.type === 'pre_pr_review_fix_batch_applied') {
      prePrFixBatchCount += 1;
    }

    if (isPrePrPassedEvent(event)) {
      const eventMode = readActualMode(event.raw);
      actualMode = eventMode ?? actualMode;
      if (prePrStatus !== 'downgraded' && prePrStatus !== 'blocked') prePrStatus = 'passed';
      loops.push({
        loop: readOptionalNumber(event.raw.loop) ?? lastReviewLoop(loops),
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

    if (isPrReviewFixBatchEvent(event.type)) {
      prFixBatchCount += 1;
      rerequestAfterFix = readOptionalBoolean(event.raw.rerequestAfterFix) ?? rerequestAfterFix;
      latestReviewFixAt = maxIso(latestReviewFixAt, event.eventAt);
      verificationCommands.push(...readVerificationCommands(event, null, 'verification'));
    }

    if (isPrReviewThreadResolvedEvent(event.type)) {
      resolvedThreadCount += 1;
      if (!isPrReviewFixBatchEvent(event.type)) {
        prFixBatchCount += 1;
        latestReviewFixAt = maxIso(latestReviewFixAt, event.eventAt);
      }
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

    if (event.type === 'merged' || event.type === 'pr_merged') {
      mergedAt = event.eventAt;
    }

    if (event.type === 'cleanup_complete') {
      cleanupStatus = readOptionalString(event.raw.status) ?? 'complete';
    }
  }

  issues.push(...warnings, ...blockers);

  const hasReviewFixes = prFixBatchCount > 0;
  const hasRequiredFinalVerification =
    !hasReviewFixes ||
    (finalPassedAt !== null &&
      latestReviewFixAt !== null &&
      compareNullableIso(finalPassedAt, latestReviewFixAt) >= 0 &&
      (mergedAt === null || compareNullableIso(finalPassedAt, mergedAt) <= 0));
  const mergeBeforeFinalVerification =
    hasReviewFixes && mergedAt !== null && finalPassedAt !== null && compareNullableIso(mergedAt, finalPassedAt) < 0;

  if (mergedAt !== null && hasReviewFixes && !hasRequiredFinalVerification) {
    const message =
      finalPassedAt === null
        ? 'PR review fix evidence was followed by merge without a recorded final verification event'
        : mergeBeforeFinalVerification
          ? 'merge timestamp is earlier than recorded final verification after PR review fixes'
          : 'final verification timestamp is earlier than latest PR review fix evidence';
    issues.push({ key: `merge-final-verification:${message}`, message });
  }

  const warningMessages = dedupeIssues(warnings).map((issue) => issue.message);
  const blockerMessages = dedupeIssues(blockers).map((issue) => issue.message);

  return {
    issues: dedupeIssues(issues).map((issue) => issue.message),
    review: {
      prePr: {
        requestedMode,
        actualMode,
        status: prePrStatus,
        warnings: warningMessages,
        blockers: blockerMessages,
        maxLoops: prePrConfig.maxLoops,
        loopMode: prePrConfig.loopMode,
        fixBatchCount: prePrFixBatchCount,
        maxLoopsReached:
          prePrConfig.maxLoops !== null && prePrStatus !== 'passed' && prePrFixBatchCount >= prePrConfig.maxLoops,
        loops,
        subagent: {
          agentId: subagentAgentId,
          status: subagentStatus,
        },
      },
      pr: {
        findings: prFindings,
        fixBatchCount: prFixBatchCount,
        resolvedThreadCount,
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
    timeline: events
      .slice()
      .sort((a, b) => a.index - b.index)
      .map(({ type, eventAt, recordedAt, index }) => ({ type, eventAt, recordedAt, index })),
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

function deriveChildStatus(
  state: Record<string, unknown>,
  child: Record<string, unknown>,
  evidence: {
    sessionId: string | null;
    sessionLogPath: string | null;
    latestHeartbeatAt: string | null;
    worktreeActivityAt: string | null;
    now: string;
    staleThresholdMs: number;
  },
): string {
  if (child.launchOnly === true && state.status === 'running') {
    if (child.status === 'supervision_lost') return 'supervision_lost';
    if (evidence.sessionId !== null || evidence.sessionLogPath !== null) return 'launched';
    const heartbeatAt = readOptionalString(child.lastHeartbeatAt) ?? evidence.latestHeartbeatAt;
    if (heartbeatAt !== null && !isStale(heartbeatAt, evidence.now, evidence.staleThresholdMs)) return 'launched';
    if (
      evidence.worktreeActivityAt !== null &&
      !isStale(evidence.worktreeActivityAt, evidence.now, evidence.staleThresholdMs)
    ) {
      return 'launched';
    }
    const startedAt = readOptionalString(child.startedAt);
    if (startedAt !== null && !isStale(startedAt, evidence.now, evidence.staleThresholdMs)) return 'launched';
    return 'supervision_lost';
  }
  if (typeof child.status === 'string') return child.status;
  return 'settled';
}

function childMetricsStatus(sessionId: string | null, sessionLogPath: string | null): AnalyzedChild['metricsStatus'] {
  if (sessionLogPath !== null) return 'available';
  return sessionId === null ? 'session_linkage_unavailable' : 'session_log_missing';
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
    .filter((event): event is NormalizedEvent => event !== null);
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

function isPrePrFindingsEvent(event: NormalizedEvent): boolean {
  if (event.type === 'pre_pr_review_findings') return true;
  if (event.type === 'pre_pr_review_blocked') return hasFindingsPayload(event.raw.findings);
  if (event.type !== 'pre_pr_review_completed') return false;
  const verdict = readOptionalString(event.raw.verdict)?.toUpperCase();
  return verdict === 'BLOCK' || hasFindingsPayload(event.raw.findings);
}

function isPrePrExecutionBlockedEvent(event: NormalizedEvent): boolean {
  return event.type === 'pre_pr_review_blocked' && !hasFindingsPayload(event.raw.findings);
}

function isPrePrPassedEvent(event: NormalizedEvent): boolean {
  if (event.type === 'pre_pr_review_cleared' || event.type === 'pre_pr_review_passed') return true;
  if (event.type !== 'pre_pr_review_completed') return false;
  return readOptionalString(event.raw.verdict)?.toUpperCase() === 'PASS';
}

function isPrReviewFixBatchEvent(type: string): boolean {
  return (
    type === 'pr_review_fix_batch' ||
    type === 'pr_review_fix_pushed' ||
    type === 'pr_review_fix_batch_started' ||
    type === 'pr_review_fix_batch_applied'
  );
}

function isPrReviewThreadResolvedEvent(type: string): boolean {
  return type === 'pr_review_thread_resolved' || type === 'codex_pr_review_thread_resolved';
}

function hasFindingsPayload(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function nextReviewLoop(loops: PrePrReviewLoop[], fixBatchCount: number): number {
  const last = lastReviewLoop(loops);
  return Math.max(last ?? 0, fixBatchCount) + 1;
}

function lastReviewLoop(loops: PrePrReviewLoop[]): number | null {
  for (let index = loops.length - 1; index >= 0; index -= 1) {
    const loop = loops[index]?.loop;
    if (typeof loop === 'number') return loop;
  }
  return null;
}

function dedupeIssues(issues: AnalyzerIssue[]): AnalyzerIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.key)) return false;
    seen.add(issue.key);
    return true;
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
  reviewLoops: SessionReviewLoop[];
}> {
  const commandCounts: Record<string, number> = {};
  const subagentCounts: Record<string, number> = {};
  let tokenTotals: TokenTotals | null = null;
  const reviewState = new SessionReviewState();

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
      if (payload.type === 'function_call' && typeof payload.name === 'string' && typeof payload.call_id === 'string') {
        reviewState.recordCall(payload.call_id, payload.name, readOptionalString(payload.arguments));
      }
      if (payload.type === 'function_call_output' && typeof payload.call_id === 'string') {
        reviewState.recordOutput(payload.call_id, readOptionalString(payload.output));
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

  return { commandCounts, subagentCounts, tokenTotals, reviewLoops: reviewState.loops() };
}

class SessionReviewState {
  private readonly calls = new Map<string, { name: string; args: Record<string, unknown> | null }>();
  private readonly reviewAgents = new Set<string>();
  private readonly reviewLoops: SessionReviewLoop[] = [];

  recordCall(callId: string, name: string, rawArgs: string | null): void {
    this.calls.set(callId, { name, args: rawArgs ? parseJsonLine(rawArgs) : null });
  }

  recordOutput(callId: string, rawOutput: string | null): void {
    const call = this.calls.get(callId);
    if (!call || rawOutput === null) return;

    if (call.name === 'spawn_agent') {
      const prompt = readOptionalString(call.args?.prompt) ?? '';
      const output = parseLooseJsonObject(rawOutput);
      const agentId = readOptionalString(output?.agent_path) ?? readOptionalString(output?.target);
      if (agentId && isReviewText(prompt)) this.reviewAgents.add(agentId);
      return;
    }

    if (call.name !== 'wait_agent' && call.name !== 'close_agent') return;
    const target = readOptionalString(call.args?.target);
    const summary = extractCompletedText(parseLooseJsonObject(rawOutput)) ?? rawOutput;
    if (!target || (!this.reviewAgents.has(target) && !isReviewText(summary))) return;
    const findings = countFindingsFromText(summary);
    if (findings === null) return;
    const status = findings > 0 ? 'findings' : 'passed';
    this.reviewLoops.push({
      loop: this.reviewLoops.length + 1,
      mode: 'subagent',
      status,
      findings,
      agentId: target,
    });
  }

  loops(): SessionReviewLoop[] {
    return this.reviewLoops;
  }
}

function mergeSessionReviewEvidence(review: ReviewSummary, sessionLoops: SessionReviewLoop[]): ReviewSummary {
  if (sessionLoops.length === 0) return review;
  const loops =
    review.prePr.loops.length > 0 ? review.prePr.loops : sessionLoops.map(({ agentId: _agentId, ...loop }) => loop);
  const latestLoop = sessionLoops[sessionLoops.length - 1];
  const hasFindings = sessionLoops.some((loop) => loop.status === 'findings');
  const lastPassed = latestLoop?.status === 'passed';
  return {
    ...review,
    prePr: {
      ...review.prePr,
      actualMode: review.prePr.actualMode ?? 'subagent',
      status:
        review.prePr.status === 'not_started' || review.prePr.status === 'not_configured'
          ? lastPassed
            ? 'passed'
            : hasFindings
              ? 'findings'
              : review.prePr.status
          : review.prePr.status,
      fixBatchCount: review.prePr.fixBatchCount > 0 ? review.prePr.fixBatchCount : countFindingLoops(sessionLoops),
      loops,
      subagent: {
        agentId: review.prePr.subagent.agentId ?? latestLoop?.agentId ?? null,
        status: review.prePr.subagent.status ?? (lastPassed ? 'passed' : hasFindings ? 'findings' : null),
      },
    },
  };
}

function countFindingLoops(loops: SessionReviewLoop[]): number {
  return loops.filter((loop) => loop.status === 'findings').length;
}

function latestHeartbeats(events: NormalizedEvent[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const event of events) {
    if (event.type !== 'child-heartbeat') continue;
    const storyId = readOptionalString(event.raw.storyId);
    if (!storyId) continue;
    const current = latest.get(storyId) ?? null;
    const next = maxIso(current, event.eventAt);
    if (next !== null) latest.set(storyId, next);
  }
  return latest;
}

function readChildTimeoutMs(config: Record<string, unknown> | null): number {
  const orchestrator = readRecord(config?.orchestrator);
  return readOptionalNumber(orchestrator?.childTimeoutMs) ?? 30 * 60 * 1000;
}

function isStale(eventAt: string, now: string, staleThresholdMs: number): boolean {
  const eventMs = Date.parse(eventAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(eventMs) || !Number.isFinite(nowMs)) return true;
  return nowMs - eventMs > staleThresholdMs;
}

function parseLooseJsonObject(value: string): Record<string, unknown> | null {
  const parsed = parseJsonLine(value);
  return isRecord(parsed) ? parsed : null;
}

function extractCompletedText(value: Record<string, unknown> | null): string | null {
  const status = readRecord(value?.status) ?? readRecord(value?.previous_status);
  return readOptionalString(status?.completed) ?? readOptionalString(value?.completed);
}

function isReviewText(value: string): boolean {
  return /pre[-_ ]pr|pre[-_ ]pull|review|findings/i.test(value);
}

function countFindingsFromText(value: string): number | null {
  if (/no findings|no actionable findings/i.test(value)) return 0;
  if (!/findings/i.test(value)) return null;
  const bulletCount = value.split('\n').filter((line) => /^\s*-\s+/.test(line) && !/verified|ran:/i.test(line)).length;
  return bulletCount > 0 ? bulletCount : null;
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

async function pathMtime(filePath: string): Promise<string | null> {
  try {
    return (await stat(filePath)).mtime.toISOString();
  } catch {
    return null;
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
