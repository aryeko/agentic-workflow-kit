import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { isNodeError, isRecord } from '../internal/guards.js';
import { addTokenTotals, emptyTokenTotals, mergeCounts } from '../metrics/aggregate.js';
import {
  analyzeSessionLogMetrics,
  mapSessionLogsByThread,
  type SessionReviewLoop,
} from '../metrics/sessionLogMetrics.js';
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
  artifacts: ArtifactEvidenceSummary;
}

interface ArtifactEvidenceSummary {
  summary: {
    present: boolean;
    schemaVersion: number | null;
    artifactPaths: string[];
    unavailable: Record<string, string>;
  };
  rows: {
    present: boolean;
    schemaVersion: number | null;
    count: number;
    storyIds: string[];
  };
  budgets: {
    present: boolean;
    schemaVersion: number | null;
    evaluationCount: number;
    unavailable: BudgetEvaluationSummary[];
    warnings: BudgetEvaluationSummary[];
    stops: BudgetEvaluationSummary[];
  };
  transcripts: {
    present: boolean;
    schemaVersion: number | null;
    count: number;
    linked: number;
    missing: number;
    unlinked: number;
  };
}

interface BudgetEvaluationSummary {
  profileName: string | null;
  taskType: string | null;
  dimension: string | null;
  status: string | null;
  eventType: string | null;
  unavailableReason: string | null;
}

interface AnalyzedChild {
  storyId: string;
  ok: boolean;
  sessionId: string | null;
  sessionLogPath: string | null;
  linkageStatus: 'linked' | 'diagnostic_candidate_only' | 'unlinked';
  diagnosticSessionCandidates: DiagnosticSessionCandidate[];
  metricsStatus: 'available' | 'session_linkage_unavailable' | 'session_log_missing';
  status: string;
  expectedBranch: string | null;
  expectedWorktreePath: string | null;
  failedSpawnAgentAttempts: number;
  recoveryEvents: ChildRecoveryEvent[];
  completionAuthority: string | null;
  completionAuthoritySource: string | null;
  staleParentSnapshot: boolean;
  progress: ChildProgressSummary;
  verification: ChildVerificationEvidence[];
  merge: ChildMergeEvidence;
  review: ChildReviewEvidence;
}

interface DiagnosticSessionCandidate {
  sessionId: string;
  evidence: string;
}

interface ChildRecoveryEvent {
  type: string;
  decision: string | null;
  evidence: string[];
}

interface ChildProgressSummary {
  lastSupervisorPollAt: string | null;
  lastObservedChildProgressAt: string | null;
  progressSource: string | null;
}

interface ChildVerificationEvidence {
  command: string | null;
  status: string;
  phase?: string | null;
  detail?: string | null;
}

interface ChildMergeEvidence {
  merged: boolean;
  prNumber: number | null;
  prUrl: string | null;
  mergeCommit: string | null;
  mergedAt: string | null;
  branchDeleted: boolean | null;
}

