import { isRecord } from '../../internal/guards.js';
import type {
  ChildResultEvidence,
  GithubCheckEvidence,
  GithubEvidence,
  GithubMergeEvidence,
  GithubReviewEvidence,
  VerificationEvidence,
} from '../../types.js';

export function childResultEvidence(structuredContent: Record<string, unknown>, content: string): ChildResultEvidence {
  const structured =
    readEvidenceObject(structuredContent.childResult) ??
    readEvidenceObject(structuredContent.result) ??
    readEvidenceObject(structuredContent.evidence) ??
    readEvidenceObject(structuredContent);
  return mergeEvidence(compatibilityEvidence(content, structured?.storyId, structured?.prNumber), structured);
}

function readEvidenceObject(value: unknown): ChildResultEvidence | null {
  if (!isRecord(value)) return null;
  const evidence: ChildResultEvidence = {};
  const github = readGithubEvidence(value.github) ?? readGithubAliases(value);
  const storyId = readString(value.storyId);
  const finalStatus = readString(value.finalStatus) ?? readString(value.status);
  const trackerPath = readString(value.trackerPath);
  const trackerStatusEvidence = readString(value.trackerStatusEvidence);
  const prNumber = readNumber(value.prNumber) ?? github?.prNumber ?? null;
  const prUrl = readString(value.prUrl) ?? github?.prUrl ?? null;
  const merged = readBoolean(value.merged) ?? github?.merge?.merged ?? null;
  const mergedAt = readString(value.mergedAt) ?? github?.merge?.mergedAt ?? null;
  const mergeCommit = readString(value.mergeCommit) ?? github?.merge?.commit ?? null;
  const branchDeleted = readBoolean(value.branchDeleted) ?? github?.merge?.branchDeleted ?? null;
  const verification = readVerification(value.verification);
  const downgrades = readStringArray(value.downgrades);
  const blockers = readStringArray(value.blockers);
  if (storyId) evidence.storyId = storyId;
  if (finalStatus) evidence.finalStatus = finalStatus;
  if (trackerPath) evidence.trackerPath = trackerPath;
  if (trackerStatusEvidence) evidence.trackerStatusEvidence = trackerStatusEvidence;
  if (prNumber !== null) evidence.prNumber = prNumber;
  if (prUrl) evidence.prUrl = prUrl;
  if (merged !== null) evidence.merged = merged;
  if (mergedAt) evidence.mergedAt = mergedAt;
  if (mergeCommit) evidence.mergeCommit = mergeCommit;
  if (branchDeleted !== null) evidence.branchDeleted = branchDeleted;
  if (verification.length > 0) evidence.verification = verification;
  if (isRecord(value.prePrReview)) evidence.prePrReview = value.prePrReview;
  if (isRecord(value.prReview)) evidence.prReview = value.prReview;
  if (github) evidence.github = github;
  if (downgrades.length > 0) evidence.downgrades = downgrades;
  if (blockers.length > 0) evidence.blockers = blockers;
  return Object.keys(evidence).length > 0 ? evidence : null;
}

