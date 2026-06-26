import type { AppendIntent, RunAppendReceipt } from '../../run-lifecycle/contracts/index.js';
import type { SupervisorStoppedPayload, WorkerTerminatedPayload } from '../contracts/index.js';

import {
  appendSingleFact,
  buildBatchCommit,
  ensureCoreFactAppendAllowed,
  ensureSupervisorStopAllowed,
} from './shared.js';
import type {
  RecordWorkerTerminatedInput,
  RecordWorkerTerminatedResult,
  StopSupervisorCommit,
  StopSupervisorInput,
  StopSupervisorResult,
  SupervisionFactFailure,
  SupervisionFactWriter,
} from './types.js';

const toAppendUnavailable = (appendFailure: SupervisionFactFailure['appendFailure']): StopSupervisorResult => ({
  ok: false,
  error: {
    reason: 'supervision-event-log-unavailable',
    appendFailure,
  },
});

const buildWorkerTerminatedPayload = (input: Omit<WorkerTerminatedPayload, 'schema'>): WorkerTerminatedPayload => ({
  schema: 'kit-vnext.worker-terminated.v1',
  ...input,
  sourceEventIds: [...input.sourceEventIds],
});

export const recordWorkerTerminated = async (
  input: RecordWorkerTerminatedInput,
  writer: SupervisionFactWriter,
): Promise<RecordWorkerTerminatedResult> => {
  const { guard, ...payloadInput } = input;
  const allowed = ensureCoreFactAppendAllowed(guard);
  if (!allowed.ok) {
    return allowed;
  }

  const payload = buildWorkerTerminatedPayload(payloadInput);
  return appendSingleFact(
    writer,
    {
      type: 'WorkerTerminated',
      durability: 'barrier',
      occurredAt: payload.terminatedAt,
      payload,
    },
    'WorkerTerminated',
  );
};

const buildStopBatch = (
  input: StopSupervisorInput,
): {
  readonly batch: AppendIntent[];
  readonly workerTerminatedPayload?: WorkerTerminatedPayload;
  readonly supervisorStoppedPayload: SupervisorStoppedPayload;
} => {
  const workerTerminatedPayload =
    input.workerTerminated === undefined ? undefined : buildWorkerTerminatedPayload(input.workerTerminated);
  const supervisorStoppedPayload: SupervisorStoppedPayload = {
    schema: 'kit-vnext.supervisor-stopped.v1',
    runId: input.runId,
    outcome: input.outcome,
    stoppedAt: input.stoppedAt,
    terminalSourceEventIds: [...input.terminalSourceEventIds],
    summarizedEventIds: [...input.summarizedEventIds],
  };

  const batch: AppendIntent[] = [
    ...(workerTerminatedPayload === undefined
      ? []
      : [
          {
            domain: 'core-04',
            type: 'WorkerTerminated',
            durability: 'barrier',
            payload: workerTerminatedPayload,
            occurredAt: workerTerminatedPayload.terminatedAt,
          } satisfies AppendIntent<WorkerTerminatedPayload>,
        ]),
    {
      domain: 'core-04',
      type: 'SupervisorStopped',
      durability: 'barrier',
      payload: supervisorStoppedPayload,
      occurredAt: supervisorStoppedPayload.stoppedAt,
    } satisfies AppendIntent<SupervisorStoppedPayload>,
  ];

  return {
    batch,
    workerTerminatedPayload,
    supervisorStoppedPayload,
  };
};

const buildStopCommit = (
  receipt: RunAppendReceipt,
  workerTerminatedPayload: WorkerTerminatedPayload | undefined,
  supervisorStoppedPayload: SupervisorStoppedPayload,
): StopSupervisorCommit => {
  const workerTerminated =
    workerTerminatedPayload === undefined
      ? undefined
      : buildBatchCommit(workerTerminatedPayload, receipt, receipt.eventIds[0], 'WorkerTerminated');
  const stopIndex = workerTerminatedPayload === undefined ? 0 : 1;

  return {
    ...(workerTerminated === undefined ? {} : { workerTerminated }),
    supervisorStopped: buildBatchCommit(
      supervisorStoppedPayload,
      receipt,
      receipt.eventIds[stopIndex],
      'SupervisorStopped',
    ),
    appendReceipt: receipt,
  };
};

export const stopSupervisor = async (
  input: StopSupervisorInput,
  writer: SupervisionFactWriter,
): Promise<StopSupervisorResult> => {
  const allowed = ensureSupervisorStopAllowed(input.guard);
  if (!allowed.ok) {
    return allowed;
  }

  const { batch, workerTerminatedPayload, supervisorStoppedPayload } = buildStopBatch(input);
  const appendResult = await Promise.resolve(writer.append(batch));
  if (!appendResult.ok) {
    return toAppendUnavailable(appendResult.error);
  }

  return {
    ok: true,
    value: buildStopCommit(appendResult.value, workerTerminatedPayload, supervisorStoppedPayload),
  };
};
