import type {
  RunAppendFailureCode,
  RunAppendRejectedPayload,
  RunEventEnvelope,
  RunLifecycleState,
  RunLifecycleTransitionPayload,
  RunLogTailRepairedPayload,
  SessionLinkedPayload,
  SessionLinkSupersededPayload,
} from '../contracts/index.js';

const RUN_LIFECYCLE_STATES = new Set<RunLifecycleState>([
  'created',
  'configured',
  'task-snapshotted',
  'workspace-ready',
  'worker-starting',
  'running',
  'parked',
  'runner-verifying',
  'forge-waiting',
  'merge-waiting',
  'settling',
  'completed',
  'blocked',
  'failed',
  'canceled',
]);

const RUN_APPEND_FAILURE_CODES = new Set<RunAppendFailureCode>([
  'stale-writer-fenced',
  'sequence-conflict',
  'illegal-lifecycle-transition',
  'durability-insufficient',
  'partial-ack-unknown',
  'interior-corrupt',
  'event-log-unavailable',
]);

const hasString = (value: unknown): value is string => typeof value === 'string';
const hasNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const hasBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(hasString);

const isLifecycleState = (value: unknown): value is RunLifecycleState =>
  hasString(value) && RUN_LIFECYCLE_STATES.has(value as RunLifecycleState);

const isLifecycleTransitionPayload = (value: unknown): value is RunLifecycleTransitionPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<RunLifecycleTransitionPayload>;

  return (
    (payload.from === null || isLifecycleState(payload.from)) &&
    isLifecycleState(payload.to) &&
    hasString(payload.reason) &&
    ['operator', 'policy', 'system', 'recovery'].includes(payload.authority ?? '') &&
    isStringArray(payload.sourceEventIds) &&
    (payload.terminal === undefined || hasBoolean(payload.terminal))
  );
};

const isSessionLinkedPayload = (value: unknown): value is SessionLinkedPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<SessionLinkedPayload>;

  return (
    hasNumber(payload.linkOrdinal) &&
    hasString(payload.sessionId) &&
    ['primary', 'recovery', 'observer'].includes(payload.linkRole ?? '') &&
    hasString(payload.startedAt) &&
    hasString(payload.sourceEventId) &&
    (payload.supersedesOrdinal === undefined || hasNumber(payload.supersedesOrdinal))
  );
};

const isSessionLinkSupersededPayload = (value: unknown): value is SessionLinkSupersededPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<SessionLinkSupersededPayload>;

  return (
    hasNumber(payload.supersededOrdinal) &&
    hasNumber(payload.replacementOrdinal) &&
    hasString(payload.reason) &&
    hasString(payload.sourceEventId)
  );
};

const isRunLogTailRepairedPayload = (value: unknown): value is RunLogTailRepairedPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<RunLogTailRepairedPayload>;

  return (
    hasString(payload.repairedAt) &&
    hasNumber(payload.lastCommittedSequence) &&
    hasNumber(payload.quarantinedBytes) &&
    payload.storageHealth === 'log-tail-repaired'
  );
};

const isRunAppendRejectedPayload = (value: unknown): value is RunAppendRejectedPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<RunAppendRejectedPayload>;

  return (
    (payload.attemptedEventId === undefined || hasString(payload.attemptedEventId)) &&
    hasString(payload.attemptedType) &&
    hasString(payload.attemptedDomain) &&
    RUN_APPEND_FAILURE_CODES.has(payload.failureCode as RunAppendFailureCode) &&
    (payload.expectedSequence === undefined || hasNumber(payload.expectedSequence)) &&
    (payload.observedSequence === undefined || hasNumber(payload.observedSequence)) &&
    (payload.writerEpoch === undefined || hasNumber(payload.writerEpoch)) &&
    hasString(payload.recordedReason)
  );
};

export const hasValidDeclaredPayload = (envelope: RunEventEnvelope): boolean => {
  switch (envelope.type) {
    case 'RunLifecycleTransitioned':
      return isLifecycleTransitionPayload(envelope.payload);
    case 'SessionLinked':
      return isSessionLinkedPayload(envelope.payload);
    case 'SessionLinkSuperseded':
      return isSessionLinkSupersededPayload(envelope.payload);
    case 'RunLogTailRepaired':
      return isRunLogTailRepairedPayload(envelope.payload);
    case 'RunAppendRejected':
      return isRunAppendRejectedPayload(envelope.payload);
    default:
      return true;
  }
};

export const getTailRepairPayload = (envelopes: readonly RunEventEnvelope[]): RunLogTailRepairedPayload | undefined => {
  for (let index = envelopes.length - 1; index >= 0; index -= 1) {
    const envelope = envelopes[index];
    if (envelope?.type === 'RunLogTailRepaired' && isRunLogTailRepairedPayload(envelope.payload)) {
      return envelope.payload;
    }
  }

  return undefined;
};
