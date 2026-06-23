import type {
  AnalysisFailedPayload,
  AnalysisInputHealth,
  AnalysisIssue,
  AnalysisRecordedPayload,
  AnalysisRecordInput,
  AppendIntent,
  ArtifactInput,
  ArtifactRef,
  ArtifactStore,
  EvidenceEventRef,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventEnvelope,
  RunReplay,
  RunWriter,
  ScratchArtifactRef,
  StorageError,
} from 'sdk';

export const runId = 'run-analysis-record-123';
export const analyzedAt = '2026-06-23T12:00:00.000Z';

export const triggerEventRef: EvidenceEventRef = {
  eventId: 'evt-terminal-10',
  sequence: 10,
  payloadDigest: 'sha256:terminal',
  type: 'RunLifecycleTransitioned',
};

export const redactedReportRef: ArtifactRef = {
  id: 'artifact:sha256:redacted-report',
  digest: 'sha256:redacted-report',
  size: 42,
  mediaType: 'application/json',
  retentionClass: 'run-evidence',
  classification: 'analysis-report',
  redactionState: 'redacted',
};

export const rawReportRef: ArtifactRef = {
  ...redactedReportRef,
  id: 'artifact:sha256:raw-report',
  digest: 'sha256:raw-report',
  redactionState: 'raw',
};

export const scratchReportRef: ScratchArtifactRef = {
  id: 'scratch:sha256:report',
  digest: 'sha256:scratch-report',
  size: 42,
  mediaType: 'application/json',
  classification: 'analysis-report',
  redactionState: 'redacted',
};

export const reportArtifactInput: ArtifactInput = {
  content: new Uint8Array([123, 34, 111, 107, 34, 58, 116, 114, 117, 101, 125]),
  mediaType: 'application/json',
  retentionClass: 'run-evidence',
  classification: 'analysis-report',
  producer: 'core-07',
};

export const inputHealth: AnalysisInputHealth = {
  replayHealth: 'ok',
  projections: 'available',
  artifactInputs: 'available',
  redaction: 'applied',
};

export const issueFixture: AnalysisIssue = {
  issueId: 'issue-terminal-missing-proof',
  code: 'lifecycle-terminal-missing-proof',
  severity: 'attention',
  summary: 'Terminal lifecycle needs evidence.',
  evidenceRefs: [triggerEventRef],
  artifactRefs: [],
  metricRefs: ['terminal-latency'],
};

export const appendReceipt: RunAppendReceipt = {
  runId,
  firstSequence: 21,
  lastSequence: 21,
  writerEpoch: 4,
  durability: 'barrier',
  eventIds: ['receipt-event-id'],
  payloadDigests: ['sha256:receipt-payload'],
  frameDigest: 'sha256:frame',
  health: 'ok',
};

export const appendFailure: RunAppendFailure = {
  code: 'event-log-unavailable',
  message: 'append failed',
  retryable: true,
};

export const storageError: StorageError = {
  code: 'artifact-quarantined',
  health: 'unusable',
  message: 'artifact store unavailable',
};

export type CapturingWriter = RunWriter & {
  readonly appendCalls: AppendIntent[][];
};

export const createWriter = (
  appendImpl?: (batch: AppendIntent[]) => ReturnType<RunWriter['append']>,
): CapturingWriter => {
  const appendCalls: AppendIntent[][] = [];
  const writer: CapturingWriter = {
    appendCalls,
    append(batch) {
      appendCalls.push(batch);
      if (appendImpl !== undefined) {
        return appendImpl(batch);
      }

      const intent = batch[0];
      return {
        ok: true,
        value: {
          ...appendReceipt,
          eventIds: [intent.eventId ?? appendReceipt.eventIds[0]],
        },
      };
    },
    renew() {
      return { ok: true, value: writer };
    },
  };

  return writer;
};

export const createArtifactStore = (putResult: ArtifactRef | StorageError): ArtifactStore => ({
  async put() {
    return putResult;
  },
  async putScratch() {
    return scratchReportRef;
  },
  resolve() {
    return putResult;
  },
  get() {
    return storageError;
  },
  redact() {
    return putResult;
  },
  export() {
    return storageError;
  },
});

const isAnalysisPayload = (payload: unknown): payload is AnalysisRecordedPayload | AnalysisFailedPayload =>
  typeof payload === 'object' &&
  payload !== null &&
  'schema' in payload &&
  (payload.schema === 'kit-vnext.analysis-recorded.v1' || payload.schema === 'kit-vnext.analysis-failed.v1');

export const createRecordInput = (overrides: Partial<AnalysisRecordInput> = {}): AnalysisRecordInput => ({
  request: {
    runId,
    trigger: {
      kind: 'terminal-lifecycle',
      eventRef: triggerEventRef,
      reason: 'terminal completed',
    },
    evaluatedThrough: {
      runId,
      afterSequence: 10,
    },
    analyzedAt,
    analyzerVersion: 'core-07-s2@97b7639',
    ruleSetDigest: 'sha256:rules',
    redactionPolicyDigest: 'sha256:redaction-policy',
  },
  inputHealth,
  outcome: {
    kind: 'recorded',
    result: {
      issues: [issueFixture],
      metrics: {
        'terminal-latency': {
          state: 'available',
          value: 12,
          unit: 'seconds',
          evidenceRefs: [triggerEventRef],
        },
      },
      evidenceRefs: [triggerEventRef],
      reportArtifactRef: redactedReportRef,
    },
  },
  ...overrides,
});

export const createFailedInput = (reason: AnalysisFailedPayload['reason']): AnalysisRecordInput =>
  createRecordInput({
    outcome: {
      kind: 'failed',
      failure: {
        reason,
        evidenceRefs: [triggerEventRef],
        artifactRefs: [redactedReportRef],
      },
    },
  });

export const createReplay = (events: RunEventEnvelope[], health: RunReplay['health'] = 'ok'): RunReplay => ({
  runId,
  events,
  lastSequence: events.at(-1)?.sequence ?? 0,
  writerEpoch: 4,
  health,
  healthRecords: [],
});

export const createEvent = <TPayload>({
  eventId,
  sequence,
  type,
  payload,
  payloadDigest = `sha256:${eventId}`,
  domain = 'core-07',
  durability = 'barrier',
}: {
  eventId: string;
  sequence: number;
  type: string;
  payload: TPayload;
  payloadDigest?: string;
  domain?: string;
  durability?: 'durable' | 'barrier';
}): RunEventEnvelope<TPayload> => ({
  schema: 'kit-vnext.run-event.v1',
  runId,
  eventId,
  sequence,
  writerEpoch: 4,
  domain,
  type,
  durability,
  occurredAt: analyzedAt,
  recordedAt: analyzedAt,
  payloadDigest,
  payload,
});

export const createTerminalEvent = (sequence = 10): RunEventEnvelope =>
  createEvent({
    eventId: `evt-terminal-${sequence}`,
    sequence,
    domain: 'core-01',
    type: 'RunLifecycleTransitioned',
    payload: {
      from: 'running',
      to: 'completed',
      reason: 'done',
      authority: 'system',
      sourceEventIds: ['evt-source'],
      terminal: true,
    },
  });

export const onlyPayload = (writer: CapturingWriter): AnalysisRecordedPayload | AnalysisFailedPayload => {
  const payload = writer.appendCalls[0]?.[0]?.payload;
  if (!isAnalysisPayload(payload)) {
    throw new Error('expected analysis payload');
  }

  return payload;
};
