import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { isNodeError, isRecord } from '../internal/guards.js';
import { maxIso } from './runAnalyzerEvents.js';
import type {
  AnalyzedChild,
  ChildMergeEvidence,
  ChildProgressSummary,
  ChildRecoveryEvent,
  ChildVerificationEvidence,
  DiagnosticSessionCandidate,
  NormalizedEvent,
} from './runAnalyzerTypes.js';
import {
  readJsonObject,
  readOptionalBoolean,
  readOptionalNumber,
  readOptionalString,
  readRecord,
  readString,
  readStringArray,
} from './runAnalyzerUtils.js';

export function diagnosticCandidatesForStory(events: NormalizedEvent[], storyId: string): DiagnosticSessionCandidate[] {
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

export function recoveryEventsForStory(events: NormalizedEvent[], storyId: string): ChildRecoveryEvent[] {
  return events
    .filter((event) => event.type.startsWith('parent_takeover') && readOptionalString(event.raw.storyId) === storyId)
    .map((event) => ({
      type: event.type,
      decision: readOptionalString(event.raw.decision),
      evidence: readStringArray(event.raw.evidence),
    }));
}

export function completionAuthorityForStory(events: NormalizedEvent[], storyId: string): string | null {
  for (const event of events) {
    if (event.type !== 'completion_authority' || readOptionalString(event.raw.storyId) !== storyId) continue;
    const authority = readOptionalString(event.raw.authority);
    if (authority) return authority;
  }
  return null;
}

export function completionAuthoritySourceForStory(events: NormalizedEvent[], storyId: string): string | null {
  for (const event of events) {
    if (event.type !== 'completion_authority' || readOptionalString(event.raw.storyId) !== storyId) continue;
    const source = readOptionalString(event.raw.source);
    if (source) return source;
  }
  return null;
}

export async function readChildren(
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

export function interactiveStateChildren(state: Record<string, unknown>): Record<string, unknown>[] {
  if (state.command !== 'implement-next' || !isRecord(state.interactive)) return [];
  return [state.interactive];
}

export async function readLaunches(childrenDirectory: string, names: string[]): Promise<Record<string, unknown>[]> {
  const launchFiles = names.filter((name) => name.endsWith('.launch.json')).sort();
  return await Promise.all(launchFiles.map((name) => readJsonObject(path.join(childrenDirectory, name))));
}

export function mergeChildren(
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

export function deriveChildStatus(
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

export function childMetricsStatus(
  sessionId: string | null,
  sessionLogPath: string | null,
): AnalyzedChild['metricsStatus'] {
  if (sessionLogPath !== null) return 'available';
  return sessionId === null ? 'session_linkage_unavailable' : 'session_log_missing';
}

export function deriveRunStatus(status: string, children: AnalyzedChild[]): string {
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

export function readChildEvidence(child: Record<string, unknown>): Record<string, unknown> | null {
  return readRecord(child.evidence);
}

export function childProgressSummary(
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

export function isStaleParentSnapshot(
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

export function staleParentSnapshotMessage(
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

export function childEvidenceIssues(
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

  const github = readRecord(evidence.github);
  const githubMerge = readRecord(github?.merge);
  const prNumber = readOptionalNumber(evidence.prNumber) ?? readOptionalNumber(github?.prNumber);
  const prUrl = readOptionalString(evidence.prUrl) ?? readOptionalString(github?.prUrl);
  const merged = readOptionalBoolean(evidence.merged) === true || readOptionalBoolean(githubMerge?.merged) === true;
  const mergeCommit = readOptionalString(evidence.mergeCommit) ?? readOptionalString(githubMerge?.commit);
  const mergedAt = readOptionalString(evidence.mergedAt) ?? readOptionalString(githubMerge?.mergedAt);
  const branchDeleted =
    readOptionalBoolean(evidence.branchDeleted) === true || readOptionalBoolean(githubMerge?.branchDeleted) === true;
  const checks = githubChecks(evidence);
  const review = githubReview(evidence);

  if (prCreate(config) && prNumber === null && prUrl === null) {
    issues.push(`${storyId} PR evidence missing: configured PR creation requires PR number or URL`);
  }

  if (prCiWait(config)) {
    if (checks.length === 0) {
      issues.push(`${storyId} CI evidence missing: configured CI wait requires check evidence`);
    }
    for (const check of checks) {
      const status = readOptionalString(check.status);
      if (status === 'failed' || status === 'unknown') {
        issues.push(
          `${storyId} CI evidence ${status}: ${readOptionalString(check.command) ?? 'unknown check'}${
            readOptionalString(check.detail) ? ` (${readOptionalString(check.detail)})` : ''
          }`,
        );
      }
    }
  }

  if (prReviewWait(config) === 'bot') {
    const signal = readOptionalString(review?.signal);
    const findings = readOptionalNumber(review?.findings);
    const triaged = readOptionalBoolean(review?.triaged);
    if (!review) {
      issues.push(`${storyId} PR review evidence missing: configured bot review requires a review signal`);
    } else if (signal === 'pending' || signal === 'unknown') {
      issues.push(`${storyId} PR review evidence incomplete: bot review signal is ${signal}`);
    } else if (
      (signal === 'findings' || signal === 'commented') &&
      prReviewTriageComments(config) &&
      triaged !== true
    ) {
      issues.push(
        `${storyId} PR review evidence incomplete: ${findings ?? 'unknown'} bot findings are not triaged or replied to`,
      );
    }
  }

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

  if (prMergeAuto(config) && finalStatus && isEvidenceComplete(finalStatus, config) && !merged && !mergeCommit) {
    issues.push(`${storyId} merge evidence missing: configured auto-merge requires merged base evidence`);
  }

  if (prMergeDeleteBranch(config) && (merged || mergeCommit || mergedAt) && !branchDeleted) {
    issues.push(`${storyId} branch cleanup evidence missing: configured policy requires branch deletion`);
  }

  return issues;
}

export function githubChecks(evidence: Record<string, unknown>): Record<string, unknown>[] {
  const github = readRecord(evidence.github);
  return [...recordArray(github?.checks), ...recordArray(evidence.checks), ...recordArray(evidence.ci)];
}

export function githubReview(evidence: Record<string, unknown>): Record<string, unknown> | null {
  const github = readRecord(evidence.github);
  return (
    readRecord(github?.review) ?? normalizeLegacyReview(readRecord(evidence.prReview) ?? readRecord(evidence.review))
  );
}

export function normalizeLegacyReview(review: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!review) return null;
  const findings = readOptionalNumber(review.findings);
  const resolved = readOptionalBoolean(review.resolved);
  const signal =
    readOptionalString(review.signal) ??
    readOptionalString(review.status) ??
    (findings !== null && findings > 0 ? 'findings' : null);
  return {
    ...review,
    signal,
    triaged: readOptionalBoolean(review.triaged) ?? resolved,
  };
}

export function recordArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  return isRecord(value) ? [value] : [];
}

export function prCreate(config: Record<string, unknown> | null): boolean {
  const pr = readRecord(config?.pr);
  return readOptionalBoolean(pr?.create) === true;
}

export function prCiWait(config: Record<string, unknown> | null): boolean {
  const pr = readRecord(config?.pr);
  const ci = readRecord(pr?.ci);
  return readOptionalBoolean(ci?.wait) === true;
}

export function prReviewWait(config: Record<string, unknown> | null): string | null {
  const pr = readRecord(config?.pr);
  const review = readRecord(pr?.review);
  return readOptionalString(review?.wait);
}

export function prReviewTriageComments(config: Record<string, unknown> | null): boolean {
  const pr = readRecord(config?.pr);
  const review = readRecord(pr?.review);
  return readOptionalBoolean(review?.triageComments) === true;
}

export function prMergeDeleteBranch(config: Record<string, unknown> | null): boolean {
  const pr = readRecord(config?.pr);
  const merge = readRecord(pr?.merge);
  return readOptionalBoolean(merge?.deleteBranch) === true;
}

export function prMergeAuto(config: Record<string, unknown> | null): boolean {
  const pr = readRecord(config?.pr);
  const merge = readRecord(pr?.merge);
  return readOptionalBoolean(merge?.auto) === true;
}

export function hasFailureLanguage(value: string): boolean {
  return /\b(blocker|blocked|fail(?:ed|ing|s)?|not green|error)\b/i.test(value);
}

export function childVerificationEvidence(evidence: Record<string, unknown> | null): ChildVerificationEvidence[] {
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

export function childMergeEvidence(evidence: Record<string, unknown> | null): ChildMergeEvidence {
  const github = readRecord(evidence?.github);
  const merge = readRecord(github?.merge);
  return {
    merged: readOptionalBoolean(evidence?.merged) === true || readOptionalBoolean(merge?.merged) === true,
    prNumber: readOptionalNumber(evidence?.prNumber) ?? readOptionalNumber(github?.prNumber),
    prUrl: readOptionalString(evidence?.prUrl) ?? readOptionalString(github?.prUrl),
    mergeCommit: readOptionalString(evidence?.mergeCommit) ?? readOptionalString(merge?.commit),
    mergedAt: readOptionalString(evidence?.mergedAt) ?? readOptionalString(merge?.mergedAt),
    branchDeleted: readOptionalBoolean(evidence?.branchDeleted) ?? readOptionalBoolean(merge?.branchDeleted),
  };
}

export function isEvidenceComplete(status: string, config: Record<string, unknown> | null): boolean {
  const statuses = readRecord(config?.statuses);
  const complete = Array.isArray(statuses?.complete)
    ? statuses.complete.filter((entry): entry is string => typeof entry === 'string')
    : ['done', 'verified'];
  return complete.includes(status);
}

export function latestSupervisorPolls(events: NormalizedEvent[]): Map<string, string> {
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

export function readChildTimeoutMs(config: Record<string, unknown> | null): number {
  const orchestrator = readRecord(config?.orchestrator);
  return (
    readOptionalNumber(orchestrator?.childNoProgressTimeoutMs) ??
    readOptionalNumber(orchestrator?.childTimeoutMs) ??
    30 * 60 * 1000
  );
}

export function readChildStartupTimeoutMs(config: Record<string, unknown> | null): number {
  const orchestrator = readRecord(config?.orchestrator);
  return readOptionalNumber(orchestrator?.childStartupTimeoutMs) ?? 60 * 1000;
}

export function isStale(eventAt: string, now: string, staleThresholdMs: number): boolean {
  const eventMs = Date.parse(eventAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(eventMs) || !Number.isFinite(nowMs)) return true;
  return nowMs - eventMs > staleThresholdMs;
}