function compatibilityEvidence(
  content: string,
  currentStoryId: string | undefined,
  currentPrNumber: number | undefined,
): ChildResultEvidence {
  const evidence: ChildResultEvidence = {};
  const prUrl = content.match(/https:\/\/github\.com\/[^\s)]+\/pull\/(\d+)/);
  if (prUrl) {
    evidence.prUrl = prUrl[0];
    evidence.prNumber = Number(prUrl[1]);
  }
  const prNumber = evidence.prNumber ?? currentPrNumber;
  const mergeCommit = mergeCommitEvidence(content, prNumber, currentStoryId);
  if (mergeCommit !== null) {
    evidence.merged = true;
    evidence.mergeCommit = mergeCommit;
  } else if (prNumber !== undefined && hasSamePrMergeEvidence(content, prNumber)) {
    evidence.merged = true;
  }
  if (/remote story branch (?:was )?deleted|branch deletion confirmed/i.test(content)) {
    evidence.branchDeleted = true;
  }
  const trackerAuthority = content.match(/Tracker authority:\s*`?([^`\n]+)`?[^.\n]*(?:marked|has)\s+([a-z_-]+)/i);
  if (trackerAuthority) {
    evidence.trackerPath = trackerAuthority[1].trim();
    evidence.finalStatus = trackerAuthority[2].toLowerCase();
    evidence.trackerStatusEvidence = trackerAuthority[0];
  } else {
    const trackerRow = content.match(/\bTracker row is\s+([a-z_-]+)(?:\b|[^\n.]*)/i);
    if (trackerRow) {
      evidence.finalStatus = trackerRow[1].toLowerCase();
      evidence.trackerStatusEvidence = trackerRow[0];
    }
  }
  const verification = verificationFromContent(content);
  if (verification.length > 0) evidence.verification = verification;
  const github = githubEvidenceFromContent(content, evidence);
  if (github) {
    evidence.github = github;
    if (github.prNumber !== undefined) evidence.prNumber = github.prNumber;
    if (github.prUrl) evidence.prUrl = github.prUrl;
    if (github.merge) {
      evidence.merged = github.merge.merged;
      if (github.merge.commit) evidence.mergeCommit = github.merge.commit;
      if (github.merge.mergedAt) evidence.mergedAt = github.merge.mergedAt;
      if (github.merge.branchDeleted !== null && github.merge.branchDeleted !== undefined) {
        evidence.branchDeleted = github.merge.branchDeleted;
      }
    }
  }
  const downgrades = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /downgraded|unavailable/i.test(line));
  if (downgrades.length > 0) evidence.downgrades = downgrades;
  const blockers = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => hasFailureSignal(line));
  if (blockers.length > 0) evidence.blockers = blockers;
  return evidence;
}

function verificationFromContent(content: string): VerificationEvidence[] {
  const verification: VerificationEvidence[] = [];
  let inVerificationSection = false;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (/^verification\s*:?$/i.test(line)) {
      inVerificationSection = true;
      continue;
    }
    if (/^#{1,6}\s+\S/.test(line) || (/^[A-Z][A-Za-z ]+:\s*$/.test(line) && !/^verification\s*:?$/i.test(line))) {
      inVerificationSection = false;
    }
    if (!/`[^`]+`/.test(line)) continue;
    const status = verificationStatus(line);
    if (!status) continue;
    verification.push({
      command: line.match(/`([^`]+)`/)?.[1] ?? null,
      status,
      phase: inVerificationSection ? 'verification' : undefined,
      detail: line,
    });
  }
  return verification;
}

function verificationStatus(line: string): VerificationEvidence['status'] | null {
  if (hasFailureSignal(line)) return 'failed';
  if (/\bskipped?\b/i.test(line)) return 'skipped';
  if (/\bpassed?\b/i.test(line)) return 'passed';
  return null;
}

function hasFailureSignal(text: string): boolean {
  return /\b(blocker|blocked|fail(?:ed|ing|s)?|not green|error)\b/i.test(stripNegatedFailurePhrases(text));
}

function stripNegatedFailurePhrases(text: string): string {
  return text
    .replace(/\b(?:no|without)\s+(?:failed|failing|failures?|errors?|blockers?|blocked)\b/gi, '')
    .replace(/\bnot\s+(?:failed|failing|blocked)\b/gi, '')
    .replace(/\b0\s+(?:failed|failing|failures?|errors?|blockers?)\b/gi, '');
}

function mergeCommitEvidence(
  content: string,
  prNumber: number | undefined,
  currentStoryId: string | undefined,
): string | null {
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0 || hasNegatedMergeEvidence(line)) continue;
    const mergeCommit = line.match(/\b(?:Merged|merge commit|squash commit)[^`0-9a-f]*`?([0-9a-f]{7,40})`?/i);
    if (!mergeCommit) continue;
    if (
      (prNumber !== undefined || currentStoryId !== undefined) &&
      lineMentionsDifferentPrOrStory(line, prNumber, currentStoryId)
    ) {
      continue;
    }
    return mergeCommit[1];
  }
  return null;
}

