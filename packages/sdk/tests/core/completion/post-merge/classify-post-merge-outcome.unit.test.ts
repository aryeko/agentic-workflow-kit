import { describe, expect, it } from 'vitest';

import { classifyPostMergeOutcome } from '../../../../src/core/completion/post-merge/index.js';

import {
  createAcceptedResult,
  createDegradedResult,
  createInput,
  createRefusedResult,
  evaluatedAt,
  exactHeadEvidenceRefs,
  expectedHeadSha,
  runId,
} from './shared.js';

describe('core-05-s5 post-merge outcome classification', () => {
  it('post-merge-confirmed-exact-head maps a merged exact head to completed', () => {
    const outcome = classifyPostMergeOutcome(createInput());

    expect(outcome).toEqual({
      schema: 'kit-vnext.post-merge-outcome-recorded.v1',
      runId,
      state: 'post-merge-confirmed',
      headSha: expectedHeadSha,
      sourceActionEventId: 'evt-source-action-01',
      evidenceRefs: exactHeadEvidenceRefs,
      lifecycleTarget: 'completed',
      recordedAt: evaluatedAt,
    });
  });

  it('post-merge-retryable-refusals map exact-head retryable refusal tokens to merge-waiting', () => {
    const tokens = ['forge-rate-limited', 'forge-merge-queue-unavailable'] as const;

    for (const token of tokens) {
      const outcome = classifyPostMergeOutcome(
        createInput({
          sourceActionEventType: 'ForgeActionRefused',
          actionResult: createRefusedResult(token),
        }),
      );

      expect(outcome.state).toBe('post-merge-retryable-refused');
      expect(outcome.lifecycleTarget).toBe('merge-waiting');
    }
  });

  it('post-merge-blocked-failed-matrix splits exact-head blockers from provider failures', () => {
    const blockedTokens = [
      'forge-protection-uninspectable',
      'forge-rulesets-unattested',
      'forge-review-threads-uninspectable',
    ] as const;
    const failedTokens = [
      'forge-credential-unavailable',
      'forge-auth-denied',
      'forge-admin-bypass-refused',
      'forge-ghes-capability-unknown',
      'forge-redaction-unavailable',
    ] as const;

    for (const token of blockedTokens) {
      const outcome = classifyPostMergeOutcome(
        createInput({
          sourceActionEventType: 'ForgeActionRefused',
          actionResult: createRefusedResult(token),
        }),
      );

      expect(outcome.state).toBe('post-merge-blocked');
      expect(outcome.lifecycleTarget).toBe('blocked');
    }

    for (const token of failedTokens) {
      const outcome = classifyPostMergeOutcome(
        createInput({
          sourceActionEventType: 'ForgeActionRefused',
          actionResult: createRefusedResult(token),
        }),
      );

      expect(outcome.state).toBe('post-merge-failed');
      expect(outcome.lifecycleTarget).toBe('failed');
    }
  });

  it('post-merge-ambiguous-never-completed fails closed for missing, unknown, mismatched, or contradictory results', () => {
    const cases = [
      createInput({
        sourceActionEventType: 'ForgeActionRefused',
        actionResult: undefined,
      }),
      createInput({
        sourceActionEventType: 'ForgeActionRefused',
        actionResult: createDegradedResult('forge-state-unknown', { observedHeadSha: undefined }),
      }),
      createInput({
        actionResult: createAcceptedResult({ observedHeadSha: 'head-other-01' }),
      }),
      createInput({
        sourceActionEventType: 'ForgePullRequestMerged',
        actionResult: createRefusedResult('forge-rate-limited'),
      }),
      createInput({
        sourceActionEventType: 'ForgeActionRefused',
        actionResult: createAcceptedResult(),
      }),
      createInput({
        sourceActionEventType: 'ForgeMergeQueued',
        actionResult: createAcceptedResult(),
      }),
      createInput({
        sourceActionEventType: 'ForgeActionRefused',
        actionResult: createRefusedResult('forge-head-mismatch', { observedHeadSha: expectedHeadSha }),
      }),
    ];

    for (const input of cases) {
      const outcome = classifyPostMergeOutcome(input);

      expect(outcome.state).toBe('post-merge-outcome-ambiguous');
      expect(outcome.lifecycleTarget).toBe('blocked');
      expect(outcome.lifecycleTarget).not.toBe('completed');
    }
  });
});
