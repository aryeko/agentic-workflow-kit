import type {
  AppendIntent,
  CapabilityGateRecordPayload,
  CompletionDecisionPayload,
  EvidenceEventRef,
  MergeDecisionPayload,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from '../../../../src/index.js';
import type {
  ExactHeadEvidence,
  RecordBlockerEvidenceIntentInput,
  RecordForgeOperationIntentInput,
  RecordMergeIntentInput,
} from '../../../../src/index.js';

type CapturingWriter = RunWriter & {
  readonly appendCalls: AppendIntent[][];
};

export const runId = 'run-completion-intents-01';
export const policyRef = 'policy:merge';
export const recordedAt = '2026-06-27T12:00:00.000Z';
export const headSha = 'head-intents-01';

export const createEvidenceRef = (eventId: string, type: string, sequence: number): EvidenceEventRef => ({
  eventId,
  sequence,
  payloadDigest: `sha256:${eventId}`,
  type,
});

export const localGitRef = createEvidenceRef('evt-local-git-01', 'LocalGitEvidenceRecorded', 21);
export const forgeRef = createEvidenceRef('evt-forge-evidence-01', 'ForgeEvidenceCollected', 22);
export const gateRef = createEvidenceRef('evt-gate-record-01', 'CapabilityGateRecord', 23);
export const verifyRef = createEvidenceRef('evt-verify-01', 'RunnerCommandCaptured', 24);

export const exactHeadEvidence: ExactHeadEvidence = {
  headSha,
  clean: true,
  evidenceRefs: [localGitRef],
};

export const createGateRecord = (
  overrides: Partial<CapabilityGateRecordPayload> = {},
): CapabilityGateRecordPayload => ({
  schema: 'kit-vnext.capability-gate-record.v1',
  gateId: 'gate-auto-merge-intents-01',
  capability: 'auto-merge',
  decision: 'allow',
  mode: 'assisted',
  scope: {
    runId,
    operationId: 'merge-intent-01',
    providerScopes: [
      {
        provider: 'Forge',
        scope: `repo:aryeko/workflow-kit/pr:124/head#${headSha}`,
        freshnessKey: 'forge:pr:124',
        approvedParentScopes: ['repo:aryeko/workflow-kit/pr:124'],
      },
    ],
    pullRequestRef: 'pr:124',
    expectedHeadSha: headSha,
  },
  policyRef,
  requestedByDomain: 'core-05',
  requestedAction: 'merge-pull-request',
  evaluatedAt: recordedAt,
  evaluatedGuarantees: [],
  attestationRefs: [],
  evidenceRefs: ['artifact://forge/pr-124'],
  ...overrides,
});

export const createCompletionDecision = (
  state: CompletionDecisionPayload['state'],
  overrides: Partial<CompletionDecisionPayload> = {},
): CompletionDecisionPayload => ({
  schema: 'kit-vnext.completion-decision-recorded.v1',
  runId,
  state,
  headSha,
  cursor: { runId, afterSequence: 24 },
  evidenceRefs: [verifyRef, localGitRef],
  evaluatedAt: recordedAt,
  ...overrides,
});

export const createMergeDecision = (
  state: MergeDecisionPayload['state'],
  overrides: Partial<MergeDecisionPayload> = {},
): MergeDecisionPayload => ({
  schema: 'kit-vnext.merge-decision-recorded.v1',
  runId,
  state,
  headSha,
  completionEventId: 'evt-completion-01',
  gateRef: createGateRecord(),
  forgeRefs: [forgeRef],
  evaluatedAt: recordedAt,
  ...overrides,
});

export const createForgeInput = (
  overrides: Partial<RecordForgeOperationIntentInput> = {},
): RecordForgeOperationIntentInput => ({
  runId,
  recordedAt,
  operation: 'publish-blocker-evidence',
  policyRef,
  decisionEventId: 'evt-completion-01',
  expectedHeadSha: headSha,
  localHead: exactHeadEvidence,
  evidenceRefs: [localGitRef, verifyRef],
  ...overrides,
});

export const createMergeInput = (overrides: Partial<RecordMergeIntentInput> = {}): RecordMergeIntentInput => ({
  runId,
  recordedAt,
  operation: 'merge',
  policyRef,
  gateEventId: gateRef.eventId,
  mergeDecision: {
    eventId: 'evt-merge-decision-01',
    decision: createMergeDecision('merge-ready'),
  },
  ...overrides,
});

export const createBlockerCompletionInput = (
  state: CompletionDecisionPayload['state'],
  overrides: Partial<RecordBlockerEvidenceIntentInput> = {},
): RecordBlockerEvidenceIntentInput => ({
  runId,
  recordedAt,
  operation: 'publish-blocker-evidence',
  policyRef,
  runnerMayPush: true,
  runnerMayOpenPr: true,
  localHead: exactHeadEvidence,
  decision: {
    kind: 'completion',
    eventId: 'evt-completion-decision-01',
    decision: createCompletionDecision(state),
  },
  ...overrides,
});

export const createBlockerMergeInput = (
  state: MergeDecisionPayload['state'],
  overrides: Partial<RecordBlockerEvidenceIntentInput> = {},
): RecordBlockerEvidenceIntentInput => ({
  runId,
  recordedAt,
  operation: 'publish-blocker-evidence',
  policyRef,
  runnerMayPush: true,
  runnerMayOpenPr: true,
  localHead: exactHeadEvidence,
  decision: {
    kind: 'merge',
    eventId: 'evt-merge-decision-01',
    decision: createMergeDecision(state),
  },
  ...overrides,
});

export const appendReceipt: RunAppendReceipt = {
  runId,
  firstSequence: 41,
  lastSequence: 41,
  writerEpoch: 1,
  durability: 'barrier',
  eventIds: ['evt-intent-append-01'],
  payloadDigests: ['sha256:intent-append-01'],
  frameDigest: 'sha256:frame-intent-01',
  health: 'ok',
};

export const createWriter = (
  appendImpl?: (batch: AppendIntent[]) => Result<RunAppendReceipt, RunAppendFailure>,
): CapturingWriter => {
  const appendCalls: AppendIntent[][] = [];
  const writer: CapturingWriter = {
    appendCalls,
    append(batch) {
      appendCalls.push(batch);
      return appendImpl?.(batch) ?? { ok: true, value: appendReceipt };
    },
    renew() {
      return { ok: true, value: writer };
    },
  };

  return writer;
};