function hasSamePrMergeEvidence(content: string, prNumber: number): boolean {
  const samePrPatterns = [
    new RegExp(`\\b(?:PR|pull request)\\s*#?${prNumber}\\b[^\\n.]*\\bmerged\\b`, 'i'),
    new RegExp(`\\bmerged\\b[^\\n.]*\\b(?:PR|pull request)\\s*#?${prNumber}\\b`, 'i'),
    new RegExp(`/pull/${prNumber}\\b[^\\n.]*\\bmerged\\b`, 'i'),
    new RegExp(`\\bmerged\\b[^\\n.]*\\/pull/${prNumber}\\b`, 'i'),
  ];
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !hasNegatedMergeEvidence(line))
    .some((line) => samePrPatterns.some((pattern) => pattern.test(line)));
}

function hasNegatedMergeEvidence(line: string): boolean {
  return /\b(?:not|never|no)\s+(?:been\s+)?merged\b|\bmerged\s+(?:not|never)\b/i.test(line);
}

function lineMentionsDifferentPrOrStory(
  line: string,
  prNumber: number | undefined,
  currentStoryId: string | undefined,
): boolean {
  const prMentions = [...line.matchAll(/\b(?:PR|pull request)\s*#?(\d+)\b|\/pull\/(\d+)\b/gi)].map((match) =>
    Number(match[1] ?? match[2]),
  );
  const storyMentions = [...line.matchAll(/\b[A-Z]{2,}\d+\b/g)].map((match) => match[0]);
  if (prNumber !== undefined) {
    if (prMentions.some((number) => number !== prNumber)) return true;
    if (prMentions.some((number) => number === prNumber)) return false;
  }
  if (prNumber === undefined && prMentions.length > 0 && storyMentions.length === 0) return true;
  if (storyMentions.length === 0) return false;
  if (!currentStoryId) return true;
  return storyMentions.some((storyId) => storyId !== currentStoryId);
}

function mergeEvidence(left: ChildResultEvidence, right: ChildResultEvidence | null): ChildResultEvidence {
  if (!right) return normalizeEvidence(left);
  return normalizeEvidence({
    ...left,
    ...right,
    github: mergeGithubEvidence(left.github, right.github),
  });
}

function normalizeEvidence(evidence: ChildResultEvidence): ChildResultEvidence {
  const github = evidence.github;
  if (!github) return evidence;
  const normalized: ChildResultEvidence = { ...evidence };
  normalized.prNumber ??= github.prNumber;
  normalized.prUrl ??= github.prUrl;
  if (github.merge) {
    normalized.merged ??= github.merge.merged;
    normalized.mergedAt ??= github.merge.mergedAt ?? undefined;
    normalized.mergeCommit ??= github.merge.commit ?? undefined;
    normalized.branchDeleted ??= github.merge.branchDeleted ?? undefined;
  }
  return normalized;
}

function mergeGithubEvidence(
  left: GithubEvidence | undefined,
  right: GithubEvidence | undefined,
): GithubEvidence | undefined {
  if (!left) return right;
  if (!right) return left;
  return {
    ...left,
    ...right,
    checks: right.checks ?? left.checks,
    review: right.review ?? left.review,
    merge: right.merge ?? left.merge,
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readGithubAliases(value: Record<string, unknown>): GithubEvidence | null {
  const checks = readGithubChecks(value.checks) ?? readGithubChecks(value.ci);
  const review = readGithubReview(value.review) ?? readGithubReview(value.prReview);
  const merge = readGithubMerge(value.merge);
  const prNumber = readNumber(value.prNumber);
  const prUrl = readString(value.prUrl);
  const evidence: GithubEvidence = {};
  if (prNumber !== null) evidence.prNumber = prNumber;
  if (prUrl) evidence.prUrl = prUrl;
  if (checks) evidence.checks = checks;
  if (review) evidence.review = review;
  if (merge) evidence.merge = merge;
  return Object.keys(evidence).length > 0 ? evidence : null;
}

function readGithubEvidence(value: unknown): GithubEvidence | null {
  if (!isRecord(value)) return null;
  const evidence: GithubEvidence = {};
  const prNumber = readNumber(value.prNumber);
  const prUrl = readString(value.prUrl);
  const checks = readGithubChecks(value.checks);
  const review = readGithubReview(value.review);
  const merge = readGithubMerge(value.merge);
  if (prNumber !== null) evidence.prNumber = prNumber;
  if (prUrl) evidence.prUrl = prUrl;
  if (checks) evidence.checks = checks;
  if (review) evidence.review = review;
  if (merge) evidence.merge = merge;
  return Object.keys(evidence).length > 0 ? evidence : null;
}

function readGithubChecks(value: unknown): GithubCheckEvidence[] | null {
  const entries = Array.isArray(value) ? value : isRecord(value) ? [value] : [];
  const checks = entries.flatMap((entry): GithubCheckEvidence[] => {
    if (!isRecord(entry)) return [];
    const status = readGithubCheckStatus(entry.status) ?? readGithubCheckStatus(entry.conclusion) ?? 'unknown';
    return [
      {
        command: readString(entry.command) ?? readString(entry.name),
        status,
        conclusion: readGithubCheckConclusion(entry.conclusion),
        detail: readString(entry.detail) ?? readString(entry.summary),
      },
    ];
  });
  return checks.length > 0 ? checks : null;
}

function readGithubReview(value: unknown): GithubReviewEvidence | null {
  if (!isRecord(value)) return null;
  const signal = readGithubReviewSignal(value.signal) ?? readGithubReviewSignal(value.status) ?? 'unknown';
  return {
    reviewer: readString(value.reviewer) ?? readString(value.bot),
    signal,
    mechanism: readGithubReviewMechanism(value.mechanism) ?? 'unknown',
    triaged: readBoolean(value.triaged) ?? readBoolean(value.resolved),
    findings: readNumber(value.findings),
    detail: readString(value.detail) ?? readString(value.summary),
  };
}

function readGithubMerge(value: unknown): GithubMergeEvidence | null {
  if (!isRecord(value)) return null;
  const merged = readBoolean(value.merged);
  const commit = readString(value.commit) ?? readString(value.mergeCommit) ?? readString(value.mergeCommitSha);
  const mergedAt = readString(value.mergedAt);
  const branchDeleted = readBoolean(value.branchDeleted);
  if (merged === null && commit === null && mergedAt === null && branchDeleted === null) return null;
  return {
    merged: merged ?? (commit !== null || mergedAt !== null),
    method: readGithubMergeMethod(value.method),
    commit,
    mergedAt,
    branchDeleted,
    detail: readString(value.detail),
  };
}

function readGithubCheckStatus(value: unknown): GithubCheckEvidence['status'] | null {
  if (value === 'passed' || value === 'success') return 'passed';
  if (value === 'failed' || value === 'failure' || value === 'timed_out' || value === 'action_required')
    return 'failed';
  if (value === 'skipped' || value === 'neutral' || value === 'cancelled') return 'skipped';
  if (value === 'unknown') return 'unknown';
  return null;
}

function readGithubCheckConclusion(value: unknown): GithubCheckEvidence['conclusion'] | null {
  if (
    value === 'success' ||
    value === 'failure' ||
    value === 'cancelled' ||
    value === 'skipped' ||
    value === 'neutral' ||
    value === 'timed_out' ||
    value === 'action_required' ||
    value === 'unknown'
  ) {
    return value;
  }
  return null;
}

function readGithubReviewSignal(value: unknown): GithubReviewEvidence['signal'] | null {
  if (
    value === 'approved' ||
    value === 'pending' ||
    value === 'findings' ||
    value === 'commented' ||
    value === 'unknown'
  ) {
    return value;
  }
  return null;
}

function readGithubReviewMechanism(value: unknown): GithubReviewEvidence['mechanism'] | null {
  if (
    value === 'reaction' ||
    value === 'comment' ||
    value === 'review-comment' ||
    value === 'native-review' ||
    value === 'unknown'
  ) {
    return value;
  }
  return null;
}

function readGithubMergeMethod(value: unknown): GithubMergeEvidence['method'] | null {
  if (value === 'squash' || value === 'merge' || value === 'rebase' || value === 'unknown') return value;
  return null;
}

function githubEvidenceFromContent(content: string, compatibility: ChildResultEvidence): GithubEvidence | null {
  const github: GithubEvidence = {};
  if (compatibility.prNumber !== undefined) github.prNumber = compatibility.prNumber;
  if (compatibility.prUrl) github.prUrl = compatibility.prUrl;
  const checks = checksFromContent(content);
  const review = reviewFromContent(content);
  const merge = mergeFromContent(content, compatibility);
  if (checks.length > 0) github.checks = checks;
  if (review) github.review = review;
  if (merge) github.merge = merge;
  return Object.keys(github).length > 0 ? github : null;
}

function checksFromContent(content: string): GithubCheckEvidence[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /\b(?:checks?|ci|gh pr checks)\b/i.test(line))
    .flatMap((line): GithubCheckEvidence[] => {
      const detailOnly = line.replaceAll(/`[^`]+`/g, '');
      const status = hasFailureSignal(detailOnly)
        ? 'failed'
        : /\bskipped?\b/i.test(line)
          ? 'skipped'
          : /\bpass(?:ed|ing)?|green|success\b/i.test(line)
            ? 'passed'
            : null;
      if (!status) return [];
      return [{ command: line.match(/`([^`]+)`/)?.[1] ?? 'gh pr checks', status, detail: line }];
    });
}

function reviewFromContent(content: string): GithubReviewEvidence | null {
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!/\b(?:codex|review|reaction|comment|finding)\b/i.test(line)) continue;
    if (/\b(?:eyes|pending)\b/i.test(line)) {
      return {
        reviewer: reviewerFromLine(line),
        signal: 'pending',
        mechanism: 'reaction',
        findings: 0,
        detail: line,
      };
    }
    if (/\b(?:thumbs-up|\+1|approved|clear|no findings)\b/i.test(line)) {
      return {
        reviewer: reviewerFromLine(line),
        signal: 'approved',
        mechanism: /\breaction\b/i.test(line) || /\b(?:thumbs-up|\+1)\b/i.test(line) ? 'reaction' : 'comment',
        findings: 0,
        detail: line,
      };
    }
    if (/\b(?:findings?|comments?|changes requested)\b/i.test(line) && !/\bno findings\b/i.test(line)) {
      return {
        reviewer: reviewerFromLine(line),
        signal: 'findings',
        mechanism: /\breview comments?\b/i.test(line) ? 'review-comment' : 'comment',
        triaged: /\b(?:triaged|resolved|replied)\b/i.test(line) ? true : null,
        findings: numberBefore(line, /\s+(?:finding|findings|comment|comments)\b/i),
        detail: line,
      };
    }
  }
  return null;
}

