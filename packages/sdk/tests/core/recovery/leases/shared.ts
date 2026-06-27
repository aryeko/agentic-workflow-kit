import type {
  LeaseCapability,
  RecoveryEvidenceSnapshot,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
  StorageError,
} from '../../../../src/index.js';

export const storyLaunchPartsFixture = {
  workSourceId: 'ws-01',
  trackId: 'track-01',
  taskId: 'task-01',
} as const;

export const storyLaunchKeyFixture = 'story-launch:ws-01:track-01:task-01';
export const acquiredAtFixture = '2026-06-27T12:00:00.000Z';
export const blockedAtFixture = '2026-06-27T12:01:00.000Z';
export const requestedAtFixture = '2026-06-27T12:02:00.000Z';
export const runIdFixture = 'run-recovery-lease-01';
export const sourceEventIdsFixture = ['evt-run-created-01'] as const;
export const evidenceRefFixture = {
  eventId: 'evt-evidence-01',
  sequence: 17,
  payloadDigest: 'sha256:evidence-01',
  type: 'RecoveryEvidenceRecorded',
} as const;

export const makeLeaseCapability = (epoch = 6, name = storyLaunchKeyFixture): LeaseCapability => ({
  name,
  epoch,
  token: `token-${epoch}`,
  expiresAt: new Date('2026-06-27T12:30:00.000Z'),
});

export const makeAppendReceipt = (): RunAppendReceipt => ({
  runId: runIdFixture,
  firstSequence: 3,
  lastSequence: 3,
  writerEpoch: 2,
  durability: 'barrier',
  eventIds: ['evt-core-06-01'],
  payloadDigests: ['sha256:event-01'],
  frameDigest: 'sha256:frame-01',
  health: 'ok',
});

export const makeAppendFailure = (): RunAppendFailure => ({
  code: 'event-log-unavailable',
  message: 'event log unavailable',
  retryable: true,
});

export const makeStorageError = (code: StorageError['code'], health: StorageError['health'] = 'ok'): StorageError => ({
  code,
  health,
  message: `${code}:${health}`,
});

export const createWriterHarness = (
  result: Result<RunAppendReceipt, RunAppendFailure> = { ok: true, value: makeAppendReceipt() },
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

export const createLeaseStoreHarness = (options?: {
  readonly acquireResult?: LeaseCapability | StorageError;
}): {
  readonly acquireCalls: Array<{ readonly name: string; readonly holder: string; readonly ttlMs: number }>;
  readonly releaseCalls: Array<{ readonly name: string; readonly epoch: number; readonly token: string }>;
  readonly leaseStore: {
    acquire(name: string, holder: string, ttlMs: number): LeaseCapability | StorageError;
    release(name: string, epoch: number, token: string): undefined;
  };
} => {
  const acquireCalls: Array<{ readonly name: string; readonly holder: string; readonly ttlMs: number }> = [];
  const releaseCalls: Array<{ readonly name: string; readonly epoch: number; readonly token: string }> = [];

  return {
    acquireCalls,
    releaseCalls,
    leaseStore: {
      acquire(name, holder, ttlMs) {
        acquireCalls.push({ name, holder, ttlMs });
        return options?.acquireResult ?? makeLeaseCapability();
      },
      release(name, epoch, token) {
        releaseCalls.push({ name, epoch, token });
        return undefined;
      },
    },
  };
};

export const makeRecoverySnapshot = (overrides: Partial<RecoveryEvidenceSnapshot> = {}): RecoveryEvidenceSnapshot => ({
  runId: runIdFixture,
  evaluatedThrough: {
    runId: runIdFixture,
    afterSequence: 17,
  },
  observedAt: '2026-06-27T12:02:00.000Z',
  state: {
    lifecycle: 'running',
    currentSequence: 17,
    writerEpoch: 2,
    degradedHealth: 'ok',
  },
  launch: {
    linkage: 'known',
    currentSession: undefined,
    linkHistory: [],
  },
  leases: {
    leaseHealth: 'ok',
    storyLaunch: {
      name: storyLaunchKeyFixture,
      epoch: 5,
      holder: 'run-old-01',
      tokenDigest: 'sha256:old-token',
      expiresAt: new Date('2026-06-27T12:01:00.000Z'),
    },
    runWriter: undefined,
  },
  evidenceRefs: [evidenceRefFixture],
  providerGaps: [],
  ownership: {
    ownerState: 'none',
  },
  process: {
    state: 'empty',
    evidenceRefs: [evidenceRefFixture],
  },
  approval: {
    state: 'none',
    evidenceRefs: [evidenceRefFixture],
  },
  workSource: {
    claimState: 'released',
    evidenceRefs: [evidenceRefFixture],
  },
  ...overrides,
});
