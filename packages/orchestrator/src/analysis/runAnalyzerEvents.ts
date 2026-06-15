import { isRecord } from '../internal/guards.js';
import type { SessionReviewLoop } from '../metrics/sessionLogMetrics.js';
import type {
  AnalyzerIssue,
  MergeSummary,
  NormalizedEvent,
  PrePrReviewLoop,
  PrePrReviewSummary,
  PrReviewFinding,
  ReviewSummary,
  TimelineEvent,
  VerificationCommandSummary,
  VerificationSummary,
} from './runAnalyzerTypes.js';
import { readOptionalBoolean, readOptionalNumber, readOptionalString, readRecord } from './runAnalyzerUtils.js';

export function summarizeEvents(
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
      loops.push(
        prePrReviewLoopFromEvent(
          event,
          'findings',
          countFindings(event.raw.findings),
          readOptionalNumber(event.raw.loop) ?? nextReviewLoop(loops, prePrFixBatchCount),
        ),
      );
      if (eventMode?.startsWith('subagent') || typeof event.raw.agentId === 'string') {
        subagentAgentId = readOptionalString(event.raw.agentId) ?? subagentAgentId;
        subagentStatus = 'findings';
      }
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
      loops.push(
        prePrReviewLoopFromEvent(event, 'passed', 0, readOptionalNumber(event.raw.loop) ?? lastReviewLoop(loops)),
      );
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

export function readPrePrConfig(config: Record<string, unknown> | null): {
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

export function readPrReviewConfig(config: Record<string, unknown> | null): { rerequestAfterFix: boolean | null } {
  const pr = readRecord(config?.pr);
  const review = readRecord(pr?.review);
  return { rerequestAfterFix: readOptionalBoolean(review?.rerequestAfterFix) };
}

export function readPrFindings(event: Record<string, unknown>): PrReviewFinding[] {
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

export function isPrePrFindingsEvent(event: NormalizedEvent): boolean {
  if (event.type === 'pre_pr_review_findings') return true;
  if (event.type === 'pre_pr_review_blocked') return hasFindingsPayload(event.raw.findings);
  if (event.type !== 'pre_pr_review_completed') return false;
  const verdict = readOptionalString(event.raw.verdict)?.toUpperCase();
  return verdict === 'BLOCK' || hasFindingsPayload(event.raw.findings);
}

export function isPrePrExecutionBlockedEvent(event: NormalizedEvent): boolean {
  return event.type === 'pre_pr_review_blocked' && !hasFindingsPayload(event.raw.findings);
}

export function isPrePrPassedEvent(event: NormalizedEvent): boolean {
  if (event.type === 'pre_pr_review_cleared' || event.type === 'pre_pr_review_passed') return true;
  if (event.type !== 'pre_pr_review_completed') return false;
  return readOptionalString(event.raw.verdict)?.toUpperCase() === 'PASS';
}

export function isPrReviewFixBatchEvent(type: string): boolean {
  return (
    type === 'pr_review_fix_batch' ||
    type === 'pr_review_fix_pushed' ||
    type === 'pr_review_fix_batch_started' ||
    type === 'pr_review_fix_batch_applied'
  );
}

export function isPrReviewThreadResolvedEvent(type: string): boolean {
  return type === 'pr_review_thread_resolved' || type === 'codex_pr_review_thread_resolved';
}

export function hasFindingsPayload(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function nextReviewLoop(loops: PrePrReviewLoop[], fixBatchCount: number): number {
  const last = lastReviewLoop(loops);
  return Math.max(last ?? 0, fixBatchCount) + 1;
}

export function lastReviewLoop(loops: PrePrReviewLoop[]): number | null {
  for (let index = loops.length - 1; index >= 0; index -= 1) {
    const loop = loops[index]?.loop;
    if (typeof loop === 'number') return loop;
  }
  return null;
}

export function dedupeIssues(issues: AnalyzerIssue[]): AnalyzerIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.key)) return false;
    seen.add(issue.key);
    return true;
  });
}

export function readVerificationCommands(
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

export function readRequestedMode(event: Record<string, unknown>): string | null {
  return readOptionalString(event.requestedMode) ?? readOptionalString(event.from);
}

export function readActualMode(event: Record<string, unknown>): string | null {
  return readOptionalString(event.actualMode) ?? readOptionalString(event.to) ?? readOptionalString(event.mode);
}

export function prePrReviewLoopFromEvent(
  event: NormalizedEvent,
  status: PrePrReviewLoop['status'],
  findings: number | null,
  loop: number | null,
): PrePrReviewLoop {
  return {
    loop,
    mode: readActualMode(event.raw),
    status,
    findings,
    agentId: readOptionalString(event.raw.agentId),
    previousAgentId: readOptionalString(event.raw.previousAgentId),
    continuityMode: readOptionalString(event.raw.continuityMode),
  };
}

export function countFindings(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

export function isVerificationEvent(type: string): boolean {
  return (
    type === 'verification_passed' ||
    type === 'verification_failed' ||
    type === 'final_verification_passed' ||
    type === 'final_verification_failed'
  );
}

export function maxIso(current: string | null, candidate: string | null): string | null {
  if (candidate === null) return current;
  if (current === null) return candidate;
  return compareNullableIso(current, candidate) >= 0 ? current : candidate;
}

export function compareNullableIso(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return Date.parse(a) - Date.parse(b);
}

export function mergeSessionReviewEvidence(review: ReviewSummary, sessionLoops: SessionReviewLoop[]): ReviewSummary {
  if (sessionLoops.length === 0) return review;
  const loops = review.prePr.loops.length > 0 ? review.prePr.loops : sessionLoops;
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

export function prePrReviewFromSessionLoops(sessionLoops: SessionReviewLoop[]): unknown {
  if (sessionLoops.length === 0) return null;
  const latestLoop = sessionLoops[sessionLoops.length - 1];
  const hasFindings = sessionLoops.some((loop) => loop.status === 'findings');
  const lastPassed = latestLoop?.status === 'passed';
  return {
    actualMode: 'subagent',
    status: lastPassed ? 'passed' : hasFindings ? 'findings' : 'not_started',
    fixBatchCount: countFindingLoops(sessionLoops),
    loops: sessionLoops,
    subagent: {
      agentId: latestLoop?.agentId ?? null,
      status: lastPassed ? 'passed' : hasFindings ? 'findings' : null,
    },
  };
}

export function countFindingLoops(loops: SessionReviewLoop[]): number {
  return loops.filter((loop) => loop.status === 'findings').length;
}
