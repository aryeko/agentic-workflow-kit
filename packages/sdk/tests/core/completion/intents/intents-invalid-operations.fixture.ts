import type {
  RecordBlockerEvidenceIntentInput,
  RecordForgeOperationIntentInput,
  RecordMergeIntentInput,
} from '../../../../src/index.js';

const localHead = {
  headSha: 'head-typecheck-01',
  clean: true,
} as const;

const invalidForgeInput: RecordForgeOperationIntentInput = {
  runId: 'run-typecheck-01',
  recordedAt: '2026-06-27T12:40:00.000Z',
  // @ts-expect-error Forge operation intents must not accept merge-only operations.
  operation: 'merge',
  policyRef: 'policy:merge',
  decisionEventId: 'evt-completion-01',
  expectedHeadSha: localHead.headSha,
  localHead,
  evidenceRefs: [],
};

const invalidMergeInput: RecordMergeIntentInput = {
  runId: 'run-typecheck-01',
  recordedAt: '2026-06-27T12:41:00.000Z',
  // @ts-expect-error Merge intents must only accept enqueue or merge.
  operation: 'publish-blocker-evidence',
  policyRef: 'policy:merge',
  gateEventId: 'evt-gate-01',
  mergeDecision: {
    eventId: 'evt-merge-01',
    decision: {
      schema: 'kit-vnext.merge-decision-recorded.v1',
      runId: 'run-typecheck-01',
      state: 'merge-ready',
      headSha: localHead.headSha,
      completionEventId: 'evt-completion-01',
      gateRef: {
        schema: 'kit-vnext.capability-gate-record.v1',
        gateId: 'gate-typecheck-01',
        capability: 'auto-merge',
        decision: 'allow',
        mode: 'assisted',
        scope: {
          runId: 'run-typecheck-01',
          operationId: 'merge-op-typecheck-01',
          providerScopes: [],
          pullRequestRef: 'pr:124',
          expectedHeadSha: localHead.headSha,
        },
        policyRef: 'policy:merge',
        requestedByDomain: 'core-05',
        requestedAction: 'merge-pull-request',
        evaluatedAt: '2026-06-27T12:41:00.000Z',
        evaluatedGuarantees: [],
        attestationRefs: [],
        evidenceRefs: [],
      },
      forgeRefs: [],
      evaluatedAt: '2026-06-27T12:41:00.000Z',
    },
  },
};

const invalidBlockerInput: RecordBlockerEvidenceIntentInput = {
  runId: 'run-typecheck-01',
  recordedAt: '2026-06-27T12:42:00.000Z',
  // @ts-expect-error Blocker intents must stay on blocker-evidence PR operations only.
  operation: 'update-branch',
  policyRef: 'policy:merge',
  runnerMayPush: true,
  runnerMayOpenPr: true,
  localHead,
  decision: {
    kind: 'completion',
    eventId: 'evt-completion-01',
    decision: {
      schema: 'kit-vnext.completion-decision-recorded.v1',
      runId: 'run-typecheck-01',
      state: 'verification-failed',
      headSha: localHead.headSha,
      cursor: { runId: 'run-typecheck-01', afterSequence: 5 },
      evidenceRefs: [],
      evaluatedAt: '2026-06-27T12:42:00.000Z',
    },
  },
};

void invalidForgeInput;
void invalidMergeInput;
void invalidBlockerInput;
