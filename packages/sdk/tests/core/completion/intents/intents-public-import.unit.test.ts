import {
  recordBlockerEvidenceIntent,
  recordForgeOperationIntent,
  recordMergeIntent,
  type CompletionDecisionPayload,
  type MergeDecisionPayload,
} from 'sdk';
import type * as sdk from 'sdk';
import { describe, expect, it } from 'vitest';

describe('core-05-s4 public sdk intent imports', () => {
  it('imports the intent recorders and input types from sdk', () => {
    const localHead: sdk.ExactHeadEvidence = {
      headSha: 'head-public-import-01',
      clean: true,
      evidenceRefs: [
        {
          eventId: 'evt-local-01',
          sequence: 1,
          payloadDigest: 'sha256:local-01',
          type: 'LocalGitEvidenceRecorded',
        },
      ],
    };
    const completionDecision: CompletionDecisionPayload = {
      schema: 'kit-vnext.completion-decision-recorded.v1',
      runId: 'run-public-import-01',
      state: 'verification-failed',
      headSha: localHead.headSha,
      cursor: { runId: 'run-public-import-01', afterSequence: 8 },
      evidenceRefs: [...(localHead.evidenceRefs ?? [])],
      evaluatedAt: '2026-06-27T12:30:00.000Z',
    };
    const mergeDecision: MergeDecisionPayload = {
      schema: 'kit-vnext.merge-decision-recorded.v1',
      runId: 'run-public-import-01',
      state: 'merge-ready',
      headSha: localHead.headSha!,
      completionEventId: 'evt-completion-01',
      gateRef: {
        schema: 'kit-vnext.capability-gate-record.v1',
        gateId: 'gate-public-import-01',
        capability: 'auto-merge',
        decision: 'allow',
        mode: 'assisted',
        scope: {
          runId: 'run-public-import-01',
          operationId: 'merge-op-public-import-01',
          providerScopes: [],
          pullRequestRef: 'pr:124',
          expectedHeadSha: localHead.headSha!,
        },
        policyRef: 'policy:merge',
        requestedByDomain: 'core-05',
        requestedAction: 'merge-pull-request',
        evaluatedAt: '2026-06-27T12:31:00.000Z',
        evaluatedGuarantees: [],
        attestationRefs: [],
        evidenceRefs: [],
      },
      forgeRefs: [],
      evaluatedAt: '2026-06-27T12:31:00.000Z',
    };
    const forgeInput: sdk.RecordForgeOperationIntentInput = {
      runId: 'run-public-import-01',
      recordedAt: '2026-06-27T12:32:00.000Z',
      operation: 'update-branch',
      policyRef: 'policy:merge',
      decisionEventId: 'evt-completion-01',
      expectedHeadSha: localHead.headSha,
      localHead,
      evidenceRefs: [...(localHead.evidenceRefs ?? [])],
    };
    const mergeInput: sdk.RecordMergeIntentInput = {
      runId: 'run-public-import-01',
      recordedAt: '2026-06-27T12:33:00.000Z',
      operation: 'merge',
      policyRef: 'policy:merge',
      gateEventId: 'evt-gate-01',
      mergeDecision: {
        eventId: 'evt-merge-01',
        decision: mergeDecision,
      },
    };
    const blockerInput: sdk.RecordBlockerEvidenceIntentInput = {
      runId: 'run-public-import-01',
      recordedAt: '2026-06-27T12:34:00.000Z',
      operation: 'publish-blocker-evidence',
      policyRef: 'policy:merge',
      runnerMayPush: true,
      runnerMayOpenPr: true,
      localHead,
      decision: {
        kind: 'completion',
        eventId: 'evt-completion-01',
        decision: completionDecision,
      },
    };

    expect(typeof recordForgeOperationIntent).toBe('function');
    expect(typeof recordMergeIntent).toBe('function');
    expect(typeof recordBlockerEvidenceIntent).toBe('function');
    expect(forgeInput.operation).toBe('update-branch');
    expect(mergeInput.mergeDecision.decision.state).toBe('merge-ready');
    expect(blockerInput.decision.kind).toBe('completion');
  });
});