interface ChildReviewEvidence {
  prePr: unknown;
  pr: unknown;
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
  const artifactEvidence = await readArtifactEvidence(runDirectory);
  const children = await readChildren(path.join(runDirectory, 'children'), state);
  const sessionLogs = await findSessionLogs(options.sessionRoots ?? defaultSessionRoots());
  const logsBySession = await mapSessionLogsByThread(sessionLogs);
  const latestSupervisorPollByStory = latestSupervisorPolls(events);
  const now = options.now ?? new Date().toISOString();
  const staleThresholdMs = readChildTimeoutMs(config);
  const startupThresholdMs = readChildStartupTimeoutMs(config);

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
    const explicitSessionLogPath = typeof child.sessionLogPath === 'string' ? child.sessionLogPath : null;
    const readableExplicitSessionLogPath =
      explicitSessionLogPath !== null && (await pathExists(explicitSessionLogPath)) ? explicitSessionLogPath : null;
    const discoveredSessionLogPath = sessionId ? (logsBySession.get(sessionId) ?? null) : null;
    const sessionLogPath = readableExplicitSessionLogPath ?? discoveredSessionLogPath ?? explicitSessionLogPath;
    const storyId = readString(child.storyId, 'child.storyId');
    const diagnosticSessionCandidates = diagnosticCandidatesForStory(events, storyId);
    const diagnosticSessionLogPath =
      readableExplicitSessionLogPath ??
      discoveredSessionLogPath ??
      diagnosticSessionCandidates
        .map((candidate) => logsBySession.get(candidate.sessionId) ?? null)
        .find((candidatePath) => candidatePath !== null) ??
      null;
    const expectedWorktreePath = typeof child.expectedWorktreePath === 'string' ? child.expectedWorktreePath : null;
    const evidence = readChildEvidence(child);
    const progress = childProgressSummary(child, latestSupervisorPollByStory.get(storyId) ?? null);
    const staleParentSnapshot = isStaleParentSnapshot(child, evidence, config);
    const completionAuthority =
      completionAuthorityForStory(events, storyId) ?? readOptionalString(child.completionAuthority);
    const completionAuthoritySource =
      completionAuthoritySourceForStory(events, storyId) ?? readOptionalString(child.completionAuthoritySource);
    const status = deriveChildStatus(state, child, {
      sessionId,
      sessionLogPath,
      latestObservedChildProgressAt: progress.lastObservedChildProgressAt,
      worktreeActivityAt: expectedWorktreePath ? await pathMtime(expectedWorktreePath) : null,
      now,
      staleThresholdMs,
      startupThresholdMs,
    });
    if (child.launchOnly === true && status === 'supervision_lost') {
      issues.push(`${storyId} has launch metadata but no settled child result`);
    }
    if (child.launchOnly === true && status === 'startup_stale') {
      issues.push(`${storyId} startup is stale: no session, progress, heartbeat, result, or worktree activity`);
    }
    if (child.launchOnly === true && status === 'startup_failed') {
      issues.push(`${storyId} startup failed before child session acknowledgement`);
    }
    analyzedChildren.push({
      storyId,
      ok: child.ok === true,
      sessionId,
      sessionLogPath,
      linkageStatus:
        sessionId !== null || sessionLogPath !== null
          ? 'linked'
          : diagnosticSessionCandidates.length > 0
            ? 'diagnostic_candidate_only'
            : 'unlinked',
      diagnosticSessionCandidates,
      metricsStatus: childMetricsStatus(sessionId, diagnosticSessionLogPath),
      status,
      expectedBranch: typeof child.expectedBranch === 'string' ? child.expectedBranch : null,
      expectedWorktreePath,
      failedSpawnAgentAttempts: 0,
      recoveryEvents: recoveryEventsForStory(events, storyId),
      completionAuthority,
      completionAuthoritySource,
      staleParentSnapshot,
      progress,
      verification: childVerificationEvidence(evidence),
      merge: childMergeEvidence(evidence),
      review: {
        prePr: evidence?.prePrReview ?? null,
        pr: evidence?.prReview ?? null,
      },
    });
    if (staleParentSnapshot) {
      issues.push(staleParentSnapshotMessage(storyId, child, evidence));
    }
    issues.push(...childEvidenceIssues(storyId, child, evidence, config, completionAuthority));

    if (!diagnosticSessionLogPath) continue;

    const sessionMetrics = await analyzeSessionLogMetrics(diagnosticSessionLogPath);
    analyzedChildren[analyzedChildren.length - 1].failedSpawnAgentAttempts = sessionMetrics.failedSpawnAgentAttempts;
    const sessionPrePrReview = prePrReviewFromSessionLoops(sessionMetrics.reviewLoops);
    if (sessionPrePrReview && analyzedChildren[analyzedChildren.length - 1].review.prePr === null) {
      analyzedChildren[analyzedChildren.length - 1].review.prePr = sessionPrePrReview;
    }
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
    artifacts: artifactEvidence,
  };
}

