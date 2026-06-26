import type { CapabilityAttestation } from '../../../providers/attestation/index.js';
import { toEpochMs } from '../../capability/evaluator/timestamps.js';
import type { AppendIntent, Result, RunAppendReceipt } from '../../run-lifecycle/contracts/index.js';
import type { LivenessReason, SupervisionLostPayload } from '../contracts/index.js';

import type {
  RecordSupervisionLostResult,
  SupervisionFactCommit,
  SupervisionFactFailure,
  SupervisionFactGuard,
  SupervisionFactWriter,
} from './types.js';

const CORE_04_DOMAIN = 'core-04';

const appendUnavailable = (
  appendFailure: SupervisionFactFailure['appendFailure'],
): Result<never, SupervisionFactFailure> => ({
  ok: false,
  error: {
    reason: 'supervision-event-log-unavailable',
    appendFailure,
  },
});

const stoppedFailure = (): Result<never, SupervisionFactFailure> => ({
  ok: false,
  error: {
    reason: 'supervisor-stopped',
  },
});

const postTerminalFailure = (): Result<never, SupervisionFactFailure> => ({
  ok: false,
  error: {
    reason: 'post-terminal-core-04-fact-forbidden',
  },
});

export const uniqueEventIds = (eventIds: readonly string[]): string[] => [...new Set(eventIds)];

export const isFreshPositiveCanKill = (
  canKill: CapabilityAttestation<'canKill'> | undefined,
  asOf: string,
): boolean => {
  if (canKill?.result !== 'positive') {
    return false;
  }

  const expiry = toEpochMs(canKill.expiry);
  const evaluatedAt = toEpochMs(asOf);
  if (expiry === undefined || evaluatedAt === undefined) {
    return false;
  }

  return expiry >= evaluatedAt;
};

export const ensureCoreFactAppendAllowed = (
  guard: SupervisionFactGuard | undefined,
): Result<void, SupervisionFactFailure> => {
  if (guard?.supervisorStopped) {
    return stoppedFailure();
  }

  if (guard?.lifecycleTerminal) {
    return postTerminalFailure();
  }

  return {
    ok: true,
    value: undefined,
  };
};

export const ensureSupervisorStopAllowed = (
  guard: SupervisionFactGuard | undefined,
): Result<void, SupervisionFactFailure> => {
  if (guard?.supervisorStopped) {
    return stoppedFailure();
  }

  return {
    ok: true,
    value: undefined,
  };
};

export const appendSingleFact = async <TPayload>(
  writer: SupervisionFactWriter,
  intent: Omit<AppendIntent<TPayload>, 'domain'>,
  fallbackEventId: string,
): Promise<Result<SupervisionFactCommit<TPayload>, SupervisionFactFailure>> => {
  const appendIntent: AppendIntent<TPayload> = {
    domain: CORE_04_DOMAIN,
    ...intent,
  };

  const appendResult = await Promise.resolve(writer.append([appendIntent]));
  if (!appendResult.ok) {
    return appendUnavailable(appendResult.error);
  }

  return {
    ok: true,
    value: {
      payload: intent.payload,
      eventId: appendResult.value.eventIds[0] ?? fallbackEventId,
      appendReceipt: appendResult.value,
    },
  };
};

export const appendSupervisionLost = async (
  writer: SupervisionFactWriter,
  input: {
    readonly runId: string;
    readonly reason: LivenessReason;
    readonly lostAt: string;
    readonly sourceEventIds: readonly string[];
  },
): Promise<RecordSupervisionLostResult> =>
  appendSingleFact(
    writer,
    {
      type: 'SupervisionLost',
      durability: 'barrier',
      occurredAt: input.lostAt,
      payload: {
        schema: 'kit-vnext.supervision-lost.v1',
        runId: input.runId,
        reason: input.reason,
        lostAt: input.lostAt,
        sourceEventIds: uniqueEventIds(input.sourceEventIds),
      } satisfies SupervisionLostPayload,
    },
    'SupervisionLost',
  );

export const buildBatchCommit = <TPayload>(
  payload: TPayload,
  receipt: RunAppendReceipt,
  eventId: string | undefined,
  fallbackEventId: string,
): SupervisionFactCommit<TPayload> => ({
  payload,
  eventId: eventId ?? fallbackEventId,
  appendReceipt: receipt,
});
