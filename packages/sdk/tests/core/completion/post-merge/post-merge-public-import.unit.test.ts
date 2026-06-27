import { classifyPostMergeOutcome, recordPostMergeOutcome } from 'sdk';
import type * as sdk from 'sdk';
import { describe, expect, it } from 'vitest';

describe('core-05-s5 public sdk post-merge imports', () => {
  it('imports the post-merge classifier and recorder from sdk', () => {
    const input: sdk.RecordPostMergeOutcomeInput = {
      runId: 'run-public-import-01',
      evaluatedAt: '2026-06-27T16:00:00.000Z',
      mergeIntent: {
        eventId: 'evt-merge-intent-01',
        intent: {
          schema: 'kit-vnext.merge-intent-recorded.v1',
          runId: 'run-public-import-01',
          operation: 'merge',
          expectedHeadSha: 'head-public-import-01',
          policyRef: 'policy:merge',
          gateEventId: 'evt-gate-01',
          mergeDecisionEventId: 'evt-merge-decision-01',
          recordedAt: '2026-06-27T15:59:00.000Z',
        },
      },
      sourceActionEventId: 'evt-source-action-01',
      sourceActionEventType: 'ForgePullRequestMerged',
      actionResult: {
        kind: 'accepted',
        observedHeadSha: 'head-public-import-01',
        redactionFingerprintIds: [],
        credentialAuditEventIds: [],
        evidenceRef: 'artifact://public-import/accepted',
        at: '2026-06-27T16:00:00.000Z',
      },
      exactHeadEvidenceRefs: [
        {
          eventId: 'evt-merge-intent-01',
          sequence: 7,
          payloadDigest: 'sha256:merge-intent',
          type: 'MergeIntentRecorded',
        },
      ],
    };

    expect(typeof classifyPostMergeOutcome).toBe('function');
    expect(typeof recordPostMergeOutcome).toBe('function');
    expect(input.sourceActionEventType).toBe('ForgePullRequestMerged');
  });
});