async function readArtifactEvidence(runDirectory: string): Promise<ArtifactEvidenceSummary> {
  const [summary, rows, budgets, transcripts] = await Promise.all([
    readJsonObjectIfExists(path.join(runDirectory, 'summary.json')),
    readJsonObjectIfExists(path.join(runDirectory, 'rows.json')),
    readJsonObjectIfExists(path.join(runDirectory, 'budgets.json')),
    readJsonObjectIfExists(path.join(runDirectory, 'transcripts.json')),
  ]);
  const rowEntries = readRecordArray(rows?.rows);
  const budgetEvaluations = readRecordArray(budgets?.evaluations);
  const transcriptEntries = readRecordArray(transcripts?.transcripts);
  const budgetSummaries = budgetEvaluations.map(readBudgetEvaluationSummary);
  return {
    summary: {
      present: summary !== null,
      schemaVersion: readOptionalNumber(summary?.schemaVersion),
      artifactPaths: Object.values(readRecord(summary?.artifactPaths) ?? {}).filter(
        (entry): entry is string => typeof entry === 'string',
      ),
      unavailable: readStringRecord(summary?.unavailable),
    },
    rows: {
      present: rows !== null,
      schemaVersion: readOptionalNumber(rows?.schemaVersion),
      count: rowEntries.length,
      storyIds: rowEntries.flatMap((row) => {
        const storyId = readOptionalString(row.storyId);
        return storyId ? [storyId] : [];
      }),
    },
    budgets: {
      present: budgets !== null,
      schemaVersion: readOptionalNumber(budgets?.schemaVersion),
      evaluationCount: budgetEvaluations.length,
      unavailable: budgetSummaries.filter((entry) => entry.status === 'unavailable'),
      warnings: budgetSummaries.filter((entry) => entry.eventType === 'budget-warning'),
      stops: budgetSummaries.filter((entry) => entry.eventType === 'budget-stop'),
    },
    transcripts: {
      present: transcripts !== null,
      schemaVersion: readOptionalNumber(transcripts?.schemaVersion),
      count: transcriptEntries.length,
      linked: transcriptEntries.filter((entry) => entry.status === 'linked').length,
      missing: transcriptEntries.filter((entry) => entry.status === 'missing').length,
      unlinked: transcriptEntries.filter((entry) => entry.status === 'unlinked').length,
    },
  };
}

function readBudgetEvaluationSummary(value: Record<string, unknown>): BudgetEvaluationSummary {
  return {
    profileName: readOptionalString(value.profileName),
    taskType: readOptionalString(value.taskType),
    dimension: readOptionalString(value.dimension),
    status: readOptionalString(value.status),
    eventType: readOptionalString(value.eventType),
    unavailableReason: readOptionalString(value.unavailableReason),
  };
}

function diagnosticCandidatesForStory(events: NormalizedEvent[], storyId: string): DiagnosticSessionCandidate[] {
  return events
    .filter((event) => event.type === 'session_candidate' && readOptionalString(event.raw.storyId) === storyId)
    .flatMap((event) => {
      const sessionId = readOptionalString(event.raw.sessionId);
      if (!sessionId) return [];
      return [
        {
          sessionId,
          evidence: readOptionalString(event.raw.evidence) ?? 'diagnostic session candidate',
        },
      ];
    });
}

function recoveryEventsForStory(events: NormalizedEvent[], storyId: string): ChildRecoveryEvent[] {
  return events
    .filter((event) => event.type.startsWith('parent_takeover') && readOptionalString(event.raw.storyId) === storyId)
    .map((event) => ({
      type: event.type,
      decision: readOptionalString(event.raw.decision),
      evidence: readStringArray(event.raw.evidence),
    }));
}

function completionAuthorityForStory(events: NormalizedEvent[], storyId: string): string | null {
  for (const event of events) {
    if (event.type !== 'completion_authority' || readOptionalString(event.raw.storyId) !== storyId) continue;
    const authority = readOptionalString(event.raw.authority);
    if (authority) return authority;
  }
  return null;
}

