import {
  BLOCKER_EVIDENCE_ELIGIBLE_STATES,
  CHANGED_FILE_CLASSES,
  COMPLETION_DECISION_STATES,
  MERGE_DECISION_STATES,
  POST_MERGE_OUTCOME_STATES,
} from 'sdk';
import type * as sdk from 'sdk';
import { describe, expect, it } from 'vitest';

import { evidenceEventRefFixture, gateRecordFixture, runEventCursorFixture } from './shared.js';

describe('core-05-s1 public sdk completion imports', () => {
  it('imports the full completion contract surface from the sdk entrypoint', () => {
    const completionState: sdk.CompletionDecisionState = 'completion-verified';
    const mergeState: sdk.MergeDecisionState = 'merge-ready';
    const postMergeState: sdk.PostMergeOutcomeState = 'post-merge-confirmed';
    const changedFileClass: sdk.ChangedFileClass = 'allowed-task-change';
    const blockerState: sdk.BlockerEvidenceEligibleState = 'merge-review-not-approved';
    const replayAnchor: sdk.CompletionReplayAnchor = {
      runId: 'run-completion-01',
      evaluatedThrough: runEventCursorFixture,
      headSha: 'abc123',
      evidenceRefs: [evidenceEventRefFixture],
    };
    const evidenceSet: sdk.CompletionEvidenceSet = {
      anchor: replayAnchor,
      localGit: evidenceEventRefFixture,
      protectedPolicySnapshot: {
        ...evidenceEventRefFixture,
        eventId: 'evt-protected-policy-01',
        type: 'ProtectedPolicySnapshotRecorded',
      },
    };
    const completionDecision: sdk.CompletionDecisionPayload = {
      schema: 'kit-vnext.completion-decision-recorded.v1',
      runId: replayAnchor.runId,
      state: completionState,
      headSha: replayAnchor.headSha,
      cursor: runEventCursorFixture,
      evidenceRefs: [evidenceEventRefFixture],
      evaluatedAt: '2026-06-27T09:05:00.000Z',
    };
    const mergeDecision: sdk.MergeDecisionPayload = {
      schema: 'kit-vnext.merge-decision-recorded.v1',
      runId: replayAnchor.runId,
      state: mergeState,
      headSha: replayAnchor.headSha,
      completionEventId: 'evt-completion-01',
      gateRef: gateRecordFixture,
      forgeRefs: [{ ...evidenceEventRefFixture, eventId: 'evt-forge-01', type: 'ForgeEvidenceCollected' }],
      evaluatedAt: '2026-06-27T09:06:00.000Z',
    };
    const policySnapshot: sdk.ProtectedPolicySnapshotRecordedPayload = {
      schema: 'kit-vnext.protected-policy-snapshot-recorded.v1',
      runId: replayAnchor.runId,
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
    const forgeIntent: sdk.ForgeOperationIntentPayload = {
      schema: 'kit-vnext.forge-operation-intent-recorded.v1',
      runId: replayAnchor.runId,
      operation: 'publish-blocker-evidence',
      expectedHeadSha: replayAnchor.headSha,
      policyRef: 'policy:merge',
      decisionEventId: 'evt-completion-02',
      evidenceRefs: [evidenceEventRefFixture],
      purpose: 'blocker-evidence-pr',
      blockerState: 'verification-failed',
      recordedAt: '2026-06-27T09:07:00.000Z',
    };
    const mergeIntent: sdk.MergeIntentPayload = {
      schema: 'kit-vnext.merge-intent-recorded.v1',
      runId: replayAnchor.runId,
      operation: 'merge',
      expectedHeadSha: replayAnchor.headSha,
      policyRef: 'policy:merge',
      gateEventId: 'evt-gate-01',
      mergeDecisionEventId: 'evt-merge-01',
      recordedAt: '2026-06-27T09:08:00.000Z',
    };
    const postMergeOutcome: sdk.PostMergeOutcomePayload = {
      schema: 'kit-vnext.post-merge-outcome-recorded.v1',
      runId: replayAnchor.runId,
      state: postMergeState,
      headSha: replayAnchor.headSha,
      sourceActionEventId: 'evt-forge-merge-01',
      evidenceRefs: [evidenceEventRefFixture],
      lifecycleTarget: 'completed',
      recordedAt: '2026-06-27T09:09:00.000Z',
    };
    const evaluator: sdk.CompletionMergeEvaluator = {
      evaluateCompletion: () => completionDecision,
      evaluateMerge: () => mergeDecision,
    };

    expect(COMPLETION_DECISION_STATES).toContain(completionState);
    expect(MERGE_DECISION_STATES).toContain(mergeState);
    expect(POST_MERGE_OUTCOME_STATES).toContain(postMergeState);
    expect(CHANGED_FILE_CLASSES).toContain(changedFileClass);
    expect(BLOCKER_EVIDENCE_ELIGIBLE_STATES).toContain(blockerState);
    expect(evidenceSet.anchor.headSha).toBe('abc123');
    expect(policySnapshot.protectedPathSets[0]?.label).toBe('ci-definitions');
    expect(forgeIntent.purpose).toBe('blocker-evidence-pr');
    expect(mergeIntent.mergeDecisionEventId).toBe('evt-merge-01');
    expect(postMergeOutcome.lifecycleTarget).toBe('completed');
    expect(evaluator.evaluateCompletion).toBeTypeOf('function');
  });
});
