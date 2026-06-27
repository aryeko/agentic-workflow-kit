export { classifyChangedPaths } from './classify-changed-paths.js';
export { evaluateCompletion } from './evaluate-completion.js';
export { isVerificationFresh } from './is-verification-fresh.js';
export { selectCompletionCandidateHead } from './select-completion-candidate-head.js';
export type {
  ChangedPathClassification,
  ChangedPathGateResult,
  CompletionEvaluationCommit,
  CompletionEvaluationFailure,
  CompletionEvaluatorDependencies,
  EvaluateCompletionInput,
  ProtectedPolicySnapshotInput,
  VerificationFreshnessResult,
  VerificationWindow,
  WorkerClaim,
  WorkerClaimEvidence,
} from './types.js';
