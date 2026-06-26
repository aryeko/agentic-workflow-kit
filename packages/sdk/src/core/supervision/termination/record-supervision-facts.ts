import type {
  LivenessAdvancedPayload,
  LivenessStateChangedPayload,
  LivenessTimerExpiredPayload,
  SupervisorStartedPayload,
} from '../contracts/index.js';

import { appendSingleFact, ensureCoreFactAppendAllowed } from './shared.js';
import type {
  RecordLivenessAdvancedInput,
  RecordLivenessAdvancedResult,
  RecordLivenessStateChangedInput,
  RecordLivenessStateChangedResult,
  RecordTimerExpiredInput,
  RecordTimerExpiredResult,
  StartSupervisorInput,
  StartSupervisorResult,
  SupervisionFactWriter,
} from './types.js';

export const startSupervisor = async (
  input: StartSupervisorInput,
  writer: SupervisionFactWriter,
): Promise<StartSupervisorResult> => {
  const { guard, ...payloadInput } = input;
  const allowed = ensureCoreFactAppendAllowed(guard);
  if (!allowed.ok) {
    return allowed;
  }

  const payload: SupervisorStartedPayload = {
    schema: 'kit-vnext.supervisor-started.v1',
    ...payloadInput,
    sourceEventIds: [...payloadInput.sourceEventIds],
  };

  return appendSingleFact(
    writer,
    {
      type: 'SupervisorStarted',
      durability: 'durable',
      occurredAt: payload.startedAt,
      payload,
    },
    'SupervisorStarted',
  );
};

export const recordLivenessAdvanced = async (
  input: RecordLivenessAdvancedInput,
  writer: SupervisionFactWriter,
): Promise<RecordLivenessAdvancedResult> => {
  const { guard, ...payloadInput } = input;
  const allowed = ensureCoreFactAppendAllowed(guard);
  if (!allowed.ok) {
    return allowed;
  }

  const payload: LivenessAdvancedPayload = {
    schema: 'kit-vnext.liveness-advanced.v1',
    ...payloadInput,
    refreshedTimers: [...payloadInput.refreshedTimers],
  };

  return appendSingleFact(
    writer,
    {
      type: 'LivenessAdvanced',
      durability: 'durable',
      occurredAt: payload.advancedAt,
      payload,
    },
    'LivenessAdvanced',
  );
};

export const recordTimerExpired = async (
  input: RecordTimerExpiredInput,
  writer: SupervisionFactWriter,
): Promise<RecordTimerExpiredResult> => {
  const { guard, ...payloadInput } = input;
  const allowed = ensureCoreFactAppendAllowed(guard);
  if (!allowed.ok) {
    return allowed;
  }

  const payload: LivenessTimerExpiredPayload = {
    schema: 'kit-vnext.liveness-timer-expired.v1',
    ...payloadInput,
    sourceEventIds: [...payloadInput.sourceEventIds],
  };

  return appendSingleFact(
    writer,
    {
      type: 'LivenessTimerExpired',
      durability: 'durable',
      occurredAt: payload.observedAt,
      payload,
    },
    'LivenessTimerExpired',
  );
};

export const recordLivenessStateChanged = async (
  input: RecordLivenessStateChangedInput,
  writer: SupervisionFactWriter,
): Promise<RecordLivenessStateChangedResult> => {
  const { guard, ...payloadInput } = input;
  const allowed = ensureCoreFactAppendAllowed(guard);
  if (!allowed.ok) {
    return allowed;
  }

  const payload: LivenessStateChangedPayload = {
    schema: 'kit-vnext.liveness-state-changed.v1',
    ...payloadInput,
    sourceEventIds: [...payloadInput.sourceEventIds],
  };

  return appendSingleFact(
    writer,
    {
      type: 'LivenessStateChanged',
      durability: 'durable',
      occurredAt: payload.changedAt,
      payload,
    },
    'LivenessStateChanged',
  );
};
