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
  CompletionDecisionPayload,
  CompletionDecisionState,
  CompletionEvidenceSet,
  CompletionMergeEvaluator,
  CompletionReplayAnchor,
  ForgeOperationIntentPayload,
  MergeDecisionPayload,
  MergeDecisionState,
  MergeIntentPayload,
  PostMergeOutcomePayload,
  PostMergeOutcomeState,
  ProtectedPolicySnapshotRecordedPayload,
} from '../../../../src/index.js';

import {
  assertNever,
  evidenceEventRefFixture,
  expectedBlockerEligibleCompletionStates,
  expectedBlockerEligibleMergeStates,
  expectedBlockerEligibleStates,
  expectedChangedFileClasses,
  expectedCompletionDecisionStates,
  expectedMergeDecisionStates,
  expectedPostMergeOutcomeStates,
  gateRecordFixture,
  runEventCursorFixture,
} from './shared.js';

const describeCompletionDecisionState = (value: CompletionDecisionState): string => {
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

const describeMergeDecisionState = (value: MergeDecisionState): string => {
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

const describePostMergeOutcomeState = (value: PostMergeOutcomeState): string => {
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

const completionCatalog = COMPLETION_DECISION_STATES.map(describeCompletionDecisionState);
const mergeCatalog = MERGE_DECISION_STATES.map(describeMergeDecisionState);
const postMergeCatalog = POST_MERGE_OUTCOME_STATES.map(describePostMergeOutcomeState);
const changedFileCatalog = CHANGED_FILE_CLASSES.map(describeChangedFileClass);
const blockerCompletionCatalog = BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES.map(describeBlockerState);
const blockerMergeCatalog = BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES.map(describeBlockerState);
const blockerCatalog = BLOCKER_EVIDENCE_ELIGIBLE_STATES.map(describeBlockerState);

const completionStates = expectedCompletionDecisionStates satisfies readonly CompletionDecisionState[];
const mergeStates = expectedMergeDecisionStates satisfies readonly MergeDecisionState[];
const postMergeStates = expectedPostMergeOutcomeStates satisfies readonly PostMergeOutcomeState[];
const changedFileClasses = expectedChangedFileClasses satisfies readonly ChangedFileClass[];
const blockerCompletionStates =
  expectedBlockerEligibleCompletionStates satisfies readonly BlockerEvidenceEligibleState[];
const blockerMergeStates = expectedBlockerEligibleMergeStates satisfies readonly BlockerEvidenceEligibleState[];
const blockerStates = expectedBlockerEligibleStates satisfies readonly BlockerEvidenceEligibleState[];

const replayAnchor: CompletionReplayAnchor = {
  runId: 'run-completion-01',
  evaluatedThrough: runEventCursorFixture,
  writerEpoch: 2,
  headSha: 'abc123',
  evidenceRefs: [evidenceEventRefFixture],
};

const evidenceSet: CompletionEvidenceSet = {
  anchor: replayAnchor,
  localGit: evidenceEventRefFixture,
  verification: {
    command: { ...evidenceEventRefFixture, eventId: 'evt-verify-01', type: 'RunnerCommandCaptured' },
    preLocalGit: { ...evidenceEventRefFixture, eventId: 'evt-local-pre-01', sequence: 39 },
    postLocalGit: { ...evidenceEventRefFixture, eventId: 'evt-local-post-01', sequence: 41 },
  },
  forge: { ...evidenceEventRefFixture, eventId: 'evt-forge-01', type: 'ForgeEvidenceCollected' },
  capabilityGate: { ...evidenceEventRefFixture, eventId: 'evt-gate-01', type: 'CapabilityGateRecord' },
  workerClaim: { ...evidenceEventRefFixture, eventId: 'evt-claim-01', type: 'WorkerClaimRecorded' },
  protectedPolicySnapshot: {
    ...evidenceEventRefFixture,
    eventId: 'evt-protected-policy-01',
    type: 'ProtectedPolicySnapshotRecorded',
  },
  recordedOperatorDecision: {
    ...evidenceEventRefFixture,
    eventId: 'evt-approval-01',
    type: 'ApprovalDecisionRecorded',
  },
};

const completionDecision: CompletionDecisionPayload = {
  schema: 'kit-vnext.completion-decision-recorded.v1',
  runId: 'run-completion-01',
  state: 'completion-verified',
  headSha: replayAnchor.headSha,
  cursor: runEventCursorFixture,
  evidenceRefs: [evidenceEventRefFixture],
  evaluatedAt: '2026-06-27T09:05:00.000Z',
};

const mergeDecision: MergeDecisionPayload = {
  schema: 'kit-vnext.merge-decision-recorded.v1',
  runId: 'run-completion-01',
  state: 'merge-ready',
  headSha: replayAnchor.headSha,
  completionEventId: 'evt-completion-01',
  gateRef: gateRecordFixture,
  forgeRefs: [{ ...evidenceEventRefFixture, eventId: 'evt-forge-01', type: 'ForgeEvidenceCollected' }],
  evaluatedAt: '2026-06-27T09:06:00.000Z',
};

const protectedPolicySnapshot: ProtectedPolicySnapshotRecordedPayload = {
  schema: 'kit-vnext.protected-policy-snapshot-recorded.v1',
  runId: 'run-completion-01',
  policyRef: 'policy:merge',
  policyDigest: 'sha256:policy-01',
  baseSha: 'base123',
  verifierCommandDigest: 'sha256:verify-command',
  protectedPathSets: [
    {
      label: 'ci-definitions',
      digest: 'sha256:ci-paths',
      paths: ['.github/workflows/check.yml'],
    },
  ],
  recordedAt: '2026-06-27T09:00:00.000Z',
};

const forgeIntent: ForgeOperationIntentPayload = {
  schema: 'kit-vnext.forge-operation-intent-recorded.v1',
  runId: 'run-completion-01',
  operation: 'publish-blocker-evidence',
  expectedHeadSha: replayAnchor.headSha,
  policyRef: 'policy:merge',
  decisionEventId: 'evt-completion-02',
  evidenceRefs: [evidenceEventRefFixture],
  purpose: 'blocker-evidence-pr',
  blockerState: 'verification-failed',
  recordedAt: '2026-06-27T09:07:00.000Z',
};

const mergeIntent: MergeIntentPayload = {
  schema: 'kit-vnext.merge-intent-recorded.v1',
  runId: 'run-completion-01',
  operation: 'merge',
  expectedHeadSha: replayAnchor.headSha,
  policyRef: 'policy:merge',
  gateEventId: 'evt-gate-01',
  mergeDecisionEventId: 'evt-merge-01',
  recordedAt: '2026-06-27T09:08:00.000Z',
};

const postMergeOutcome: PostMergeOutcomePayload = {
  schema: 'kit-vnext.post-merge-outcome-recorded.v1',
  runId: 'run-completion-01',
  state: 'post-merge-confirmed',
  headSha: replayAnchor.headSha,
  sourceActionEventId: 'evt-forge-merge-01',
  evidenceRefs: [evidenceEventRefFixture],
  lifecycleTarget: 'completed',
  recordedAt: '2026-06-27T09:09:00.000Z',
};

const evaluator: CompletionMergeEvaluator = {
  evaluateCompletion(input) {
    return {
      ...completionDecision,
      runId: input.runId,
      cursor: input.evaluatedThrough,
      evaluatedAt: input.evaluatedAt,
    };
  },
  evaluateMerge(input) {
    return {
      ...mergeDecision,
      runId: input.runId,
      completionEventId: input.completionEventId,
      evaluatedAt: input.evaluatedAt,
    };
  },
};

void completionCatalog;
void mergeCatalog;
void postMergeCatalog;
void changedFileCatalog;
void blockerCompletionCatalog;
void blockerMergeCatalog;
void blockerCatalog;
void completionStates;
void mergeStates;
void postMergeStates;
void changedFileClasses;
void blockerCompletionStates;
void blockerMergeStates;
void blockerStates;
void replayAnchor;
void evidenceSet;
void completionDecision;
void mergeDecision;
void protectedPolicySnapshot;
void forgeIntent;
void mergeIntent;
void postMergeOutcome;
void evaluator;
