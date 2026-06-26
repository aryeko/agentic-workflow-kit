import type { CapabilityGateRecordPayload, EvidenceEventRef, RunEventCursor } from '../../../../src/index.js';

export const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${String(value)}`);
};

export const expectedCompletionDecisionStates = [
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
] as const;

export const expectedMergeDecisionStates = [
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
] as const;

export const expectedPostMergeOutcomeStates = [
  'post-merge-confirmed',
  'post-merge-retryable-refused',
  'post-merge-blocked',
  'post-merge-failed',
  'post-merge-outcome-ambiguous',
] as const;

export const expectedChangedFileClasses = [
  'allowed-task-change',
  'protected-policy-change',
  'runner-evidence-change',
  'outside-allowlist',
  'unclassified',
] as const;

export const expectedBlockerEligibleCompletionStates = [
  'completion-pending-evidence',
  'claim-evidence-mismatch',
  'verification-failed',
  'verification-uncertain',
  'protected-policy-change-unapproved',
] as const;

export const expectedBlockerEligibleMergeStates = [
  'merge-policy-disabled',
  'merge-required-check-missing',
  'merge-required-check-failed',
  'merge-review-not-approved',
  'merge-unresolved-review-threads',
  'merge-protection-snapshot-stale',
  'merge-branch-not-fresh',
  'merge-capability-denied',
] as const;

export const expectedBlockerEligibleStates = [
  ...expectedBlockerEligibleCompletionStates,
  ...expectedBlockerEligibleMergeStates,
] as const;

export const runEventCursorFixture: RunEventCursor = {
  runId: 'run-completion-01',
  afterSequence: 41,
};

export const evidenceEventRefFixture: EvidenceEventRef = {
  eventId: 'evt-evidence-01',
  sequence: 41,
  payloadDigest: 'sha256:evidence-01',
  type: 'LocalGitEvidenceRecorded',
};

export const gateRecordFixture: CapabilityGateRecordPayload = {
  schema: 'kit-vnext.capability-gate-record.v1',
  gateId: 'gate-auto-merge-01',
  capability: 'auto-merge',
  decision: 'allow',
  mode: 'assisted',
  scope: {
    runId: 'run-completion-01',
    operationId: 'merge-intent-01',
    providerScopes: [
      {
        provider: 'Forge',
        scope: 'repo:aryeko/workflow-kit/pull:42',
        freshnessKey: 'forge:pr:42:abc123',
      },
    ],
    expectedHeadSha: 'abc123',
    pullRequestRef: 'pr:42',
  },
  policyRef: 'policy:merge',
  requestedByDomain: 'core-05',
  requestedAction: 'merge',
  evaluatedAt: '2026-06-27T09:00:00.000Z',
  evaluatedGuarantees: [],
  attestationRefs: [],
  evidenceRefs: ['artifact://gate-evidence'],
};
