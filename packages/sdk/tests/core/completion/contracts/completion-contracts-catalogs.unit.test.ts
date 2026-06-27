import { describe, expect, it } from 'vitest';

import {
  BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES,
  BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES,
  BLOCKER_EVIDENCE_ELIGIBLE_STATES,
  CHANGED_FILE_CLASSES,
  COMPLETION_DECISION_STATES,
  MERGE_DECISION_STATES,
  POST_MERGE_OUTCOME_STATES,
} from '../../../../src/index.js';
import type {
  BlockerEvidenceEligibleState,
  ChangedFileClass,
  CompletionDecisionState,
  MergeDecisionState,
  PostMergeOutcomeState,
} from '../../../../src/index.js';

import {
  assertNever,
  expectedBlockerEligibleCompletionStates,
  expectedBlockerEligibleMergeStates,
  expectedBlockerEligibleStates,
  expectedChangedFileClasses,
  expectedCompletionDecisionStates,
  expectedMergeDecisionStates,
  expectedPostMergeOutcomeStates,
} from './shared.js';

const describeCompletionState = (value: CompletionDecisionState): string => {
  switch (value) {
    case 'completion-verified':
    case 'completion-pending-evidence':
    case 'claim-evidence-mismatch':
    case 'verification-failed':
    case 'verification-uncertain':
    case 'workspace-dirty':
    case 'head-ambiguous':
    case 'changed-file-policy-absent':
    case 'changed-files-outside-allowlist':
    case 'protected-policy-change-unapproved':
    case 'forge-evidence-unavailable':
    case 'event-log-unwritable':
      return value;
    default:
      return assertNever(value);
  }
};

const describeMergeState = (value: MergeDecisionState): string => {
  switch (value) {
    case 'merge-ready':
    case 'merge-policy-disabled':
    case 'merge-required-check-missing':
    case 'merge-required-check-failed':
    case 'merge-review-not-approved':
    case 'merge-unresolved-review-threads':
    case 'merge-protection-snapshot-stale':
    case 'merge-branch-not-fresh':
    case 'merge-head-ambiguous':
    case 'merge-forge-unavailable':
    case 'merge-capability-denied':
    case 'merge-intent-unwritable':
      return value;
    default:
      return assertNever(value);
  }
};

const describePostMergeState = (value: PostMergeOutcomeState): string => {
  switch (value) {
    case 'post-merge-confirmed':
    case 'post-merge-retryable-refused':
    case 'post-merge-blocked':
    case 'post-merge-failed':
    case 'post-merge-outcome-ambiguous':
      return value;
    default:
      return assertNever(value);
  }
};

const describeChangedFileClass = (value: ChangedFileClass): string => {
  switch (value) {
    case 'allowed-task-change':
    case 'protected-policy-change':
    case 'runner-evidence-change':
    case 'outside-allowlist':
    case 'unclassified':
      return value;
    default:
      return assertNever(value);
  }
};

const describeBlockerState = (value: BlockerEvidenceEligibleState): string => {
  switch (value) {
    case 'completion-pending-evidence':
    case 'claim-evidence-mismatch':
    case 'verification-failed':
    case 'verification-uncertain':
    case 'protected-policy-change-unapproved':
    case 'merge-policy-disabled':
    case 'merge-required-check-missing':
    case 'merge-required-check-failed':
    case 'merge-review-not-approved':
    case 'merge-unresolved-review-threads':
    case 'merge-protection-snapshot-stale':
    case 'merge-branch-not-fresh':
    case 'merge-capability-denied':
      return value;
    default:
      return assertNever(value);
  }
};

describe('core-05-s1 completion contract catalogs', () => {
  it('exports the exact runtime catalogs', () => {
    expect(COMPLETION_DECISION_STATES.map(describeCompletionState)).toEqual(expectedCompletionDecisionStates);
    expect(MERGE_DECISION_STATES.map(describeMergeState)).toEqual(expectedMergeDecisionStates);
    expect(POST_MERGE_OUTCOME_STATES.map(describePostMergeState)).toEqual(expectedPostMergeOutcomeStates);
    expect(CHANGED_FILE_CLASSES.map(describeChangedFileClass)).toEqual(expectedChangedFileClasses);
    expect(BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES.map(describeBlockerState)).toEqual(
      expectedBlockerEligibleCompletionStates,
    );
    expect(BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES.map(describeBlockerState)).toEqual(
      expectedBlockerEligibleMergeStates,
    );
    expect(BLOCKER_EVIDENCE_ELIGIBLE_STATES.map(describeBlockerState)).toEqual(expectedBlockerEligibleStates);
  });

  it('freezes all runtime catalogs', () => {
    expect(Object.isFrozen(COMPLETION_DECISION_STATES)).toBe(true);
    expect(Object.isFrozen(MERGE_DECISION_STATES)).toBe(true);
    expect(Object.isFrozen(POST_MERGE_OUTCOME_STATES)).toBe(true);
    expect(Object.isFrozen(CHANGED_FILE_CLASSES)).toBe(true);
    expect(Object.isFrozen(BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES)).toBe(true);
    expect(Object.isFrozen(BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES)).toBe(true);
    expect(Object.isFrozen(BLOCKER_EVIDENCE_ELIGIBLE_STATES)).toBe(true);
  });
});
