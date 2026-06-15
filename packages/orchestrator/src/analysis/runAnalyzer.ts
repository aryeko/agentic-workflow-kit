import path from 'node:path';
import { addTokenTotals, emptyTokenTotals, mergeCounts } from '../metrics/aggregate.js';
import {
  analyzeSessionLogMetrics,
  mapSessionLogsByThread,
  type SessionReviewLoop,
} from '../metrics/sessionLogMetrics.js';
import type { TokenTotals } from '../types.js';
import { readArtifactEvidence } from './runAnalyzerArtifacts.js';
import {
  childEvidenceIssues,
  childMergeEvidence,
  childMetricsStatus,
  childProgressSummary,
  childVerificationEvidence,
  completionAuthorityForStory,
  completionAuthoritySourceForStory,
  deriveChildStatus,
  deriveRunStatus,
  diagnosticCandidatesForStory,
  isStaleParentSnapshot,
  latestSupervisorPolls,
  readChildEvidence,
  readChildren,
  readChildStartupTimeoutMs,
  readChildTimeoutMs,
  recoveryEventsForStory,
  staleParentSnapshotMessage,
} from './runAnalyzerChildren.js';
import { mergeSessionReviewEvidence, prePrReviewFromSessionLoops, summarizeEvents } from './runAnalyzerEvents.js';
import {
  defaultSessionRoots,
  findSessionLogs,
  pathExists,
  pathMtime,
  readEvents,
  readJsonObject,
  readJsonObjectIfExists,
  readOptionalString,
  readString,
} from './runAnalyzerUtils.js';

export type { WorkflowRunAnalysis } from './runAnalyzerTypes.js';

import type { AnalyzedChild, AnalyzeOptions, WorkflowRunAnalysis } from './runAnalyzerTypes.js';

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
