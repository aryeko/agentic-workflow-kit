import { isRecord } from '../../internal/guards.js';
import type { ChildResultEvidence, VerificationEvidence } from '../../types.js';

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
  const storyId = readString(value.storyId);
  const finalStatus = readString(value.finalStatus) ?? readString(value.status);
  const trackerPath = readString(value.trackerPath);
  const trackerStatusEvidence = readString(value.trackerStatusEvidence);
  const prNumber = readNumber(value.prNumber);
  const prUrl = readString(value.prUrl);
  const merged = readBoolean(value.merged);
  const mergedAt = readString(value.mergedAt);
  const mergeCommit = readString(value.mergeCommit);
  const branchDeleted = readBoolean(value.branchDeleted);
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
  return right ? { ...left, ...right } : left;
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
