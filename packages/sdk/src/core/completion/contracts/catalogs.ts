export const COMPLETION_DECISION_STATES = Object.freeze([
  'completion-verified',
  'completion-pending-evidence',
  'claim-evidence-mismatch',
  'verification-failed',
  'verification-uncertain',
  'workspace-dirty',
  'head-ambiguous',
  'changed-file-policy-absent',
  'changed-files-outside-allowlist',
  'protected-policy-change-unapproved',
  'forge-evidence-unavailable',
  'event-log-unwritable',
] as const);

export type CompletionDecisionState = (typeof COMPLETION_DECISION_STATES)[number];

export const MERGE_DECISION_STATES = Object.freeze([
  'merge-ready',
  'merge-policy-disabled',
  'merge-required-check-missing',
  'merge-required-check-failed',
  'merge-review-not-approved',
  'merge-unresolved-review-threads',
  'merge-protection-snapshot-stale',
  'merge-branch-not-fresh',
  'merge-head-ambiguous',
  'merge-forge-unavailable',
  'merge-capability-denied',
  'merge-intent-unwritable',
] as const);

export type MergeDecisionState = (typeof MERGE_DECISION_STATES)[number];

export const POST_MERGE_OUTCOME_STATES = Object.freeze([
  'post-merge-confirmed',
  'post-merge-retryable-refused',
  'post-merge-blocked',
  'post-merge-failed',
  'post-merge-outcome-ambiguous',
] as const);

export type PostMergeOutcomeState = (typeof POST_MERGE_OUTCOME_STATES)[number];

export const CHANGED_FILE_CLASSES = Object.freeze([
  'allowed-task-change',
  'protected-policy-change',
  'runner-evidence-change',
  'outside-allowlist',
  'unclassified',
] as const);

export type ChangedFileClass = (typeof CHANGED_FILE_CLASSES)[number];

export const BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES = Object.freeze([
  'completion-pending-evidence',
  'claim-evidence-mismatch',
  'verification-failed',
  'verification-uncertain',
  'protected-policy-change-unapproved',
] as const);

export type BlockerEvidenceEligibleCompletionState = (typeof BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES)[number];

export const BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES = Object.freeze([
  'merge-policy-disabled',
  'merge-required-check-missing',
  'merge-required-check-failed',
  'merge-review-not-approved',
  'merge-unresolved-review-threads',
  'merge-protection-snapshot-stale',
  'merge-branch-not-fresh',
  'merge-capability-denied',
] as const);

export type BlockerEvidenceEligibleMergeState = (typeof BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES)[number];

export const BLOCKER_EVIDENCE_ELIGIBLE_STATES = Object.freeze([
  ...BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES,
  ...BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES,
] as const);

export type BlockerEvidenceEligibleState = (typeof BLOCKER_EVIDENCE_ELIGIBLE_STATES)[number];
