import type {
  LivenessAdvancedPayload,
  LivenessStateChangedPayload,
  LivenessTimerExpiredPayload,
  SupervisorStartedPayload,
} from '../contracts/index.js';

import { appendSingleFact, ensureCoreFactAppendAllowed } from './shared.js';
import type { Result } from '../../run-lifecycle/contracts/index.js';
import type {
  RecordLivenessAdvancedInput,
  RecordLivenessAdvancedResult,
  RecordLivenessStateChangedInput,
  RecordLivenessStateChangedResult,
  RecordTimerExpiredInput,
  RecordTimerExpiredResult,
  StartSupervisorInput,
  StartSupervisorResult,
  SupervisionFactCommit,
  SupervisionFactFailure,
  SupervisionFactGuard,
  SupervisionFactWriter,
} from './types.js';

type CoreFactDescriptor<TPayload> = {
  readonly type: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
};

const recordCoreFact = async <TPayload>(
  guard: SupervisionFactGuard | undefined,
  writer: SupervisionFactWriter,
  descriptor: CoreFactDescriptor<TPayload>,
): Promise<Result<SupervisionFactCommit<TPayload>, SupervisionFactFailure>> => {
  const allowed = ensureCoreFactAppendAllowed(guard);
  if (!allowed.ok) {
    return {
      ok: false,
      error: allowed.error,
    };
  }

  return appendSingleFact(
    writer,
    {
      type: descriptor.type,
      durability: 'durable',
      occurredAt: descriptor.occurredAt,
      payload: descriptor.payload,
    },
    descriptor.type,
  );
};

export const startSupervisor = async (
  input: StartSupervisorInput,
  writer: SupervisionFactWriter,
): Promise<StartSupervisorResult> => {
  const { guard, ...payloadInput } = input;
  const payload: SupervisorStartedPayload = {
    schema: 'kit-vnext.supervisor-started.v1',
    ...payloadInput,
    sourceEventIds: [...payloadInput.sourceEventIds],
  };

  return recordCoreFact(guard, writer, {
    type: 'SupervisorStarted',
    occurredAt: payload.startedAt,
    payload,
  });
};

export const recordLivenessAdvanced = async (
  input: RecordLivenessAdvancedInput,
  writer: SupervisionFactWriter,
): Promise<RecordLivenessAdvancedResult> => {
  const { guard, ...payloadInput } = input;
  const payload: LivenessAdvancedPayload = {
    schema: 'kit-vnext.liveness-advanced.v1',
    ...payloadInput,
    refreshedTimers: [...payloadInput.refreshedTimers],
  };

  return recordCoreFact(guard, writer, {
    type: 'LivenessAdvanced',
    occurredAt: payload.advancedAt,
    payload,
  });
};

export const recordTimerExpired = async (
  input: RecordTimerExpiredInput,
  writer: SupervisionFactWriter,
): Promise<RecordTimerExpiredResult> => {
  const { guard, ...payloadInput } = input;
  const payload: LivenessTimerExpiredPayload = {
    schema: 'kit-vnext.liveness-timer-expired.v1',
    ...payloadInput,
    sourceEventIds: [...payloadInput.sourceEventIds],
  };

  return recordCoreFact(guard, writer, {
    type: 'LivenessTimerExpired',
    occurredAt: payload.observedAt,
    payload,
  });
};

export const recordLivenessStateChanged = async (
  input: RecordLivenessStateChangedInput,
  writer: SupervisionFactWriter,
): Promise<RecordLivenessStateChangedResult> => {
  const { guard, ...payloadInput } = input;
  const payload: LivenessStateChangedPayload = {
    schema: 'kit-vnext.liveness-state-changed.v1',
    ...payloadInput,
    sourceEventIds: [...payloadInput.sourceEventIds],
  };

  return recordCoreFact(guard, writer, {
    type: 'LivenessStateChanged',
    occurredAt: payload.changedAt,
    payload,
  });
};