function completionAuthoritySourceForStory(events: NormalizedEvent[], storyId: string): string | null {
  for (const event of events) {
    if (event.type !== 'completion_authority' || readOptionalString(event.raw.storyId) !== storyId) continue;
    const source = readOptionalString(event.raw.source);
    if (source) return source;
  }
  return null;
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
    latestObservedChildProgressAt: string | null;
    worktreeActivityAt: string | null;
    now: string;
    staleThresholdMs: number;
    startupThresholdMs: number;
  },
): string {
  if (child.launchOnly === true && state.status === 'running') {
    if (child.status === 'startup_failed') return 'startup_failed';
    if (child.status === 'supervision_lost') return 'supervision_lost';
    if (evidence.sessionId !== null || evidence.sessionLogPath !== null) return 'launched';
    const progressAt =
      readOptionalString(child.lastObservedChildProgressAt) ??
      evidence.latestObservedChildProgressAt ??
      readOptionalString(child.lastHeartbeatAt);
    if (progressAt !== null && !isStale(progressAt, evidence.now, evidence.staleThresholdMs)) return 'launched';
    if (progressAt !== null) return 'supervision_lost';
    if (
      evidence.worktreeActivityAt !== null &&
      !isStale(evidence.worktreeActivityAt, evidence.now, evidence.startupThresholdMs)
    ) {
      return 'launched';
    }
    const startedAt = readOptionalString(child.startedAt);
    if (startedAt !== null && !isStale(startedAt, evidence.now, evidence.startupThresholdMs)) return 'startup_pending';
    if (startedAt !== null) return 'startup_stale';
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
  if (
    status === 'blocked' &&
    children.length > 0 &&
    children.every((child) => child.ok && child.staleParentSnapshot && child.merge.merged)
  ) {
    return 'complete';
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

function prePrReviewFromSessionLoops(sessionLoops: SessionReviewLoop[]): unknown {
  if (sessionLoops.length === 0) return null;
  const latestLoop = sessionLoops[sessionLoops.length - 1];
  const hasFindings = sessionLoops.some((loop) => loop.status === 'findings');
  const lastPassed = latestLoop?.status === 'passed';
  return {
    actualMode: 'subagent',
    status: lastPassed ? 'passed' : hasFindings ? 'findings' : 'not_started',
    fixBatchCount: countFindingLoops(sessionLoops),
    loops: sessionLoops.map(({ agentId: _agentId, ...loop }) => loop),
    subagent: {
      agentId: latestLoop?.agentId ?? null,
      status: lastPassed ? 'passed' : hasFindings ? 'findings' : null,
    },
  };
}

function countFindingLoops(loops: SessionReviewLoop[]): number {
  return loops.filter((loop) => loop.status === 'findings').length;
}

function readChildEvidence(child: Record<string, unknown>): Record<string, unknown> | null {
  return readRecord(child.evidence);
}

function childProgressSummary(
  child: Record<string, unknown>,
  latestSupervisorPollAt: string | null,
): ChildProgressSummary {
  return {
    lastSupervisorPollAt: readOptionalString(child.lastSupervisorPollAt) ?? latestSupervisorPollAt,
    lastObservedChildProgressAt:
      readOptionalString(child.lastObservedChildProgressAt) ?? readOptionalString(child.lastHeartbeatAt),
    progressSource: readOptionalString(child.progressSource),
  };
}

function isStaleParentSnapshot(
  child: Record<string, unknown>,
  evidence: Record<string, unknown> | null,
  config: Record<string, unknown> | null,
): boolean {
  if (!evidence) return false;
  const returnedStatus = readOptionalString(child.returnedStatus);
  const finalStatus = readOptionalString(evidence.finalStatus);
  if (!returnedStatus || !finalStatus) return false;
  if (!isEvidenceComplete(finalStatus, config) || isEvidenceComplete(returnedStatus, config)) return false;
  return readOptionalBoolean(evidence.merged) === true || typeof evidence.mergeCommit === 'string';
}

function staleParentSnapshotMessage(
  storyId: string,
  child: Record<string, unknown>,
  evidence: Record<string, unknown> | null,
): string {
  return `${storyId} parent tracker snapshot is stale: returned status ${
    readOptionalString(child.returnedStatus) ?? 'unknown'
  } but child evidence reports ${readOptionalBoolean(evidence?.merged) === true ? 'merged ' : ''}${
    readOptionalString(evidence?.finalStatus) ?? 'complete'
  }`;
}

function childEvidenceIssues(
  storyId: string,
  child: Record<string, unknown>,
  evidence: Record<string, unknown> | null,
  config: Record<string, unknown> | null,
  completionAuthority: string | null,
): string[] {
  const issues: string[] = [];
  if (!evidence) return issues;

  const returnedStatus = readOptionalString(child.returnedStatus);
  const finalStatus = readOptionalString(evidence.finalStatus);
  if (
    returnedStatus &&
    finalStatus &&
    isEvidenceComplete(finalStatus, config) &&
    !isEvidenceComplete(returnedStatus, config)
  ) {
    issues.push(
      `${storyId} child tracker evidence conflicts with parent snapshot: returned status ${returnedStatus} but child evidence reports ${finalStatus}`,
    );
  }

  const prNumber = readOptionalNumber(evidence.prNumber);
  const merged = readOptionalBoolean(evidence.merged) === true;
  const mergeCommit = readOptionalString(evidence.mergeCommit);
  const mergedAt = readOptionalString(evidence.mergedAt);
  const branchDeleted = readOptionalBoolean(evidence.branchDeleted) === true;
  if (completionAuthority === 'pr-policy-incomplete') {
    issues.push(`${storyId} PR policy incomplete: auto-merge policy has not produced merged evidence`);
  } else if (prMergeAuto(config) && prNumber !== null && finalStatus && isEvidenceComplete(finalStatus, config)) {
    if (merged && !mergeCommit && !mergedAt) {
      issues.push(
        `${storyId} PR policy incomplete: PR #${prNumber} is marked merged without merge commit or merge timestamp`,
      );
    } else if (!merged && !mergeCommit && !mergedAt) {
      issues.push(`${storyId} PR policy incomplete: PR #${prNumber} has no merged base evidence`);
    }
  }

  for (const verification of childVerificationEvidence(evidence)) {
    const detail = verification.detail ?? '';
    if (verification.status === 'passed' && hasFailureLanguage(detail)) {
      issues.push(
        `${storyId} verification evidence contradiction for ${verification.command ?? 'unknown command'}: passed status includes blocker or failure detail`,
      );
    }
    if (verification.status === 'failed' && /\bpassed?\b/i.test(detail)) {
      issues.push(
        `${storyId} verification evidence contradiction for ${verification.command ?? 'unknown command'}: failed status includes passed wording`,
      );
    }
  }

  for (const blocker of readStringArray(evidence.blockers)) {
    if (!issues.some((issue) => issue.includes(blocker))) {
      issues.push(`${storyId} child blocker evidence: ${blocker}`);
    }
  }

  if (merged && prNumber !== null && !mergeCommit && !mergedAt && !branchDeleted) {
    issues.push(
      `${storyId} merge evidence needs review: PR #${prNumber} is marked merged without merge commit, merge timestamp, or branch deletion evidence`,
    );
  }

  return issues;
}

function prMergeAuto(config: Record<string, unknown> | null): boolean {
  const pr = readRecord(config?.pr);
  const merge = readRecord(pr?.merge);
  return readOptionalBoolean(merge?.auto) === true;
}

function hasFailureLanguage(value: string): boolean {
  return /\b(blocker|blocked|fail(?:ed|ing|s)?|not green|error)\b/i.test(value);
}

function childVerificationEvidence(evidence: Record<string, unknown> | null): ChildVerificationEvidence[] {
  const verification = evidence?.verification;
  if (!Array.isArray(verification)) return [];
  return verification.flatMap((entry): ChildVerificationEvidence[] => {
    if (typeof entry === 'string') return [{ command: entry, status: 'passed' }];
    if (!isRecord(entry)) return [];
    const status = readOptionalString(entry.status) ?? 'passed';
    return [
      {
        command: readOptionalString(entry.command),
        status,
        phase: readOptionalString(entry.phase),
        detail: readOptionalString(entry.detail),
      },
    ];
  });
}

function childMergeEvidence(evidence: Record<string, unknown> | null): ChildMergeEvidence {
  return {
    merged: readOptionalBoolean(evidence?.merged) === true,
    prNumber: readOptionalNumber(evidence?.prNumber),
    prUrl: readOptionalString(evidence?.prUrl),
    mergeCommit: readOptionalString(evidence?.mergeCommit),
    mergedAt: readOptionalString(evidence?.mergedAt),
    branchDeleted: readOptionalBoolean(evidence?.branchDeleted),
  };
}

function isEvidenceComplete(status: string, config: Record<string, unknown> | null): boolean {
  const statuses = readRecord(config?.statuses);
  const complete = Array.isArray(statuses?.complete)
    ? statuses.complete.filter((entry): entry is string => typeof entry === 'string')
    : ['done', 'verified'];
  return complete.includes(status);
}

function latestSupervisorPolls(events: NormalizedEvent[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const event of events) {
    if (event.type !== 'child-supervisor-poll' && event.type !== 'child-heartbeat') continue;
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
  return (
    readOptionalNumber(orchestrator?.childNoProgressTimeoutMs) ??
    readOptionalNumber(orchestrator?.childTimeoutMs) ??
    30 * 60 * 1000
  );
}

function readChildStartupTimeoutMs(config: Record<string, unknown> | null): number {
  const orchestrator = readRecord(config?.orchestrator);
  return readOptionalNumber(orchestrator?.childStartupTimeoutMs) ?? 60 * 1000;
}

function isStale(eventAt: string, now: string, staleThresholdMs: number): boolean {
  const eventMs = Date.parse(eventAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(eventMs) || !Number.isFinite(nowMs)) return true;
  return nowMs - eventMs > staleThresholdMs;
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

function readString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  return value;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => isRecord(entry));
}

function readStringRecord(value: unknown): Record<string, string> {
  const record = readRecord(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
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
