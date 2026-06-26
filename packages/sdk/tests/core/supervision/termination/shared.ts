import type {
  AppendIntent,
  CapabilityAttestation,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventCursor,
  SupervisionTimerPolicy,
  TerminationPolicy,
  TerminationResult,
  WorkerHandle,
} from 'sdk';

import type { SupervisionFactWriter, TerminationHost } from '../../../../src/core/supervision/termination/index.js';

export const runId = 'run-termination-01';

export const cursor: RunEventCursor = {
  runId,
  afterSequence: 41,
};

export const timerPolicy: SupervisionTimerPolicy = {
  startupMs: 120_000,
  idleMs: 900_000,
  noProgressMs: 2_700_000,
  perToolMs: 1_800_000,
  approvalSlaMs: 86_400_000,
  maxRuntimeMs: 28_800_000,
};

export const terminationPolicy: TerminationPolicy = {
  initialSignal: 'SIGTERM',
  graceSeconds: 15,
  forceKill: true,
  proveEmptyTimeoutSeconds: 30,
};

export const ownedWorkerHandle = (overrides: Partial<WorkerHandle> = {}): WorkerHandle => ({
  handleId: 'worker-handle-01',
  runId,
  operationId: 'op-worker-01',
  workspaceHandleId: 'workspace-handle-01',
  ownershipClass: 'owned',
  containmentRef: 'containment://worker-handle-01',
  startedAt: '2026-06-26T08:50:00.000Z',
  ...overrides,
});

export const canKillAttestation = (
  overrides: Partial<CapabilityAttestation<'canKill'>> = {},
): CapabilityAttestation<'canKill'> => ({
  capability: 'canKill',
  probeMethod: 'live-smoke',
  result: 'positive',
  evidenceRef: 'artifact://host-can-kill',
  scope: 'executionHost',
  expiry: '2026-06-26T10:30:00.000Z',
  driverVersion: '1.0.0',
  platform: 'darwin-arm64',
  freshnessKey: 'execution-host:provider-local',
  at: '2026-06-26T09:00:00.000Z',
  ...overrides,
});

export const terminationResult = (overrides: Partial<TerminationResult> = {}): TerminationResult => ({
  handleId: 'worker-handle-01',
  terminalSignal: 'SIGKILL',
  proof: {
    signalSent: true,
    graceObserved: true,
    forceKillSent: true,
    reaped: true,
    containmentEmpty: true,
    evidenceRef: 'artifact://termination-proof-01',
    checkedAt: '2026-06-26T09:16:00.000Z',
  },
  ...overrides,
});

export type CapturingWriter = SupervisionFactWriter & {
  readonly appendCalls: AppendIntent[][];
};

export const createWriter = (
  appendImpl?: (batch: AppendIntent[], callIndex: number) => Result<RunAppendReceipt, RunAppendFailure>,
): CapturingWriter => {
  const appendCalls: AppendIntent[][] = [];
  const writer: CapturingWriter = {
    appendCalls,
    append(batch) {
      appendCalls.push(batch);
      const callIndex = appendCalls.length;
      return (
        appendImpl?.(batch, callIndex) ?? {
          ok: true,
          value: {
            runId,
            firstSequence: callIndex,
            lastSequence: callIndex + batch.length - 1,
            writerEpoch: 3,
            durability: batch.some((intent) => intent.durability === 'barrier') ? 'barrier' : 'durable',
            eventIds: batch.map((intent, index) => `evt-${intent.type}-${callIndex}-${index + 1}`),
            payloadDigests: batch.map((intent, index) => `sha256:${intent.type}-${callIndex}-${index + 1}`),
            frameDigest: `sha256:frame-${callIndex}`,
            health: 'ok',
          },
        }
      );
    },
  };

  return writer;
};

export type CapturingHost = TerminationHost & {
  readonly terminateCalls: Array<{
    readonly handle: WorkerHandle;
    readonly policy: TerminationPolicy;
  }>;
};

export const createHost = (result = terminationResult()): CapturingHost => {
  const terminateCalls: CapturingHost['terminateCalls'] = [];
  return {
    terminateCalls,
    terminateWorker(handle, policy) {
      terminateCalls.push({ handle, policy });
      return result;
    },
  };
};

export const appendFailure: RunAppendFailure = {
  code: 'event-log-unavailable',
  message: 'event log unavailable',
  retryable: true,
};
