import type {
  RecoveryClassification,
  RecoveryClassifiedPayload,
  RecoveryEvidenceSnapshot,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from '../../../../src/index.js';
import { createRecoveryClassifiedPayload } from '../../../../src/core/recovery/classifier/index.js';

export const runIdFixture = 'run-reconciliation-01';
export const blockedAtFixture = '2026-06-27T14:00:00.000Z';

export const evidenceRefFixture = {
  eventId: 'evt-recovery-evidence-01',
  sequence: 44,
  payloadDigest: 'sha256:recovery-evidence-01',
  type: 'RecoveryEvidenceRecorded',
} as const;

const recoverySnapshotFixture: RecoveryEvidenceSnapshot = {
  runId: runIdFixture,
  evaluatedThrough: {
    runId: runIdFixture,
    afterSequence: 44,
  },
  observedAt: '2026-06-27T13:55:00.000Z',
  state: {
    lifecycle: 'settling',
    currentSequence: 44,
    writerEpoch: 3,
    degradedHealth: 'ok',
  },
  launch: {
    linkage: 'known',
    linkHistory: [],
  },
  leases: {
    leaseHealth: 'ok',
  },
  evidenceRefs: [evidenceRefFixture],
  providerGaps: [],
};

export const classifiedPayloadFixture = (overrides: Partial<RecoveryClassification> = {}): RecoveryClassifiedPayload =>
  createRecoveryClassifiedPayload(
    recoverySnapshotFixture,
    {
      state: 'operator-approval-needed',
      actionSafety: 'operator-required',
      recommendedAction: 'park-for-operator',
      reason: 'operator approval is required',
      evidenceRefs: [evidenceRefFixture],
      ...overrides,
    },
    '2026-06-27T13:58:00.000Z',
  );

export const appendFailureFixture: RunAppendFailure = {
  code: 'event-log-unavailable',
  message: 'event log unavailable',
  retryable: true,
};

const appendReceipt = (): RunAppendReceipt => ({
  runId: runIdFixture,
  firstSequence: 45,
  lastSequence: 45,
  writerEpoch: 3,
  durability: 'barrier',
  eventIds: ['evt-reconciliation-blocked-01'],
  payloadDigests: ['sha256:reconciliation-blocked-01'],
  frameDigest: 'sha256:frame-01',
  health: 'ok',
});

export const createWriterHarness = (
  result: Result<RunAppendReceipt, RunAppendFailure> = { ok: true, value: appendReceipt() },
): {
  readonly writer: RunWriter;
  readonly appendCalls: Array<readonly unknown[]>;
} => {
  const appendCalls: Array<readonly unknown[]> = [];

  const writer: RunWriter = {
    append(batch) {
      appendCalls.push(batch);
      return result;
    },
    renew() {
      return { ok: true, value: writer };
    },
  };

  return { writer, appendCalls };
};

export const expectSingleIntent = <TPayload>(appendCalls: Array<readonly unknown[]>) =>
  appendCalls[0]?.[0] as {
    readonly domain: string;
    readonly type: string;
    readonly durability: string;
    readonly payload: TPayload;
    readonly occurredAt: string;
  };
