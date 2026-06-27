import type {
  AppendIntent,
  EvidenceEventRef,
  ForgeActionResult,
  MergeIntentPayload,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from '../../../../src/index.js';

type CapturingWriter = RunWriter & {
  readonly appendCalls: AppendIntent[][];
};

export const runId = 'run-post-merge-01';
export const evaluatedAt = '2026-06-27T15:00:00.000Z';
export const expectedHeadSha = 'head-post-merge-01';

export const createEvidenceRef = (eventId: string, type: string, sequence: number): EvidenceEventRef => ({
  eventId,
  sequence,
  payloadDigest: `sha256:${eventId}`,
  type,
});

export const mergeIntentRef = createEvidenceRef('evt-merge-intent-01', 'MergeIntentRecorded', 31);
export const forgeEvidenceRef = createEvidenceRef('evt-forge-evidence-01', 'ForgeEvidenceCollected', 32);
export const exactHeadEvidenceRefs = [mergeIntentRef, forgeEvidenceRef] as const;

export const createMergeIntent = (
  overrides: Partial<MergeIntentPayload> = {},
): { eventId: string; intent: MergeIntentPayload } => ({
  eventId: 'evt-merge-intent-01',
  intent: {
    schema: 'kit-vnext.merge-intent-recorded.v1',
    runId,
    operation: 'merge',
    expectedHeadSha,
    policyRef: 'policy:merge',
    gateEventId: 'evt-gate-01',
    mergeDecisionEventId: 'evt-merge-decision-01',
    recordedAt: '2026-06-27T14:59:00.000Z',
    ...overrides,
  },
});

export const createAcceptedResult = (
  overrides: Partial<Extract<ForgeActionResult, { kind: 'accepted' }>> = {},
): Extract<ForgeActionResult, { kind: 'accepted' }> => ({
  kind: 'accepted',
  observedHeadSha: expectedHeadSha,
  redactionFingerprintIds: ['redaction-1'],
  credentialAuditEventIds: ['evt-cred-1'],
  evidenceRef: 'artifact://post-merge/accepted',
  at: evaluatedAt,
  ...overrides,
});

export const createRefusedResult = (
  token: Extract<ForgeActionResult, { kind: 'refused' }>['token'],
  overrides: Partial<Extract<ForgeActionResult, { kind: 'refused' }>> = {},
): Extract<ForgeActionResult, { kind: 'refused' }> => ({
  kind: 'refused',
  token,
  observedHeadSha: expectedHeadSha,
  redactionFingerprintIds: ['redaction-1'],
  credentialAuditEventIds: ['evt-cred-1'],
  evidenceRef: `artifact://post-merge/${token}`,
  at: evaluatedAt,
  ...overrides,
});

export const createDegradedResult = (
  token: Extract<ForgeActionResult, { kind: 'degraded' }>['token'],
  overrides: Partial<Extract<ForgeActionResult, { kind: 'degraded' }>> = {},
): Extract<ForgeActionResult, { kind: 'degraded' }> => ({
  kind: 'degraded',
  token,
  observedHeadSha: expectedHeadSha,
  redactionFingerprintIds: ['redaction-1'],
  credentialAuditEventIds: ['evt-cred-1'],
  evidenceRef: `artifact://post-merge/${token}`,
  at: evaluatedAt,
  ...overrides,
});

export const createInput = (
  overrides: Partial<import('../../../../src/index.js').RecordPostMergeOutcomeInput> = {},
): import('../../../../src/index.js').RecordPostMergeOutcomeInput => ({
  runId,
  evaluatedAt,
  mergeIntent: createMergeIntent(),
  sourceActionEventId: 'evt-source-action-01',
  sourceActionEventType: 'ForgePullRequestMerged',
  actionResult: createAcceptedResult(),
  exactHeadEvidenceRefs,
  ...overrides,
});

export const appendReceipt: RunAppendReceipt = {
  runId,
  firstSequence: 41,
  lastSequence: 41,
  writerEpoch: 1,
  durability: 'barrier',
  eventIds: ['evt-post-merge-01'],
  payloadDigests: ['sha256:post-merge-01'],
  frameDigest: 'sha256:frame-post-merge-01',
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