function mergeFromContent(content: string, compatibility: ChildResultEvidence): GithubMergeEvidence | null {
  const merged = compatibility.merged === true || typeof compatibility.mergeCommit === 'string';
  const branchDeleted =
    compatibility.branchDeleted ??
    content
      .split('\n')
      .some((line) => /remote story branch (?:was )?deleted|branch deletion confirmed|branch deleted/i.test(line));
  if (!merged && !branchDeleted) return null;
  const mergeLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /\bmerged\b/i.test(line) && !hasNegatedMergeEvidence(line));
  return {
    merged,
    method:
      mergeLine && /\bsquash\b/i.test(mergeLine)
        ? 'squash'
        : mergeLine && /\brebase\b/i.test(mergeLine)
          ? 'rebase'
          : mergeLine && /\bmerge commit\b/i.test(mergeLine)
            ? 'merge'
            : null,
    commit: compatibility.mergeCommit ?? null,
    mergedAt: compatibility.mergedAt ?? null,
    branchDeleted,
    detail: mergeLine ?? null,
  };
}

function reviewerFromLine(line: string): string | null {
  if (/\bcodex\b/i.test(line)) return 'codex';
  return null;
}

function numberBefore(line: string, pattern: RegExp): number | null {
  const match = line.match(new RegExp(`\\b(\\d+)${pattern.source}`, pattern.flags));
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function readVerification(value: unknown): VerificationEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): VerificationEvidence[] => {
    if (typeof entry === 'string') return [{ command: entry, status: 'passed' }];
    if (!isRecord(entry)) return [];
    const rawStatus = readString(entry.status);
    if (rawStatus !== 'passed' && rawStatus !== 'failed' && rawStatus !== 'skipped') return [];
    const detail = readString(entry.detail);
    const status = rawStatus === 'passed' && detail && verificationStatus(detail) === 'failed' ? 'failed' : rawStatus;
    return [
      {
        command: readString(entry.command),
        status,
        phase: readString(entry.phase),
        detail,
      },
    ];
  });
}
